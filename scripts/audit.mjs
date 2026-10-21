#!/usr/bin/env node
/* ──────────────────────────────────────────────────────────────────
   scripts/audit.mjs
   ──────────────────────────────────────────────────────────────────
   Regression audit for antares-website. Runs Playwright headless
   against every public route at one or both viewports, asserts on
   layout / DOM / behaviour, and exits non-zero on any failure so
   CI gates the merge.

   Usage:
     node scripts/audit.mjs                          # both viewports
     node scripts/audit.mjs --viewport=mobile        # mobile only
     node scripts/audit.mjs --viewport=desktop       # desktop only
     node scripts/audit.mjs --base=https://...       # audit a remote URL
     node scripts/audit.mjs --json                   # JSON tail for CI parsing
     VERCEL_BYPASS_TOKEN=...  node scripts/audit.mjs  # password-protected previews

   What it asserts on EVERY route:

     Mobile (375×812)
       • Zero horizontal overflow
       • If page has a desktop links group: burger is rendered and
         visible (display !== 'none')
       • If page has a desktop links group: the drawer markup
         (<div id="mobile-menu">) exists in the DOM
       • If page has a desktop links group: tapping the burger
         actually opens the drawer (.open class toggles within 400ms)
       • Footer state matches the home/other-page split: hidden on
         /, visible on the rest (PR #168 + #169 contract)
       • No uncaught JS errors

     Desktop (1280×800)
       • Overflow ≤ 17 px (scrollbar gutter tolerance)
       • Desktop nav links group is visible (display !== 'none')
       • A <h1> is rendered somewhere on the page
       • footer's <span> ("No mercy for scammers") inherits the
         footer's grey color, doesn't paint mint (PR #167 contract)
       • No uncaught JS errors

   Plus home-only assertions on DESKTOP:
       • The loss-strip headline ("Billions of dollars") renders
         non-empty after scrolling it into view (PR #166 A1 contract,
         updated when the animated "$2.8B" counter was replaced with
         static copy)
       • The cta-final typewriter actually runs (typewrite-run +
         typewrite-done classes show up after scrolling) (PR #166
         B1 contract)

   Exits 0 if everything passes, 1 otherwise.
   ────────────────────────────────────────────────────────────────── */

import { chromium } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { normalize, resolve, join } from 'node:path';
import { argv, exit, cwd, env } from 'node:process';

const args = new Map(argv.slice(2).map(a => {
  const [k, v] = a.split('=');
  return [k.replace(/^--/, ''), v ?? true];
}));
const wantJson = args.has('json');
const remoteBase = args.get('base');
const skipAxe = args.has('no-axe');
const viewportArg = (args.get('viewport') || 'both').toLowerCase();
const VIEWPORTS_TO_RUN = viewportArg === 'both'
  ? ['mobile', 'desktop']
  : [viewportArg];

if (!['mobile', 'desktop', 'both'].includes(viewportArg)) {
  console.error(`Unknown --viewport="${viewportArg}". Use mobile, desktop, or both.`);
  exit(2);
}

/* Routes to audit. Same list as before — public sitemap, no
   redirect-only or build-only artifacts. */
const ROUTES = [
  '/', '/demo', '/features', '/engine', '/compare', '/pricing',
  '/sources', '/proof', '/faq', '/changelog', '/about',
  '/security', '/support', '/auth', '/account', '/privacy', '/terms',
];

/* Per-viewport browser context settings. */
const VIEWPORTS = {
  mobile: {
    label: 'mobile',
    viewport: { width: 375, height: 812 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  },
  desktop: {
    label: 'desktop',
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
  },
};

/* ── tiny static server (same as before) ────────────────────────── */
const ROOT = cwd();
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
};
function ext(p) { const i = p.lastIndexOf('.'); return i < 0 ? '' : p.slice(i).toLowerCase(); }

async function resolveFile(urlPath) {
  const safe = normalize(urlPath.replace(/^\/+/, '')).replace(/\\/g, '/');
  const tries = [];
  if (urlPath === '/' || urlPath === '') tries.push('index.html');
  else {
    tries.push(safe);
    if (!ext(safe)) tries.push(safe + '.html');
    tries.push(join(safe, 'index.html'));
  }
  for (const t of tries) {
    const full = resolve(ROOT, t);
    if (!full.startsWith(resolve(ROOT))) continue;
    try { if ((await stat(full)).isFile()) return full; } catch { /* try next */ }
  }
  return null;
}

/* Apply the same security headers Vercel sends in production, so the
   local audit catches CSP misconfig (blocked fetches, blocked inline
   scripts, etc.) the same way it would in prod. We read vercel.json
   and apply every header from the catch-all "/(.*)" route. */
async function loadVercelHeaders() {
  try {
    const vj = JSON.parse(await readFile(resolve(ROOT, 'vercel.json'), 'utf8'));
    const block = (vj.headers || []).find(h => h.source === '/(.*)');
    if (!block) return {};
    const out = {};
    for (const h of block.headers) out[h.key] = h.value;
    return out;
  } catch { return {}; }
}
const vercelHeaders = await loadVercelHeaders();

let server, base;
if (remoteBase) {
  base = remoteBase.replace(/\/$/, '');
} else {
  server = createServer(async (req, res) => {
    const u = new URL(req.url, 'http://x');
    const f = await resolveFile(decodeURIComponent(u.pathname));
    if (!f) { res.statusCode = 404; res.end('404'); return; }
    res.setHeader('content-type', MIME[ext(f)] || 'application/octet-stream');
    for (const [k, v] of Object.entries(vercelHeaders)) res.setHeader(k, v);
    res.end(await readFile(f));
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
}

/* Vercel password bypass — same as before. */
const bypassToken = env.VERCEL_BYPASS_TOKEN;
const extraHTTPHeaders = bypassToken
  ? { 'x-vercel-protection-bypass': bypassToken, 'x-vercel-set-bypass-cookie': 'true' }
  : undefined;

/* Console errors we tolerate (third-party noise, see PR #155).
   The last alternative: dexscreener.com now answers `X-Frame-Options: SAMEORIGIN`, so the live chart that /demo embeds is refused by the browser
   ("Refused to display 'https://dexscreener.com/' in a frame ..."). That header is theirs, not ours; only THIS frame, from THIS host, is tolerated:
   a refusal from any other site still fails the audit. */
/* The Firebase SDK logs "Could not reach Cloud Firestore backend" with console.error when the machine that runs the audit cannot reach Firestore for about ten seconds
   (a CI runner, an offline laptop): a statement about the network of that machine, not a defect of the page. The live demo of /demo stays open that long, since the audit
   checks every sample token of the try row (summaryLineLive). */
const IGNORE_ERRORS = /CORS|Access to fetch|net::ERR_FAILED|preview-feedback|space-mono|401|403|Failed to fetch|Not signed in with the identity provider|Refused to display 'https:\/\/dexscreener\.com\/[^']*' in a frame|Could not reach Cloud Firestore backend/i;

/* ── assertion helpers ──────────────────────────────────────────── */

/* Pages whose nav is the simplified <a brand><a back> shape — they
   don't have a .links group on desktop, so the burger+drawer
   expectations are skipped on those routes. privacy/terms moved to
   the standard nav and were removed from this set. */
const PAGES_WITHOUT_LINKS_GROUP = new Set();

/* Pages that are expected to hide the footer on mobile (PR #168 +
   the body.is-home contract). Empty since PR #272: the home footer
   is now visible on mobile to show the @antaresscan X handle. */
const PAGES_WITH_HIDDEN_MOBILE_FOOTER = new Set();

async function auditMobile(page, route) {
  const fails = [];
  const probe = await page.evaluate(() => {
    const d = document.documentElement;
    const burger = document.querySelector('.nav-burger');
    const drawer = document.getElementById('mobile-menu');
    const links = document.querySelector('nav .links, .nav-inner .links');
    const footer = document.querySelector('footer');
    const main = document.querySelector('main');
    const skipLink = document.querySelector('.skip-link');
    const isHome = document.body.classList.contains('is-home');
    return {
      overflow: d.scrollWidth - d.clientWidth,
      burgerExists: !!burger,
      burgerVisible: burger ? getComputedStyle(burger).display !== 'none' : false,
      drawerExists: !!drawer,
      linksGroupExists: !!links,
      linksGroupDisplay: links ? getComputedStyle(links).display : null,
      footerExists: !!footer,
      footerDisplay: footer ? getComputedStyle(footer).display : null,
      mainExists: !!main,
      skipLinkExists: !!skipLink,
      skipLinkTargetsMain: skipLink && main ? skipLink.getAttribute('href') === '#' + main.id : false,
      isHome,
    };
  });

  if (probe.overflow > 0) fails.push(`overflow=${probe.overflow}px`);

  /* Burger / drawer contract — skip on minimal-nav pages. */
  if (!PAGES_WITHOUT_LINKS_GROUP.has(route)) {
    if (!probe.burgerVisible) fails.push('burger-not-visible');
    if (!probe.drawerExists) fails.push('drawer-markup-missing');
    if (probe.linksGroupExists && probe.linksGroupDisplay !== 'none') {
      fails.push(`desktop-links-not-hidden (display=${probe.linksGroupDisplay})`);
    }
    /* Tap the burger and assert the drawer opens. The burger handlers
       are wired by either the inline script (PR #146) or js/burger.js
       (PR #149, #177); either way a click should toggle .open. */
    if (probe.burgerVisible && probe.drawerExists) {
      await page.evaluate(() => {
        document.querySelector('.nav-burger').click();
      });
      await page.waitForTimeout(400);
      const drawerOpen = await page.evaluate(() =>
        document.getElementById('mobile-menu')?.classList.contains('open') ?? false
      );
      if (!drawerOpen) fails.push('burger-click-does-not-open-drawer');
      /* Close it again so the next page test doesn't inherit state. */
      await page.evaluate(() => {
        const m = document.getElementById('mobile-menu');
        if (m) m.classList.remove('open');
        document.body.classList.remove('menu-open');
      });
    }
  }

  /* Footer state — home hidden, others visible (PR #168, #169). */
  if (PAGES_WITH_HIDDEN_MOBILE_FOOTER.has(route)) {
    if (probe.footerExists && probe.footerDisplay !== 'none') {
      fails.push(`home-footer-should-be-hidden (display=${probe.footerDisplay})`);
    }
  }

  /* Skip-link contract — every page that has a <main> should also
     have an injected skip-link pointing at it (js/a11y.js). */
  if (probe.mainExists) {
    if (!probe.skipLinkExists) fails.push('skip-link-missing');
    else if (!probe.skipLinkTargetsMain) fails.push('skip-link-target-mismatch');
  }

  return { fails, probe };
}

async function auditDesktop(page, route) {
  const fails = [];
  const probe = await page.evaluate(() => {
    const d = document.documentElement;
    const links = document.querySelector('nav .links, .nav-inner .links');
    const h1 = document.querySelector('h1');
    const footer = document.querySelector('footer');
    const footerSpan = footer ? footer.querySelector('span') : null;
    const main = document.querySelector('main');
    const skipLink = document.querySelector('.skip-link');
    const manifest = document.querySelector('link[rel="manifest"]');
    const themeColor = document.querySelector('meta[name="theme-color"]');
    const errorMonitor = document.querySelector('script[src="/js/error-monitor.js"]');
    return {
      overflow: d.scrollWidth - d.clientWidth,
      linksExists: !!links,
      linksVisible: links ? getComputedStyle(links).display !== 'none' : false,
      h1Exists: !!h1,
      h1Empty: h1 ? !h1.textContent.trim() : true,
      footerSpanColor: footerSpan ? getComputedStyle(footerSpan).color : null,
      footerColor: footer ? getComputedStyle(footer).color : null,
      mainExists: !!main,
      skipLinkExists: !!skipLink,
      skipLinkTargetsMain: skipLink && main ? skipLink.getAttribute('href') === '#' + main.id : false,
      manifestLinked: !!manifest,
      themeColor: themeColor ? themeColor.getAttribute('content') : null,
      errorMonitorLoaded: !!errorMonitor,
    };
  });

  /* Allow up to 17 px overflow for OS scrollbar gutter. Anything
     above that is a real horizontal scroll bug. */
  if (probe.overflow > 17) fails.push(`overflow=${probe.overflow}px`);

  if (!PAGES_WITHOUT_LINKS_GROUP.has(route)) {
    if (!probe.linksExists) fails.push('nav-links-group-missing');
    else if (!probe.linksVisible) fails.push('nav-links-hidden-on-desktop');
  }

  if (!probe.h1Exists) fails.push('no-h1-on-page');
  else if (probe.h1Empty) fails.push('h1-is-empty');

  /* Footer "No mercy for scammers" should inherit the footer's
     grey, not paint mint. PR #167 contract. */
  if (probe.footerSpanColor && probe.footerColor &&
      probe.footerSpanColor !== probe.footerColor) {
    fails.push(
      `footer-span-color-mismatch (span=${probe.footerSpanColor}, footer=${probe.footerColor})`
    );
  }

  /* Skip-link contract (same as mobile). */
  if (probe.mainExists) {
    if (!probe.skipLinkExists) fails.push('skip-link-missing');
    else if (!probe.skipLinkTargetsMain) fails.push('skip-link-target-mismatch');
  }

  /* PWA contract: every public route declares the manifest + a
     theme-color matching the brand mint (#0ca88c, glass-mint theme). */
  if (!probe.manifestLinked) fails.push('manifest-link-missing');
  if (probe.themeColor !== '#0ca88c') {
    fails.push(`theme-color-mismatch (got="${probe.themeColor}")`);
  }

  /* Resilience contract: every public route loads the error monitor
     so production errors surface somewhere instead of vanishing. */
  if (!probe.errorMonitorLoaded) fails.push('error-monitor-not-loaded');

  /* Home-only animation contract (PR #166). */
  if (route === '/') {
    /* Trigger A1 — the loss-strip headline — by scrolling it into
       view. The animated counter was replaced with static copy
       ("Billions of dollars"); just assert it renders. */
    await page.evaluate(() => {
      document.querySelector('.loss-strip')?.scrollIntoView({ behavior: 'instant' });
    });
    await page.waitForTimeout(2200);
    const headline = await page.evaluate(() =>
      document.querySelector('.loss-strip-num')?.textContent?.trim()
    );
    if (!headline) {
      fails.push(`A1-loss-strip-headline-empty="${headline}"`);
    }

    /* Trigger B1 — typewriter on cta-final — by scrolling it into
       view. Only the threat eyebrow gets the typewriter now; the H2
       headline keeps its inline-CSS .glitch effect untouched (the
       typewriter's clip-path and ::after caret used to override the
       glitch's ::before/::after pseudo-elements). */
    await page.evaluate(() => {
      document.querySelector('.cta-final')?.scrollIntoView({ behavior: 'instant' });
    });
    await page.waitForTimeout(1500);
    const cta = await page.evaluate(() => {
      const threat = document.querySelector('.cta-threat');
      return {
        threatRun: threat?.classList.contains('typewrite-run') ?? false,
        threatDone: threat?.classList.contains('typewrite-done') ?? false,
      };
    });
    if (!cta.threatRun) fails.push('B1-typewriter-threat-not-running');
    if (!cta.threatDone) fails.push('B1-typewriter-threat-not-done');
  }

  /* The row of the overlay card, in both copies of the overlay that this site draws (hero on / and live demo on /demo). */
  if (route === '/' || route === '/demo') {
    for (const p of await overlayRowContract(page)) fails.push('overlay-row-' + p);
  }
  /* The line under the score: the hero cards of / (read from the source) and, on /demo, the live card (see overlayPanelsContract). */
  if (route === '/') {
    for (const p of await summaryLineSource()) fails.push('summary-line-' + p);
  }
  /* The two panels under the card, in the live overlay of /demo (the copy of the extension's panels). */
  if (route === '/demo') {
    for (const p of await overlayPanelsContract(page)) fails.push('overlay-panels-' + p);
    for (const p of await summaryLineLive(page)) fails.push('summary-line-live-' + p);
  }
  return { fails, probe };
}

/* ── The line under the score, in both copies of the card ─────────────────────────────────────────────────────────────────────────
   The overlay card says what its flags are in one short line (flagSummaryLine in the extension's components.ts): "4 warnings — no critical" when none is
   critical, "1 critical flag" / "3 critical flags" when all are, "3 flags — 2 critical" for a mix. "4 flags detected" under a CAUTION read as an alarm. The hero
   cards of / are written in index.html: read here, every one must be one of those lines. The live demo of /demo is checked in the browser (overlayPanelsContract). */
const SUMMARY_LINE = /^(No issues found|\d+ warnings? — no critical|\d+ critical flags?|\d+ flags — \d+ critical|Limited data|Risk detected)$/;
async function summaryLineSource() {
  const problems = [];
  for (const file of ['index.html', 'demo.html']) {
    const html = (await readFile(resolve(cwd(), file), 'utf8')).replace(/^\uFEFF/, '');
    if (/flags? detected/.test(html.replace(/\/\/.*$/gm, ''))) problems.push(file + '-says-flags-detected');
  }
  const home = await readFile(resolve(cwd(), 'index.html'), 'utf8');
  const cards = [...home.matchAll(/card\('(\w+)',\s*'[^']*',\s*\d+,\s*\d+,\s*'([^']*)'/g)];
  if (cards.length !== 4) problems.push('hero-cards-found=' + cards.length);
  for (const [, risk, line] of cards) if (!SUMMARY_LINE.test(line)) problems.push('hero-' + risk + '-line="' + line + '"');
  return problems;
}

/* The live card of /demo for EVERY sample token of the try row (FARTCOIN, MEW, PIPPIN, HAWK...): the line under the score must say what the flags of its own Critical Flags
   panel are. The verdict of a live scan can vary from one day to the next, so the line is compared with the rows of the panel, not with a fixed text; a token that does not load
   in 12 s is skipped, and at least two must have been checked. */
async function summaryLineLive(page) {
  return page.evaluate(async () => {
    const roots = [...document.querySelectorAll('*')].filter((e) => e.shadowRoot).map((e) => e.shadowRoot);
    const sr = roots.find((r) => r.getElementById('ant-critical-flags-btn'));
    if (!sr) return ['no-overlay-found'];
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const names = [...document.querySelectorAll('.try-row button')].map((b) => b.textContent.trim()).filter(Boolean);
    const problems = [];
    let checked = 0;
    for (const name of names) {
      const button = [...document.querySelectorAll('.try-row button')].find((x) => x.textContent.trim() === name);
      const open = sr.querySelector('.cf-panel.open, .ai-panel.open');
      if (open) open.classList.remove('open', 'closing');
      button.click();
      let shown = false;
      for (let i = 0; i < 120 && !shown; i++) {
        await sleep(100);
        const tk = ((sr.querySelector('.tk') || {}).textContent || '').toUpperCase();
        shown = tk.includes(name.toUpperCase()) && /SAFE|CAUTION|DANGER|RUG/.test((sr.querySelector('.vb h1') || {}).textContent || '') && !!sr.querySelector('#ant-critical-flags-btn');
      }
      if (!shown) continue;
      await sleep(300);
      sr.getElementById('ant-critical-flags-btn').click();
      await sleep(250);
      const cf = sr.getElementById('ant-critical-flags');
      const crit = cf ? cf.querySelectorAll('.cf-flag-cr').length : 0, warn = cf ? cf.querySelectorAll('.cf-flag-wr').length : 0, n = crit + warn;
      const wanted = n === 0 ? 'No issues found' : crit === 0 ? warn + (warn === 1 ? ' warning' : ' warnings') + ' — no critical' : warn === 0 ? crit + (crit === 1 ? ' critical flag' : ' critical flags') : n + ' flags — ' + crit + ' critical';
      const said = ((sr.querySelector('.sum') || {}).textContent || '').trim();
      checked++;
      if (said !== wanted) problems.push(name + '-says-"' + said + '"-wanted-"' + wanted + '"');
      if (/detected/.test(said)) problems.push(name + '-says-detected');
    }
    const open = sr.querySelector('.cf-panel.open, .ai-panel.open');
    if (open) open.classList.remove('open', 'closing');
    if (checked < 2) problems.push('only-' + checked + '-token-checked');
    return problems;
  });
}

/* ── The row of the overlay card (Sell / Mint / Freeze / LP / Liq) ──────────────────────────────
   The overlay exists in three copies (the extension, the hero of / and the live demo on /demo). The row of its card is aligned by fractions of a
   pixel: the check, the cross, the dash and the liquidity figure share one line, and the figure is set in Bebas Neue whatever its colour. The extension
   proves it by MEASURING the ink in a real Chromium (npm run overlay:check in antares-extension). The two copies here are checked on the contract that
   makes it true, read from the page's COMPUTED styles with one cell of every kind inserted next to the real row: a copy that drifts (the green figure was
   pushed 1.5px and the others not, the figure was in the mono face, the cross was 1.5px low, the tick came out 1px taller because base.css resets
   box-sizing on * and not on its pseudo-elements) fails here. */
async function overlayRowContract(page) {
  return page.evaluate(() => {
    const roots = [document, ...[...document.querySelectorAll('*')].filter((e) => e.shadowRoot).map((e) => e.shadowRoot)];
    const ss = roots.map((r) => r.querySelector('.ss')).find(Boolean);
    if (!ss) return ['no-row-found'];
    const probe = document.createElement('div');
    probe.className = 'ss';
    probe.setAttribute('aria-hidden', 'true');
    probe.style.cssText = 'position:absolute;left:-9999px;top:0;width:420px';
    const cell = (label, html) => '<div class="si"><span>' + label + '</span>' + html + '</div>';
    probe.innerHTML =
      cell('a', '<b class="ok"></b>') + cell('b', '<b class="no"></b>') + cell('c', '<b class="dash">\u2014</b>') +
      cell('d', '<b class="liq y">$1M</b>') + cell('e', '<b class="liq n">$1</b>') + cell('f', '<b class="liq">$1K</b>') +
      cell('g', '<b class="y">x</b>') + cell('h', '<b class="n">x</b>') + cell('i', '<b class="w">x</b>');
    ss.parentNode.appendChild(probe);
    const problems = [];
    const get = (sel) => probe.querySelector(sel);
    const cs = (el, pseudo) => getComputedStyle(el, pseudo || null);
    for (const sel of ['b.liq.y', 'b.liq.n', 'b.liq:not(.y):not(.n)']) {
      const s = cs(get(sel));
      if (!/Bebas Neue/.test(s.fontFamily)) problems.push(sel + '-font=' + s.fontFamily);
      if (s.fontSize !== '11px') problems.push(sel + '-size=' + s.fontSize);
      const trimmed = CSS.supports('text-box', 'trim-both cap alphabetic');
      if (trimmed) {
        if (s.display !== 'inline-block' || s.marginTop !== '2px' || s.top !== '0px') problems.push(sel + '-trim=' + s.display + '/' + s.marginTop + '/' + s.top);
      } else if (s.position !== 'relative' || s.top !== '1.3px') problems.push(sel + '-push=' + s.position + '/' + s.top);
    }
    for (const cls of ['y', 'n', 'w']) {
      const s = cs(get('b.' + cls + ':not(.liq)'));
      if (s.position !== 'static') problems.push('colour-' + cls + '-moves-the-figure=' + s.position + '/' + s.top);
    }
    const dash = cs(get('b.dash'));
    if (dash.display !== 'inline-flex' || dash.width !== '12px' || dash.height !== '12px') problems.push('dash-box=' + dash.display + ' ' + dash.width + 'x' + dash.height);
    const bar = cs(get('b.dash'), '::before');
    if (bar.content === 'none' || bar.height !== '1px') problems.push('dash-bar=' + bar.content + ' ' + bar.height);
    if (cs(get('b.no')).top !== '-0.1px') problems.push('cross-top=' + cs(get('b.no')).top);
    if (cs(get('b.ok')).top !== '0px' && cs(get('b.ok')).top !== 'auto') problems.push('tick-top=' + cs(get('b.ok')).top);
    for (const sel of ['b.ok', 'b.no']) if (cs(get(sel), '::before').boxSizing !== 'border-box') problems.push(sel + '-pseudo-box-sizing=' + cs(get(sel), '::before').boxSizing);
    probe.remove();
    return problems;
  });
}

/* ── The two panels under the overlay card (Critical Flags, AI Summary) ─────────────────────────
   The live overlay of /demo is a copy of the extension's. Its panels were set in IBM Plex Mono (bold labels, italic explanations) while the rest of the card is
   Bebas Neue, and their round marks were a 14px CSS circle with a font character on it: on a screen scaled to 125 % that circle is 17.5 device pixels and came
   out 17 or 18 from one row to the next, with the symbol off centre. The extension proves its marks by MEASURING them in a real Chromium (npm run overlay:check in
   antares-extension, "panels"). This copy is checked on the contract that makes them right, with the real buttons: the titles of the panels (the name of each flag) are
   Bebas Neue at weight 400 and not italic (Bebas Neue has neither: the browser would fake them), the sentences (what a flag means, the AI summary, the empty states) are
   Oswald at weight 300 or 400 in lower case (Bebas Neue has capitals only; the owner's choice, 2026-10-21), and both faces are loaded; and every mark is ONE 16 x 16 drawing, a circle of radius 8 at the centre with its symbol
   laid out around the middle of that circle (the ink of the symbol is as far from the left as from the right, as far from the top as from the bottom). */
async function overlayPanelsContract(page) {
  return page.evaluate(async () => {
    const roots = [...document.querySelectorAll('*')].filter((e) => e.shadowRoot).map((e) => e.shadowRoot);
    const sr = roots.find((r) => r.getElementById('ant-critical-flags-btn'));
    if (!sr) return ['no-overlay-found'];
    const problems = [];
    // A token with flags (PIPPIN is a DANGER card with critical and warning flags): the marks and the explanations are only there when there is something to flag.
    const tokenButton = [...document.querySelectorAll('.try-row button')].find((x) => x.textContent.trim() === 'PIPPIN');
    let picked = false;
    if (tokenButton) {
      tokenButton.click();
      for (let i = 0; i < 100 && !picked; i++) { await new Promise((r) => setTimeout(r, 100)); picked = /DANGER/.test((sr.querySelector('.vb h1') || {}).textContent || '') && !!sr.querySelector('#ant-critical-flags-btn'); }
    }
    if (!picked) return ['could-not-show-a-token-with-flags'];
    const press = (id) => sr.getElementById(id).click();
    const open = () => sr.querySelector('.cf-panel.open, .ai-panel.open');
    if (open()) open().classList.remove('open', 'closing');
    const fontOf = (panel, label, sels) => {
      for (const sel of sels) for (const el of panel.querySelectorAll(sel)) {
        const s = getComputedStyle(el);
        if (!/Bebas Neue/.test(s.fontFamily)) problems.push(label + sel + '-font=' + s.fontFamily);
        if (s.fontWeight !== '400') problems.push(label + sel + '-weight=' + s.fontWeight);
        if (s.fontStyle !== 'normal') problems.push(label + sel + '-style=' + s.fontStyle);
      }
    };
    // the sentences: Oswald 300 or 400, not italic, lower case kept (no text-transform)
    const sentenceOf = (panel, label, sels) => {
      let found = 0;
      for (const sel of sels) for (const el of panel.querySelectorAll(sel)) {
        found++;
        const s = getComputedStyle(el);
        if (!/Oswald/.test(s.fontFamily)) problems.push(label + sel + '-font=' + s.fontFamily);
        if (s.fontWeight !== '300' && s.fontWeight !== '400') problems.push(label + sel + '-weight=' + s.fontWeight);
        if (s.fontStyle !== 'normal') problems.push(label + sel + '-style=' + s.fontStyle);
        if (s.textTransform !== 'none') problems.push(label + sel + '-transform=' + s.textTransform);
      }
      if (found === 0) problems.push(label + 'no-sentence-to-check');
    };
    const numbers = (d) => (d.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);

    press('ant-critical-flags-btn');
    const cf = sr.getElementById('ant-critical-flags');
    if (!cf || !cf.classList.contains('open')) problems.push('critical-flags-did-not-open');
    else {
      if (cf.querySelectorAll('.cf-flag-icon').length < 2) problems.push('no-flag-marks-to-check');
      // the line under the score says what the flags of the panel are
      const crit = cf.querySelectorAll('.cf-flag-cr').length, warn = cf.querySelectorAll('.cf-flag-wr').length, n = crit + warn;
      const wanted = n === 0 ? 'No issues found' : crit === 0 ? warn + (warn === 1 ? ' warning' : ' warnings') + ' — no critical' : warn === 0 ? crit + (crit === 1 ? ' critical flag' : ' critical flags') : n + ' flags — ' + crit + ' critical';
      const said = ((sr.querySelector('.sum') || {}).textContent || '').trim();
      if (n > 0 && said !== wanted) problems.push('summary-line="' + said + '"-wanted="' + wanted + '"');
      fontOf(cf, 'cf', ['.cf-flag-label']);
      sentenceOf(cf, 'cf', ['.cf-flag-desc']);
      const icons = [...cf.querySelectorAll('.cf-flag-icon')];
      for (const icon of icons) {
        const svg = icon.querySelector('svg');
        if (!svg) { problems.push('mark-not-drawn'); continue; }
        if (svg.getAttribute('viewBox') !== '0 0 16 16') problems.push('mark-viewBox=' + svg.getAttribute('viewBox'));
        const box = icon.getBoundingClientRect();
        if (Math.abs(box.width - 16) > 0.05 || Math.abs(box.height - 16) > 0.05) problems.push('mark-box=' + box.width + 'x' + box.height);
        const bg = svg.querySelector('circle.cf-mark-bg');
        if (!bg || bg.getAttribute('cx') !== '8' || bg.getAttribute('cy') !== '8' || bg.getAttribute('r') !== '8') problems.push('mark-circle-not-16px-centred');
        let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
        const grow = (x, y, r) => { x0 = Math.min(x0, x - r); x1 = Math.max(x1, x + r); y0 = Math.min(y0, y - r); y1 = Math.max(y1, y + r); };
        for (const dot of svg.querySelectorAll('circle.cf-mark-dot')) grow(+dot.getAttribute('cx'), +dot.getAttribute('cy'), +dot.getAttribute('r'));
        for (const path of svg.querySelectorAll('path.cf-mark-ink')) {
          const n = numbers(path.getAttribute('d') || '');
          for (let i = 0; i + 1 < n.length; i += 2) grow(n[i], n[i + 1], 0.75);
        }
        if (!(x1 > x0)) problems.push('mark-has-no-symbol');
        else if (Math.abs((x0 + x1) / 2 - 8) > 0.1 || Math.abs((y0 + y1) / 2 - 8) > 0.1) problems.push('mark-symbol-off-centre=' + ((x0 + x1) / 2).toFixed(2) + ',' + ((y0 + y1) / 2).toFixed(2));
      }
    }
    press('ant-ai-summary-btn');
    const ai = sr.getElementById('ant-ai-summary');
    if (!ai || !ai.classList.contains('open')) problems.push('ai-summary-did-not-open');
    else sentenceOf(ai, 'ai', ['.ai-panel-verdict', '.ai-panel-line']);
    await document.fonts.ready;
    const loaded = [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/["']/g, '') + ' ' + f.weight);
    for (const face of ['Bebas Neue 400', 'Oswald 300', 'Oswald 400']) if (!loaded.includes(face)) problems.push('font-not-loaded=' + face);
    if (open()) open().classList.remove('open', 'closing'); // the page is left as it was found
    return problems;
  });
}

/* ── runner ─────────────────────────────────────────────────────── */

const browser = await chromium.launch();
let totalFailures = 0;
const allResults = [];

for (const vpKey of VIEWPORTS_TO_RUN) {
  const cfg = VIEWPORTS[vpKey];
  console.log('');
  console.log(`════ ${cfg.label.toUpperCase()} (${cfg.viewport.width}×${cfg.viewport.height}) ════`);
  if (remoteBase) {
    console.log(`Source: ${base}${bypassToken ? ' (with bypass token)' : ''}`);
  } else {
    console.log(`Source: ${base}`);
  }

  const ctx = await browser.newContext({
    viewport: cfg.viewport,
    deviceScaleFactor: cfg.deviceScaleFactor,
    isMobile: cfg.isMobile,
    hasTouch: cfg.hasTouch,
    userAgent: cfg.userAgent,
    extraHTTPHeaders,
  });

  for (const route of ROUTES) {
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push({ kind: 'pageerror', msg: String(e.message || e) }));
    page.on('console', m => {
      if (m.type() === 'error' && !IGNORE_ERRORS.test(m.text())) {
        errors.push({ kind: 'console', msg: m.text() });
      }
    });

    let result = { route, viewport: vpKey, status: 'PASS', fails: [], errors: [] };
    try {
      await page.goto(base + route, { waitUntil: 'load', timeout: 30_000 });
      await page.waitForTimeout(800);

      /* Per-route async-render waits. Some pages hydrate UI from
         fetch() responses, and we'd rather let that settle before
         axe scans than catch the half-rendered intermediate state. */
      if (route === '/demo') {
        // Demo embeds the Antares overlay widget which renders
        // ~14 buttons after a scan-API fetch. Wait for the widget's
        // close button (#ant-close) or give up after 4s.
        try {
          await page.waitForSelector('#ant-close', { timeout: 4000 });
        } catch { /* widget didn't render in time; let axe see what's there */ }
      }

      const audit = vpKey === 'mobile'
        ? await auditMobile(page, route)
        : await auditDesktop(page, route);

      result.fails = audit.fails;
      result.probe = audit.probe;

      /* axe-core a11y scan — fails on critical or serious violations.
         Runs once per route per viewport.

         Why we disable color-contrast:
           The codebase ships a deliberately moody dark palette with
           dozens of low-contrast accent labels (#3a3a40 timestamps,
           #5a5a62 captions, etc.). axe flags 100+ such nodes per
           page; fixing them all is a visual redesign, not a CI fix.
           ARCHITECTURE.md §9 documents this as a known gap. axe's
           OTHER rules (missing alt, bad ARIA, keyboard traps,
           non-focusable scroll regions) still gate the audit. */
      if (!skipAxe) {
        const axe = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .disableRules(['color-contrast'])
          // Third-party iframes (the demo's dexscreener chart) aren't
          // our responsibility — they ship their own a11y debt.
          .exclude('iframe')
          .analyze();
        const seriousViolations = axe.violations.filter(
          v => v.impact === 'critical' || v.impact === 'serious'
        );
        if (seriousViolations.length) {
          for (const v of seriousViolations) {
            result.fails.push(`a11y:${v.id} (${v.impact}, ${v.nodes.length} node${v.nodes.length === 1 ? '' : 's'})`);
          }
          result.axeViolations = seriousViolations.map(v => ({
            id: v.id, impact: v.impact, help: v.help,
            nodeTargets: v.nodes.map(n => n.target.join(' ')).slice(0, 5),
          }));
        }
      }
    } catch (e) {
      result.fails.push(`navigation-error: ${e.message}`);
    }

    if (errors.length) result.fails.push(`js-errors=${errors.length}`);
    result.errors = errors.map(e => ({ kind: e.kind, msg: e.msg.slice(0, 200) }));
    if (result.fails.length) {
      result.status = 'FAIL';
      totalFailures++;
    }

    const icon = result.status === 'PASS' ? '✓' : '✗';
    console.log(`${icon} ${vpKey.padEnd(7)} ${route.padEnd(12)} ${result.fails.join(', ') || 'ok'}`);
    for (const e of (result.errors || []).slice(0, 2)) {
      console.log(`     [${e.kind}] ${e.msg.slice(0, 160)}`);
    }
    for (const v of (result.axeViolations || [])) {
      for (const t of v.nodeTargets) {
        console.log(`     [axe:${v.id}] ${t}`);
      }
    }

    allResults.push(result);
    await page.close();
  }

  await ctx.close();
}

await browser.close();
if (server) server.close();

console.log('');
console.log(
  `Result: ${allResults.length - totalFailures}/${allResults.length} passed ` +
  `(${VIEWPORTS_TO_RUN.length} viewport${VIEWPORTS_TO_RUN.length > 1 ? 's' : ''} × ${ROUTES.length} routes)`
);

if (wantJson) {
  console.log('---JSON---');
  console.log(JSON.stringify(allResults, null, 2));
}

exit(totalFailures === 0 ? 0 : 1);

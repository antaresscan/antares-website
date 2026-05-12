/* ──────────────────────────────────────────────────────────────────
   js/a11y.js
   ──────────────────────────────────────────────────────────────────
   Accessibility helpers that are easier to inject at runtime than to
   thread through 20 hand-maintained HTML pages.

     1. Skip-link
        Injects <a class="skip-link" href="#main">Skip to content</a>
        as the first focusable element of <body>. Hidden off-screen
        until focused (CSS in css/base.css). Tabbing once from page
        load reveals it; pressing Enter jumps to <main>.

     2. Focusable scroll regions
        Any element that ends up with horizontal overflow at runtime
        (mobile main table, /api code blocks, etc.) needs tabindex=0
        so keyboard users can focus it and arrow-scroll. We sweep
        the DOM, find scrollWidth > clientWidth elements, and tag
        them. axe's `scrollable-region-focusable` rule enforces this.

   Why this lives in JS:
       Adding `<a class="skip-link">…</a>` + `id="main"` + tabindex
       attributes to every page would mean dozens of hand-edits, with
       #146-style "forgot one" risk. This runs once per page on
       DOMContentLoaded, idempotently.

   Load order:
       <script src="/js/a11y.js" defer></script>
   ────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  function init() {
    injectSkipLink();
    tagScrollableRegions();
  }

  function injectSkipLink() {
    var main = document.querySelector('main');
    if (!main) return;                            // 404, og-generator
    if (document.querySelector('.skip-link')) return; // idempotent

    // Make <main> programmatically focusable so the skip-link can
    // hand focus over. tabindex=-1 means "focusable via JS only, not
    // in the natural tab order".
    if (!main.hasAttribute('tabindex')) main.setAttribute('tabindex', '-1');
    if (!main.id) main.id = 'main';

    var link = document.createElement('a');
    link.className = 'skip-link';
    link.href = '#' + main.id;
    link.textContent = 'Skip to content';
    // When the user activates the link, also explicitly call .focus()
    // on <main>. Some browsers don't focus the target after a hash
    // navigation even when tabindex is set; this guarantees it.
    link.addEventListener('click', function (e) {
      e.preventDefault();
      // The hash change still happens so back-button history is sane.
      history.replaceState(null, '', '#' + main.id);
      main.focus({ preventScroll: false });
      main.scrollIntoView({ behavior: 'auto', block: 'start' });
    });

    document.body.insertBefore(link, document.body.firstChild);
  }

  function tagScrollableRegions() {
    // Run after a tick so layout has settled. The candidates we care
    // about are elements with an `overflow*` rule that ACTUALLY end
    // up scrolling (scrollWidth > clientWidth). Static-looking <pre>
    // blocks that don't overflow at the current viewport are left
    // alone; we only burn tabindex on regions that need it.
    setTimeout(function () {
      var candidates = document.querySelectorAll(
        'pre, main table, [style*="overflow-x"], [style*="overflow:"], [style*="overflow :"]'
      );
      candidates.forEach(function (el) {
        if (el.hasAttribute('tabindex')) return;
        var cs = getComputedStyle(el);
        var canScroll = (cs.overflowX === 'auto' || cs.overflowX === 'scroll') &&
                        el.scrollWidth > el.clientWidth + 1;
        if (canScroll) {
          el.setAttribute('tabindex', '0');
          // Give it a role + aria-label so screen readers announce
          // it as a scrollable region rather than reading every cell.
          if (!el.hasAttribute('role')) el.setAttribute('role', 'region');
          if (!el.hasAttribute('aria-label')) {
            el.setAttribute('aria-label', 'Scrollable content');
          }
        }
      });
    }, 200);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

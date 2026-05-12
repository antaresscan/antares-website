#!/usr/bin/env node
/* ──────────────────────────────────────────────────────────────────
   scripts/regenerate-changelog.mjs
   ──────────────────────────────────────────────────────────────────
   Regenerates CHANGELOG.md from git history. Groups commits by
   month, sorted newest-first. Filters to conventional-commit
   prefixes (feat / fix / perf / refactor / docs / style / test /
   chore / build / ci) so internal/squashed work-in-progress
   commits don't appear.

   Usage:
     node scripts/regenerate-changelog.mjs

   Output:
     Overwrites CHANGELOG.md at the repo root.
   ────────────────────────────────────────────────────────────────── */
import { execSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cwd, exit } from 'node:process';

// Tab is unlikely to appear inside a commit subject so it makes a
// safe field separator.
const SEP = '\t';
const FORMAT = `%h${SEP}%cs${SEP}%s`;

const ALLOWED_PREFIXES = [
  'feat', 'fix', 'perf', 'refactor', 'docs', 'style',
  'test', 'chore', 'build', 'ci', 'revert',
];

const prefixRe = new RegExp(`^(${ALLOWED_PREFIXES.join('|')})(\\([^)]*\\))?:`);

let rawLog;
try {
  rawLog = execSync(`git log --no-merges --format="${FORMAT}"`, {
    cwd: cwd(), encoding: 'utf8', maxBuffer: 10 * 1024 * 1024,
  });
} catch (e) {
  console.error(`Error reading git log: ${e.message}`);
  exit(1);
}

const entries = [];
for (const line of rawLog.split('\n')) {
  if (!line.trim()) continue;
  const [hash, date, ...rest] = line.split(SEP);
  const subject = rest.join(SEP);
  if (!prefixRe.test(subject)) continue;          // ignore non-conventional commits
  // YYYY-MM key for grouping.
  const month = date.slice(0, 7);
  entries.push({ hash, date, subject, month });
}

// Group by month, descending.
const byMonth = new Map();
for (const e of entries) {
  if (!byMonth.has(e.month)) byMonth.set(e.month, []);
  byMonth.get(e.month).push(e);
}
const months = [...byMonth.keys()].sort().reverse();

const today = new Date().toISOString().slice(0, 10);
const lines = [
  '# Changelog',
  '',
  '_Auto-generated from `git log` by `scripts/regenerate-changelog.mjs`._',
  `_Last regenerated: ${today}._`,
  '',
];

for (const m of months) {
  // Render month as e.g. "May 2026".
  const [y, mm] = m.split('-');
  const dt = new Date(Number(y), Number(mm) - 1, 1);
  const label = dt.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  lines.push(`## ${label}`, '');
  for (const e of byMonth.get(m)) {
    // Pull a PR number out of `… (#123)` if present.
    const prMatch = e.subject.match(/\(#(\d+)\)\s*$/);
    const prSuffix = prMatch ? ` ([#${prMatch[1]}])` : '';
    const subject = e.subject.replace(/\s*\(#\d+\)\s*$/, '');
    lines.push(`- ${e.date} — ${subject} \`${e.hash}\`${prSuffix}`);
  }
  lines.push('');
}

const out = lines.join('\n');
await writeFile(join(cwd(), 'CHANGELOG.md'), out);
console.log(`Wrote CHANGELOG.md (${entries.length} commits across ${months.length} months).`);
exit(0);

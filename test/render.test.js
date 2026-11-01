import test from 'node:test';
import assert from 'node:assert/strict';
import { computeStats } from '../src/stats.js';
import { escapeHtml, renderHtml } from '../src/render.js';

const NOW = new Date(Date.UTC(2024, 4, 20));

function fixtures() {
  const mk = (iso, author, added, deleted, path) => {
    const [d, hour] = iso.split(' ');
    const [y, m, day] = d.split('-').map(Number);
    return {
      hash: Math.random().toString(16).slice(2, 9),
      author,
      email: `${author}@example.com`,
      date: new Date(Date.UTC(y, m - 1, day, Number(hour))),
      subject: `edited ${path}`,
      added,
      deleted,
      files: [{ path, added, deleted, binary: false }],
    };
  };
  return [
    mk('2024-05-13 09', 'Ada', 120, 4, 'src/core.js'),
    mk('2024-05-14 11', 'Grace', 30, 8, 'src/cli.js'),
    mk('2024-05-15 14', 'Ada', 9, 1, 'README.md'),
    mk('2024-05-16 20', 'Lin', 2, 2, 'src/core.js'),
  ];
}

function render(overrides = {}) {
  const commits = fixtures();
  const stats = computeStats(commits, { weeks: 8, now: NOW });
  return renderHtml({ name: 'demo-repo', branch: 'main', stats, generatedAt: NOW, ...overrides });
}

test('escapeHtml covers the five characters', () => {
  assert.equal(escapeHtml('<a href="x">&\'</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;');
});

test('renders a standalone document', () => {
  const html = render();
  assert.match(html, /^<!doctype html>/);
  assert.match(html, /<html lang="en">/);
  assert.match(html, /<meta name="viewport"/);
  assert.match(html, /<title>demo-repo/);
  assert.ok(html.trimEnd().endsWith('</html>'));
});

test('the document needs no network, scripts or webfonts', () => {
  const html = render();
  assert.doesNotMatch(html, /<script/i);
  assert.doesNotMatch(html, /<link\b/i);
  assert.doesNotMatch(html, /@import/i);
  assert.doesNotMatch(html, /url\(\s*['"]?https?:/i);
  assert.doesNotMatch(html, /\bsrc=/i);
  assert.doesNotMatch(html, /fonts\.(googleapis|gstatic)/i);
});

test('user-controlled text is escaped everywhere', () => {
  const commits = fixtures();
  const stats = computeStats(commits, { weeks: 4, now: NOW });
  stats.topFiles[0].path = 'evil<script>alert(1)</script>.js';
  stats.authors[0].name = 'Mallory <img src=x onerror=alert(1)>';
  const html = renderHtml({ name: '<b>repo</b>', branch: 'main', stats, generatedAt: NOW });
  assert.doesNotMatch(html, /<script>alert/);
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /&lt;b&gt;repo&lt;\/b&gt;/);
});

test('one bar per week and 24x7 heat cells', () => {
  const commits = fixtures();
  const stats = computeStats(commits, { weeks: 12, now: NOW });
  const html = renderHtml({ name: 'x', branch: 'main', stats, generatedAt: NOW });
  assert.equal((html.match(/class="bar[" ]/g) || []).length, 12);
  assert.equal((html.match(/class="cell"/g) || []).length, 168);
});

test('keeps its accessibility contract', () => {
  const html = render();
  assert.match(html, /:focus-visible/);
  assert.match(html, /prefers-reduced-motion/);
  assert.match(html, /overflow-x: clip/);
  assert.doesNotMatch(html, /transition:\s*all/);
  assert.doesNotMatch(html, /outline:\s*none/);
});

test('colours come from tokens, not literals in the markup', () => {
  const html = render();
  const body = html.slice(html.indexOf('<body>'));
  assert.doesNotMatch(body, /#[0-9a-f]{3,8}\b/i);
  assert.doesNotMatch(body, /\brgba?\(/i);
});

test('empty history still produces a page', () => {
  const stats = computeStats([], { now: NOW });
  const html = renderHtml({ name: 'empty', branch: 'main', stats, generatedAt: NOW });
  assert.match(html, /no history/);
  assert.match(html, /<\/html>/);
});

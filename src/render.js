/**
 * Renders the whole dashboard as one self-contained HTML document.
 * No scripts, no webfonts, no external assets — it opens offline.
 */

const nf = new Intl.NumberFormat('en-US');

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function num(n) {
  return nf.format(n);
}

function pct(part, total) {
  if (!total) return 0;
  return Math.round((part / total) * 1000) / 10;
}

const CSS = `
:root {
  color-scheme: dark;
  --bg: #0a0a0c;
  --surface: #121216;
  --surface-2: #17171c;
  --border: #26262e;
  --text: #ececf1;
  --muted: #8f8f9d;
  --accent: #d9a066;
  --good: #7fa650;
  --bad: #bf5f52;
  --font-sans: "Segoe UI", system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif;
  --font-mono: ui-monospace, "Cascadia Mono", "SFMono-Regular", Menlo, Consolas, monospace;
  --measure: 1180px;
  --gap: 20px;
  --radius: 14px;
}

* { box-sizing: border-box; }

html, body { overflow-x: clip; }

body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-sans);
  font-size: 16px;
  line-height: 1.55;
  -webkit-font-smoothing: antialiased;
}

.wrap {
  max-width: var(--measure);
  margin-inline: auto;
  padding: clamp(28px, 5vw, 56px) clamp(18px, 4vw, 48px) 64px;
}

a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; }
a:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; border-radius: 4px; }

.hero { padding-bottom: 30px; border-bottom: 1px solid var(--border); }
h1 {
  margin: 0 0 10px;
  font-size: clamp(2rem, 5vw, 3.4rem);
  line-height: 1.02;
  letter-spacing: -0.035em;
  font-weight: 650;
  overflow-wrap: break-word;
  min-width: 0;
}
.meta { display: flex; flex-wrap: wrap; gap: 10px 18px; color: var(--muted); font-size: 0.95rem; }
.meta span { display: inline-flex; align-items: center; gap: 8px; }
.meta span + span::before { content: ""; width: 1px; height: 13px; background: var(--border); }

.kpis {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: var(--gap);
  margin: 34px 0 8px;
}
.kpi { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 18px 20px; }
.kpi b {
  display: block;
  font-family: var(--font-mono);
  font-size: clamp(1.5rem, 2.4vw, 2rem);
  font-weight: 600;
  letter-spacing: -0.02em;
  line-height: 1.1;
}
.kpi span { display: block; margin-top: 6px; color: var(--muted); font-size: 0.85rem; }

section { margin-top: 40px; }
h2 {
  margin: 0 0 16px;
  font-size: 1.06rem;
  font-weight: 600;
  letter-spacing: -0.01em;
}
h2 em { font-style: normal; color: var(--muted); font-weight: 400; }

.panel { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 22px; }

.bars { display: grid; grid-template-columns: repeat(var(--cols), minmax(0, 1fr)); gap: 2px; align-items: end; height: 150px; border-bottom: 1px solid var(--border); }
.bar { background: var(--accent); opacity: 0.78; border-radius: 2px 2px 0 0; min-height: 2px; }
.bar.empty { background: transparent; min-height: 0; }
.bar:hover { opacity: 1; }
.axis { display: flex; justify-content: space-between; gap: 16px; margin-top: 10px; color: var(--muted); font-size: 0.78rem; font-family: var(--font-mono); }

.heat { display: grid; grid-template-columns: 40px repeat(24, minmax(0, 22px)); gap: 3px; align-items: center; justify-content: start; }
.heat .rowlabel { color: var(--muted); font-size: 0.75rem; text-align: right; padding-right: 6px; }
.cell { aspect-ratio: 1 / 1; border-radius: 3px; background: color-mix(in srgb, var(--accent) var(--mix, 0%), var(--surface-2)); }
.heat .hourlabel { color: var(--muted); font-size: 0.7rem; font-family: var(--font-mono); text-align: center; }
.legend { display: flex; align-items: center; gap: 8px; margin-top: 14px; color: var(--muted); font-size: 0.75rem; }
.swatch { width: 12px; height: 12px; border-radius: 3px; display: inline-block; background: color-mix(in srgb, var(--accent) var(--mix, 0%), var(--surface-2)); }

.cols { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: var(--gap); align-items: stretch; }
.cols > section { display: flex; flex-direction: column; min-width: 0; }
.cols > section > .panel { flex: 1; }
@media (max-width: 860px) { .cols { grid-template-columns: minmax(0, 1fr); } }

.rows { display: flex; flex-direction: column; gap: 14px; }
.row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 12px; padding: 6px 0 0; align-items: center; }
.row .name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: var(--font-mono); font-size: 0.86rem; }
.row .val { color: var(--muted); font-family: var(--font-mono); font-size: 0.82rem; white-space: nowrap; }
.track { grid-column: 1 / -1; height: 3px; border-radius: 2px; background: var(--surface-2); overflow: hidden; margin-top: 8px; }
.track i { display: block; height: 100%; background: var(--accent); opacity: 0.6; }

.authors .row { grid-template-columns: minmax(0, 1fr) auto; }
.authors .who { min-width: 0; }
.authors .who b { display: block; font-weight: 500; font-size: 0.92rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.authors .who span { color: var(--muted); font-size: 0.78rem; }

.commits { display: flex; flex-direction: column; }
.commit { display: grid; grid-template-columns: 74px minmax(0, 1fr) auto; gap: 14px; padding: 10px 0; border-top: 1px solid var(--border); align-items: baseline; }
.commit:first-child { border-top: 0; }
.commit code { color: var(--muted); font-family: var(--font-mono); font-size: 0.8rem; }
.commit p { margin: 0; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.92rem; }
.commit .when { color: var(--muted); font-size: 0.78rem; font-family: var(--font-mono); white-space: nowrap; }

.bus { display: flex; align-items: baseline; gap: 12px; margin-top: 18px; padding-top: 16px; border-top: 1px solid var(--border); }
.bus b { font-family: var(--font-mono); font-size: 1.6rem; color: var(--accent); }
.bus span { color: var(--muted); font-size: 0.88rem; }

footer { margin-top: 56px; padding-top: 20px; border-top: 1px solid var(--border); color: var(--muted); font-size: 0.8rem; display: flex; flex-wrap: wrap; gap: 8px 18px; }
footer span + span::before { content: ""; display: inline-block; width: 1px; height: 11px; background: var(--border); margin-right: 18px; vertical-align: -1px; }

.panel { animation: rise 480ms cubic-bezier(0.2, 0.7, 0.3, 1) both; }
@keyframes rise { from { opacity: 0; transform: translateY(8px); } }
@media (prefers-reduced-motion: reduce) { .panel { animation: none; } }
`;

function barsMarkup(weekly) {
  const max = Math.max(1, ...weekly.map((w) => w.commits));
  const bars = weekly
    .map((w) => {
      if (!w.commits) return '<div class="bar empty" title="' + escapeHtml(`${w.label}: no commits`) + '"></div>';
      const h = Math.max(4, Math.round((w.commits / max) * 100));
      return `<div class="bar" style="height:${h}%" title="${escapeHtml(`${w.label}: ${num(w.commits)} commits`)}"></div>`;
    })
    .join('');
  const first = weekly[0]?.label ?? '';
  const last = weekly[weekly.length - 1]?.label ?? '';
  const peak = Math.max(0, ...weekly.map((w) => w.commits));
  return `<div class="bars" style="--cols:${weekly.length}">${bars}</div>
    <div class="axis"><span>${escapeHtml(first)}</span><span>peak ${num(peak)} per week</span><span>${escapeHtml(last)}</span></div>`;
}

function heatMarkup(heat) {
  const max = Math.max(1, ...heat.flat());
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const cells = [];
  cells.push('<div></div>');
  for (let h = 0; h < 24; h++) {
    cells.push(`<div class="hourlabel">${h % 6 === 0 ? h : ''}</div>`);
  }
  heat.forEach((row, d) => {
    cells.push(`<div class="rowlabel">${days[d]}</div>`);
    row.forEach((count) => {
      const mix = count ? Math.max(8, Math.round((count / max) * 100)) : 0;
      cells.push(`<div class="cell" style="--mix:${mix}%" title="${escapeHtml(`${days[d]}, ${count} commit${count === 1 ? '' : 's'}`)}"></div>`);
    });
  });
  return `<div class="heat">${cells.join('')}</div>
    <div class="legend"><i class="swatch" style="--mix:4%"></i><span>fewer commits</span><i class="swatch" style="--mix:100%"></i><span>more commits</span></div>`;
}

function filesMarkup(topFiles) {
  if (!topFiles.length) return '<p class="meta">No file changes recorded.</p>';
  const max = Math.max(1, ...topFiles.map((f) => f.added + f.deleted));
  return `<div class="rows">${topFiles
    .map((f) => {
      const delta = [
        f.added ? `<span style="color:var(--good)">+${num(f.added)}</span>` : '',
        f.deleted ? `<span style="color:var(--bad)">−${num(f.deleted)}</span>` : '',
      ].join(' ');
      return `<div>
    <div class="row">
      <span class="name" title="${escapeHtml(f.path)}">${escapeHtml(f.path)}</span>
      <span class="val">${delta}</span>
    </div>
    <div class="track"><i style="width:${Math.max(2, Math.round(((f.added + f.deleted) / max) * 100))}%"></i></div>
  </div>`;
    })
    .join('')}</div>`;
}

function authorsMarkup(stats) {
  const total = stats.totalCommits || 1;
  const shown = stats.authors.slice(0, 10);
  const rest = stats.authors.length - shown.length;
  const rows = shown
    .map(
      (a) => `<div>
    <div class="row">
      <span class="who"><b>${escapeHtml(a.name)}</b><span>${num(a.commits)} commits</span></span>
      <span class="val">${pct(a.commits, total)}%</span>
    </div>
    <div class="track"><i style="width:${Math.max(2, Math.round((a.commits / shown[0].commits) * 100))}%"></i></div>
  </div>`,
    )
    .join('');
  const more = rest > 0 ? `<p class="meta" style="margin-top:12px">and ${num(rest)} more contributor${rest === 1 ? '' : 's'}</p>` : '';
  return `<div class="rows authors">${rows}</div>${more}`;
}

function commitsMarkup(list) {
  if (!list.length) return '';
  return `<div class="commits">${list
    .map(
      (c) => `<div class="commit">
      <code>${escapeHtml(c.hash)}</code>
      <p title="${escapeHtml(c.subject)}">${escapeHtml(c.subject)}</p>
      <span class="when">${escapeHtml(c.date)} · ${num(c.lines)} lines</span>
    </div>`,
    )
    .join('')}</div>`;
}

export function renderHtml({ name, branch, stats, generatedAt = new Date(), source = null }) {
  const s = stats;
  const range = s.firstCommit && s.lastCommit ? `${s.firstCommit} → ${s.lastCommit}` : 'no history';
  const metaBits = [];
  if (branch) metaBits.push(`<span>${escapeHtml(branch)}</span>`);
  metaBits.push(`<span>${escapeHtml(range)}</span>`);
  metaBits.push(`<span>${num(s.totalCommits)} commits</span>`);
  if (s.authors.length) metaBits.push(`<span>${num(s.authors.length)} author${s.authors.length === 1 ? '' : 's'}</span>`);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(name)} · git pulse</title>
<meta name="description" content="Commit history, churn and contributor report for ${escapeHtml(name)}.">
<style>${CSS}</style>
</head>
<body>
<div class="wrap">
  <header class="hero">
    <h1>${escapeHtml(name)}</h1>
    <div class="meta">${metaBits.join('')}</div>
  </header>

  <div class="kpis">
    <div class="kpi"><b>${num(s.totalCommits)}</b><span>commits</span></div>
    <div class="kpi"><b>${num(s.filesTouched)}</b><span>files touched</span></div>
    <div class="kpi"><b><span style="color:var(--good)">+${num(s.additions)}</span></b><span>lines added</span></div>
    <div class="kpi"><b><span style="color:var(--bad)">${s.deletions ? `−${num(s.deletions)}` : '0'}</span></b><span>lines removed</span></div>
    <div class="kpi"><b>${num(s.activeWeeks)}</b><span>active weeks</span></div>
  </div>

  <section>
    <h2>Commits per week <em>last ${s.weekly.length} weeks</em></h2>
    <div class="panel">${barsMarkup(s.weekly)}</div>
  </section>

  <section>
    <h2>When work happens <em>weekday by hour, whole history</em></h2>
    <div class="panel">${heatMarkup(s.heat)}</div>
  </section>

  <div class="cols">
    <section>
      <h2>Most churned files</h2>
      <div class="panel">${filesMarkup(s.topFiles)}</div>
    </section>
    <section>
      <h2>Contributors</h2>
      <div class="panel">
        ${authorsMarkup(s)}
        <div class="bus"><b>${s.busFactor}</b><span>${s.busFactor === 1 ? 'person carries half the history' : 'people carry half the history'}</span></div>
      </div>
    </section>
  </div>

  <section>
    <h2>Largest changes</h2>
    <div class="panel">${commitsMarkup(s.biggestCommits)}</div>
  </section>

  <footer>
    <span>gitpulse · generated ${escapeHtml(generatedAt.toISOString().slice(0, 10))}</span>
    <span>${num(s.repoWeeks)} weeks of history</span>
    ${source ? `<span>${escapeHtml(source)}</span>` : ''}
    <span>runs locally, nothing uploaded</span>
  </footer>
</div>
</body>
</html>
`;
}

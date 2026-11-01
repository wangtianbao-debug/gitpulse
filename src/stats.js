const DAY = 24 * 60 * 60 * 1000;
export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Monday 00:00 UTC of the week containing `date`. */
export function weekStart(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const offset = (d.getUTCDay() + 6) % 7;
  return new Date(d.getTime() - offset * DAY);
}

export function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function shortLabel(date, now) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const label = `${months[date.getUTCMonth()]} ${date.getUTCDate()}`;
  return date.getUTCFullYear() === now.getUTCFullYear() ? label : `${label} ${date.getUTCFullYear()}`;
}

/**
 * Aggregate parsed commits into everything the dashboard renders.
 *
 * @param {Array} commits output of parseLog()
 * @param {{weeks?: number, now?: Date}} opts
 */
export function computeStats(commits, { weeks = 52, now = new Date() } = {}) {
  const total = commits.length;
  const empty = {
    totalCommits: 0,
    authors: [],
    additions: 0,
    deletions: 0,
    filesTouched: 0,
    weekly: [],
    topFiles: [],
    heat: Array.from({ length: 7 }, () => Array(24).fill(0)),
    busFactor: 0,
    firstCommit: null,
    lastCommit: null,
    activeWeeks: 0,
    streakWeeks: 0,
    biggestCommits: [],
    repoWeeks: 0,
  };
  if (!total) return empty;

  const firstCommit = commits[0].date;
  const lastCommit = commits[total - 1].date;

  // Authors -----------------------------------------------------------------
  const byAuthor = new Map();
  let additions = 0;
  let deletions = 0;
  const fileMap = new Map();
  const heat = Array.from({ length: 7 }, () => Array(24).fill(0));

  for (const c of commits) {
    additions += c.added;
    deletions += c.deleted;
    const key = c.email || c.author;
    const entry = byAuthor.get(key) || { name: c.author, email: c.email, commits: 0, added: 0, deleted: 0 };
    entry.commits++;
    entry.added += c.added;
    entry.deleted += c.deleted;
    byAuthor.set(key, entry);

    const weekday = (c.date.getUTCDay() + 6) % 7; // Monday-first
    heat[weekday][c.date.getUTCHours()]++;

    for (const f of c.files) {
      const e = fileMap.get(f.path) || { path: f.path, added: 0, deleted: 0, commits: 0 };
      e.added += f.added;
      e.deleted += f.deleted;
      e.commits++;
      fileMap.set(f.path, e);
    }
  }

  const authors = [...byAuthor.values()]
    .sort((a, b) => b.commits - a.commits || a.name.localeCompare(b.name))
    .map((a) => ({ ...a, share: a.commits / total }));

  // Bus factor: how many people make up 50% of the commits.
  let cumulative = 0;
  let busFactor = 0;
  for (const a of authors) {
    cumulative += a.share;
    busFactor++;
    if (cumulative >= 0.5) break;
  }

  // Weekly buckets ----------------------------------------------------------
  const currentWeek = weekStart(now);
  const buckets = new Map();
  for (let i = weeks - 1; i >= 0; i--) {
    const start = new Date(currentWeek.getTime() - i * 7 * DAY);
    buckets.set(isoDate(start), { start, commits: 0, added: 0, deleted: 0 });
  }

  let activeWeeks = 0;
  for (const c of commits) {
    const key = isoDate(weekStart(c.date));
    const bucket = buckets.get(key);
    if (!bucket) continue;
    if (bucket.commits === 0) activeWeeks++;
    bucket.commits++;
    bucket.added += c.added;
    bucket.deleted += c.deleted;
  }

  const weekly = [...buckets.values()].map((b) => ({
    start: isoDate(b.start),
    label: shortLabel(b.start, now),
    commits: b.commits,
    added: b.added,
    deleted: b.deleted,
  }));

  // Streaks over all weeks that actually contain commits.
  const allWeeks = [...new Set(commits.map((c) => isoDate(weekStart(c.date))))].sort();
  let streakWeeks = allWeeks.length ? 1 : 0;
  let best = streakWeeks;
  for (let i = 1; i < allWeeks.length; i++) {
    const prev = new Date(`${allWeeks[i - 1]}T00:00:00Z`).getTime();
    const cur = new Date(`${allWeeks[i]}T00:00:00Z`).getTime();
    streakWeeks = cur - prev === 7 * DAY ? streakWeeks + 1 : 1;
    best = Math.max(best, streakWeeks);
  }

  const topFiles = [...fileMap.values()]
    .sort((a, b) => b.added + b.deleted - (a.added + a.deleted) || b.commits - a.commits)
    .slice(0, 12);

  const biggestCommits = [...commits]
    .sort((a, b) => b.added + b.deleted - (a.added + a.deleted))
    .slice(0, 6)
    .map((c) => ({
      hash: c.hash.slice(0, 7),
      subject: c.subject,
      author: c.author,
      date: isoDate(c.date),
      lines: c.added + c.deleted,
    }));

  return {
    totalCommits: total,
    authors,
    additions,
    deletions,
    filesTouched: fileMap.size,
    weekly,
    topFiles,
    heat,
    busFactor,
    firstCommit: isoDate(firstCommit),
    lastCommit: isoDate(lastCommit),
    activeWeeks,
    streakWeeks: best,
    biggestCommits,
    repoWeeks: allWeeks.length,
  };
}

/** Parse ISO `--since` values (also accepts "12 weeks ago" style input from git). */
export function parseSince(value, now = new Date()) {
  if (!value) return null;
  const rel = /^(\d+)\s*(day|days|week|weeks|month|months|year|years)\s+ago$/i.exec(value.trim());
  if (rel) {
    const n = Number(rel[1]);
    const unit = rel[2].toLowerCase().replace(/s$/, '');
    const days = { day: 1, week: 7, month: 30, year: 365 }[unit] * n;
    return isoDate(new Date(now.getTime() - days * DAY));
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return value.trim();
  return value;
}

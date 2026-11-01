import test from 'node:test';
import assert from 'node:assert/strict';
import { computeStats, weekStart, isoDate } from '../src/stats.js';

function commit(iso, added = 0, deleted = 0, files = []) {
  const [datePart, hour = '12'] = iso.split(' ');
  const [y, m, d] = datePart.split('-').map(Number);
  return {
    hash: 'h',
    author: 'Ada',
    email: 'ada@example.com',
    date: new Date(Date.UTC(y, m - 1, d, Number(hour))),
    subject: 'work',
    added,
    deleted,
    files: files.map((p) => ({ path: p, added, deleted, binary: false })),
  };
}

test('weekStart snaps back to Monday', () => {
  // 2024-05-15 is a Wednesday
  assert.equal(isoDate(weekStart(new Date(Date.UTC(2024, 4, 15, 10)))), '2024-05-13');
  // 2024-05-13 is a Monday: no movement
  assert.equal(isoDate(weekStart(new Date(Date.UTC(2024, 4, 13)))), '2024-05-13');
  // Sunday belongs to the week that started six days earlier
  assert.equal(isoDate(weekStart(new Date(Date.UTC(2024, 4, 19)))), '2024-05-13');
});

test('empty history returns a zeroed shape', () => {
  const s = computeStats([]);
  assert.equal(s.totalCommits, 0);
  assert.deepEqual(s.authors, []);
  assert.equal(s.busFactor, 0);
  assert.equal(s.heat.length, 7);
  assert.equal(s.heat[0].length, 24);
});

test('totals and averages come from the commit list', () => {
  const commits = [commit('2024-05-13 09', 10, 2, ['a.js']), commit('2024-05-14 09', 5, 5, ['b.js'])];
  const s = computeStats(commits, { now: new Date(Date.UTC(2024, 4, 20)) });
  assert.equal(s.totalCommits, 2);
  assert.equal(s.additions, 15);
  assert.equal(s.deletions, 7);
  assert.equal(s.filesTouched, 2);
  assert.equal(s.authors.length, 1);
  assert.equal(s.authors[0].commits, 2);
});

test('weekly buckets are ordered and cover the requested window', () => {
  const commits = [commit('2024-05-13 09'), commit('2024-05-20 09')];
  const s = computeStats(commits, { weeks: 4, now: new Date(Date.UTC(2024, 4, 21)) });
  assert.equal(s.weekly.length, 4);
  const starts = s.weekly.map((w) => w.start);
  assert.deepEqual(starts, [...starts].sort(), 'buckets are chronological');
  assert.equal(new Set(starts).size, starts.length, 'no duplicate buckets');
  assert.equal(s.weekly.reduce((n, w) => n + w.commits, 0), 2);
  assert.equal(s.activeWeeks, 2);
});

test('heat map indexes Monday-first weekday and UTC hour', () => {
  const s = computeStats([commit('2024-05-13 03'), commit('2024-05-19 22')]);
  // Monday 03:00 and Sunday 22:00
  assert.equal(s.heat[0][3], 1);
  assert.equal(s.heat[6][22], 1);
  assert.equal(s.heat.flat().reduce((a, b) => a + b, 0), 2);
});

test('bus factor is the headcount covering half the commits', () => {
  const commits = [
    ...Array.from({ length: 6 }, () => commit('2024-05-13 09')),
    ...Array.from({ length: 4 }, () => commit('2024-05-14 09')),
  ];
  commits.slice(6).forEach((c) => {
    c.author = 'Grace';
    c.email = 'grace@example.com';
  });
  const s = computeStats(commits, { now: new Date(Date.UTC(2024, 4, 20)) });
  assert.equal(s.authors.length, 2);
  assert.equal(s.authors[0].name, 'Ada');
  assert.equal(s.busFactor, 1, 'Ada alone has more than half');
});

test('top files rank by churn and ignore commits without stats', () => {
  const commits = [
    commit('2024-05-13 09', 100, 50, ['big.js']),
    commit('2024-05-14 09', 1, 1, ['small.js']),
    { ...commit('2024-05-15 09'), added: 0, deleted: 0, files: [] },
  ];
  const s = computeStats(commits, { now: new Date(Date.UTC(2024, 4, 20)) });
  assert.equal(s.topFiles[0].path, 'big.js');
  assert.equal(s.topFiles[0].added, 100);
  assert.equal(s.topFiles.at(-1).path, 'small.js');
});

test('biggest commits are the largest single changes, capped', () => {
  const commits = [
    commit('2024-05-13 09', 5, 5),
    commit('2024-05-14 09', 900, 10),
    commit('2024-05-15 09', 10, 2),
  ];
  const s = computeStats(commits, { now: new Date(Date.UTC(2024, 4, 20)) });
  assert.equal(s.biggestCommits[0].lines, 910);
  assert.ok(s.biggestCommits.length <= 5);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { FIELD, RECORD, parseLog } from '../src/git.js';

function record({ hash = 'abc123', author = 'Ada', email = 'ada@example.com', date = '2024-05-13 09', subject = 'change', stats = [] }) {
  const header = [hash, author, email, date, subject].join(FIELD);
  const body = stats.map(([a, d, p]) => `${a}\t${d}\t${p}`).join('\n');
  return body ? `${RECORD}${header}\n${body}` : `${RECORD}${header}`;
}

test('parses a single record with numstat lines', () => {
  const text = record({ stats: [[10, 2, 'src/a.js'], [3, 0, 'docs/b.md']] });
  const commits = parseLog(text);
  assert.equal(commits.length, 1);
  const c = commits[0];
  assert.equal(c.hash, 'abc123');
  assert.equal(c.author, 'Ada');
  assert.equal(c.subject, 'change');
  assert.equal(c.added, 13);
  assert.equal(c.deleted, 2);
  assert.equal(c.files.length, 2);
  assert.equal(c.files[0].path, 'src/a.js');
  assert.equal(c.date.toISOString(), '2024-05-13T09:00:00.000Z');
});

test('binary rows count as zero lines but keep the path', () => {
  const commits = parseLog(record({ stats: [['-', '-', 'logo.png']] }));
  assert.equal(commits[0].added, 0);
  assert.equal(commits[0].deleted, 0);
  assert.equal(commits[0].files[0].binary, true);
});

test('merge commits without numstat still appear', () => {
  const commits = parseLog(record({ hash: 'm1', subject: 'Merge branch' }));
  assert.equal(commits.length, 1);
  assert.equal(commits[0].added, 0);
  assert.equal(commits[0].files.length, 0);
});

test('records come back oldest first', () => {
  const text =
    record({ hash: 'b', date: '2024-06-01 10', stats: [[1, 0, 'x']] }) +
    record({ hash: 'a', date: '2024-01-01 10', stats: [[1, 0, 'y']] });
  const commits = parseLog(text);
  assert.deepEqual(commits.map((c) => c.hash), ['a', 'b']);
});

test('empty input is not an error', () => {
  assert.deepEqual(parseLog(''), []);
  assert.deepEqual(parseLog('\n\n'), []);
});

test('subjects containing the field separator survive', () => {
  const commits = parseLog(record({ subject: 'odd `1f` title' }));
  assert.equal(commits[0].subject, 'odd `1f` title');
});

test('malformed headers are skipped instead of throwing', () => {
  const text = `${RECORD}broken${FIELD}only-two${RECORD}${['h2', 'Ada', 'e', '2024-05-13 09', 'ok'].join(FIELD)}`;
  const commits = parseLog(text);
  assert.equal(commits.length, 1);
  assert.equal(commits[0].hash, 'h2');
});

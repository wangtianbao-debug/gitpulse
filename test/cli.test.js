import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { run, parseArgs } from '../src/cli.js';

function capture() {
  const out = [];
  const err = [];
  return {
    io: { stdout: { write: (s) => out.push(s) }, error: (s) => err.push(s) },
    out: () => out.join(''),
    err: () => err.join(''),
  };
}

function makeRepo(commits = 3) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitpulse-'));
  const git = (...args) =>
    execFileSync('git', ['-C', dir, ...args], {
      encoding: 'utf8',
      env: { ...process.env, GIT_AUTHOR_NAME: 'Ada', GIT_AUTHOR_EMAIL: 'ada@example.com', GIT_COMMITTER_NAME: 'Ada', GIT_COMMITTER_EMAIL: 'ada@example.com' },
    });
  git('init', '-q', '-b', 'main');
  fs.writeFileSync(path.join(dir, 'a.txt'), 'one\n');
  git('add', '.');
  for (let i = 0; i < commits; i++) {
    fs.writeFileSync(path.join(dir, 'a.txt'), `one\n${i}\n`);
    git('add', '.');
    git('-c', 'commit.gpgsign=false', 'commit', '-q', '-m', `commit ${i}`);
  }
  return dir;
}

test('parses flags and one positional path', () => {
  const { opts } = parseArgs(['repo', '-o', 'r.html', '--weeks', '26', '--since', '30 days ago', '--title', 'T', '--open']);
  assert.equal(opts.repo, 'repo');
  assert.equal(opts.out, 'r.html');
  assert.equal(opts.weeks, 26);
  assert.equal(opts.since, '30 days ago');
  assert.equal(opts.title, 'T');
  assert.equal(opts.open, true);
});

test('rejects bad input with exit code 2', () => {
  assert.equal(run(['--weeks', '0'], capture().io), 2);
  assert.equal(run(['--nope'], capture().io), 2);
  assert.equal(run(['a', 'b'], capture().io), 2);
  assert.equal(run(['-o'], capture().io), 2);
});

test('--help and --version succeed', () => {
  const help = capture();
  assert.equal(run(['--help'], help.io), 0);
  assert.match(help.out(), /Usage/);

  const version = capture();
  assert.equal(run(['--version'], version.io), 0);
  assert.match(version.out().trim(), /^\d+\.\d+\.\d+$/);
});

test('writes an html file for a real repository', (t) => {
  const dir = makeRepo(3);
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const out = path.join(dir, 'pulse.html');
  const { io, out: stdout } = capture();
  assert.equal(run([dir, '-o', out], io), 0);
  assert.ok(fs.existsSync(out));
  const html = fs.readFileSync(out, 'utf8');
  assert.match(html, /<h1>/);
  assert.match(stdout(), /3 commits/);
});

test('--json prints a summary and writes no file', (t) => {
  const dir = makeRepo(2);
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const { io, out } = capture();
  assert.equal(run([dir, '--json', '-o', path.join(dir, 'nope.html')], io), 0);
  const summary = JSON.parse(out());
  assert.equal(summary.commits, 2);
  assert.equal(summary.authors, 1);
  assert.ok(summary.firstCommit <= summary.lastCommit);
  assert.ok(!fs.existsSync(path.join(dir, 'nope.html')));
});

test('--stdout streams the document', (t) => {
  const dir = makeRepo(1);
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const { io, out } = capture();
  assert.equal(run([dir, '--stdout', '-q'], io), 0);
  assert.match(out(), /^<!doctype html>/);
});

test('fails clearly outside a repository', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitpulse-plain-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const { io, err } = capture();
  assert.equal(run([dir], io), 1);
  assert.match(err(), /not inside a git work tree/);
});

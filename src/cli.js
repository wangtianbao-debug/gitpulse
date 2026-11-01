import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { build } from './index.js';

const HELP = `gitpulse — turn git history into one HTML dashboard

Usage
  gitpulse [repo] [options]

Options
  -o, --out <file>     write the dashboard here (default: gitpulse.html)
  -w, --weeks <n>      weeks on the trend chart (default: 52)
      --since <date>   only count commits since, e.g. "12 weeks ago"
      --title <name>   override the repository name shown in the header
      --json           print summary statistics as JSON instead of HTML
      --stdout         print the HTML document to stdout
      --open           open the dashboard after writing it
  -q, --quiet          no output on success
  -h, --help           show this help
  -v, --version        show the version

Examples
  gitpulse
  gitpulse . -o report.html --weeks 26 --open
  gitpulse ~/code/app --since "90 days ago" --stdout > app.html
`;

const VALUE_FLAGS = new Set(['-o', '--out', '-w', '--weeks', '--since', '--title']);

export function parseArgs(argv) {
  const opts = { repo: null, out: 'gitpulse.html', weeks: 52, since: null, title: null, json: false, stdout: false, open: false, quiet: false, help: false, version: false };
  const rest = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (VALUE_FLAGS.has(arg)) {
      const value = argv[++i];
      if (value === undefined) return { error: `missing value for ${arg}` };
      if (arg === '-o' || arg === '--out') opts.out = value;
      else if (arg === '-w' || arg === '--weeks') {
        const n = Number(value);
        if (!Number.isFinite(n) || n < 1 || n > 520) return { error: `--weeks expects 1-520, got "${value}"` };
        opts.weeks = Math.floor(n);
      } else if (arg === '--since') opts.since = value;
      else if (arg === '--title') opts.title = value;
      continue;
    }
    if (arg === '-h' || arg === '--help') opts.help = true;
    else if (arg === '-v' || arg === '--version') opts.version = true;
    else if (arg === '--json') opts.json = true;
    else if (arg === '--stdout') opts.stdout = true;
    else if (arg === '--open') opts.open = true;
    else if (arg === '-q' || arg === '--quiet') opts.quiet = true;
    else if (arg.startsWith('-')) return { error: `unknown option ${arg}` };
    else rest.push(arg);
  }

  if (rest.length > 1) return { error: `expected one repository path, got ${rest.length}` };
  opts.repo = rest[0] ?? null;
  return { opts };
}

function summary(stats) {
  return {
    commits: stats.totalCommits,
    authors: stats.authors.length,
    additions: stats.additions,
    deletions: stats.deletions,
    filesTouched: stats.filesTouched,
    activeWeeks: stats.activeWeeks,
    busFactor: stats.busFactor,
    firstCommit: stats.firstCommit,
    lastCommit: stats.lastCommit,
    biggestCommits: stats.biggestCommits.map((c) => c.hash),
    topFiles: stats.topFiles.slice(0, 10).map((f) => ({ path: f.path, added: f.added, deleted: f.deleted })),
  };
}

function openFile(file, io) {
  const target = path.resolve(file);
  const [cmd, args] =
    process.platform === 'win32'
      ? ['cmd', ['/c', 'start', '', target]]
      : process.platform === 'darwin'
        ? ['open', [target]]
        : ['xdg-open', [target]];
  try {
    const child = spawn(cmd, args, { stdio: 'ignore', detached: true });
    child.on('error', () => io.error(`could not open ${target}; open it yourself`));
    child.unref();
  } catch {
    io.error(`could not open ${target}; open it yourself`);
  }
}

export function run(argv, io = process) {
  const { opts, error } = parseArgs(argv);
  if (error) {
    io.error(`gitpulse: ${error}`);
    io.error('run "gitpulse --help" for usage');
    return 2;
  }
  if (opts.help) {
    io.stdout.write(HELP);
    return 0;
  }
  if (opts.version) {
    const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    io.stdout.write(`${pkg.version}\n`);
    return 0;
  }

  const repo = path.resolve(opts.repo ?? process.cwd());
  let result;
  try {
    result = build({ repo, weeks: opts.weeks, since: opts.since, title: opts.title });
  } catch (err) {
    if (err.code === 'ENOTGIT') {
      io.error(`gitpulse: ${repo} is not inside a git work tree`);
      return 1;
    }
    io.error(`gitpulse: ${err.message}`);
    return 1;
  }

  const { stats, html, name } = result;

  if (opts.json) {
    io.stdout.write(`${JSON.stringify({ repo: name, ...summary(stats) }, null, 2)}\n`);
    return 0;
  }
  if (opts.stdout) {
    io.stdout.write(html);
    return 0;
  }
  if (!stats.totalCommits) {
    io.error(`gitpulse: ${name} has no commits yet, nothing to chart`);
    return 1;
  }

  const out = path.resolve(opts.out);
  try {
    fs.writeFileSync(out, html);
  } catch (err) {
    io.error(`gitpulse: cannot write ${out}: ${err.message}`);
    return 1;
  }

  if (!opts.quiet) {
    const rel = path.relative(process.cwd(), out) || out;
    const people = stats.authors.length;
    io.stdout.write(
      `${name}: ${stats.totalCommits} commits, ${people} author${people === 1 ? '' : 's'}, ${stats.filesTouched} files → ${rel}\n`,
    );
  }
  if (opts.open) openFile(out, io);
  return 0;
}

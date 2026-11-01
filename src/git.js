import { execFileSync } from 'node:child_process';

export const FIELD = '\x1f';
export const RECORD = '\x1e';

const PRETTY = `--pretty=format:${RECORD}%H${FIELD}%an${FIELD}%ae${FIELD}%ad${FIELD}%s`;

export function isGitRepo(repo) {
  try {
    execFileSync('git', ['-C', repo, 'rev-parse', '--is-inside-work-tree'], { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

export function repoInfo(repo) {
  const run = (args) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8' }).trim();
  let root = null;
  let branch = null;
  try {
    root = run(['rev-parse', '--show-toplevel']);
  } catch {
    /* detached or bare-ish checkout */
  }
  try {
    branch = run(['rev-parse', '--abbrev-ref', 'HEAD']);
  } catch {
    /* no commits yet */
  }
  return { root, branch };
}

/**
 * Read the full history with `--numstat`, in one `git log` call.
 * Merges are included but contribute no line counts (git shows none for them).
 */
export function readLog(repo, { since = null, until = null, maxBuffer = 512 * 1024 * 1024 } = {}) {
  const args = [
    '-c',
    'core.quotepath=false',
    'log',
    PRETTY,
    '--date=format:%Y-%m-%d %H',
    '--numstat',
    '--no-renames',
  ];
  if (since) args.push(`--since=${since}`);
  if (until) args.push(`--until=${until}`);
  args.push('HEAD');
  try {
    return execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', maxBuffer });
  } catch (err) {
    // An empty repository has no HEAD yet — that is not an error for us.
    const text = String(err.stderr || '');
    if (/does not have any commits|unknown revision|bad revision/i.test(text)) return '';
    throw err;
  }
}

/** Parse the `\x1e`-separated records emitted by readLog(). */
export function parseLog(text) {
  const commits = [];
  if (!text) return commits;

  for (const chunk of text.split(RECORD)) {
    if (!chunk.trim()) continue;
    const lines = chunk.split('\n');
    const header = lines[0].replace(/\r$/, '');
    const parts = header.split(FIELD);
    if (parts.length < 5) continue;

    const [hash, author, email, stamp, ...rest] = parts;
    const subject = rest.join(FIELD);

    const match = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}))?/.exec(stamp);
    if (!match) continue;
    const [, y, mo, d, h] = match;
    const date = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h || 0)));

    let added = 0;
    let deleted = 0;
    const files = [];

    for (const line of lines.slice(1)) {
      const m = /^(\d+|-)\t(\d+|-)\t(.*)$/.exec(line.replace(/\r$/, ''));
      if (!m) continue;
      const a = m[1] === '-' ? 0 : Number(m[1]);
      const del = m[2] === '-' ? 0 : Number(m[2]);
      added += a;
      deleted += del;
      files.push({ path: m[3], added: a, deleted: del, binary: m[1] === '-' && m[2] === '-' });
    }

    commits.push({ hash, author, email, date, subject, added, deleted, files });
  }

  commits.sort((a, b) => a.date - b.date);
  return commits;
}

export function readCommits(repo, opts = {}) {
  return parseLog(readLog(repo, opts));
}

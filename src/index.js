import path from 'node:path';
import { isGitRepo, readCommits, repoInfo } from './git.js';
import { computeStats } from './stats.js';
import { renderHtml } from './render.js';

/**
 * Read a repository and produce everything the CLI needs.
 *
 * @param {{repo?: string, weeks?: number, since?: string|null, title?: string|null, now?: Date}} opts
 * @returns {{name: string, branch: string|null, stats: object, html: string}}
 */
export function build({ repo = process.cwd(), weeks = 52, since = null, title = null, now = new Date() } = {}) {
  if (!isGitRepo(repo)) {
    const err = new Error(`not a git repository: ${repo}`);
    err.code = 'ENOTGIT';
    throw err;
  }

  const info = repoInfo(repo);
  const name = title || (info.root ? path.basename(info.root) : path.resolve(repo));
  const commits = readCommits(repo, { since });
  const stats = computeStats(commits, { weeks, now });
  const html = renderHtml({ name, branch: info.branch, stats, generatedAt: now, source: null });

  return { name, branch: info.branch, stats, html };
}

export { parseLog, readCommits } from './git.js';
export { computeStats } from './stats.js';
export { renderHtml } from './render.js';

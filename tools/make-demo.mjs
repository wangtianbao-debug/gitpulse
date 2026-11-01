// Builds a throwaway repository with believable history, so the README has
// a real screenshot instead of a mock-up.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = path.join(os.tmpdir(), 'gitpulse-demo-repo');
fs.rmSync(root, { recursive: true, force: true });
fs.mkdirSync(root, { recursive: true });

const authors = [
  ['Ada Lovelace', 'ada@example.com', 0.45],
  ['Grace Hopper', 'grace@example.com', 0.3],
  ['Alan Turing', 'alan@example.com', 0.18],
  ['Radia Perlman', 'radia@example.com', 0.07],
];

const files = [
  'src/api/routes.js',
  'src/api/client.js',
  'src/core/engine.js',
  'src/core/cache.js',
  'src/ui/table.js',
  'src/ui/chart.js',
  'docs/guide.md',
  'test/api.test.js',
  'package.json',
];

let seed = 42;
const rand = () => {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
};
const pick = (list) => list[Math.floor(rand() * list.length)];
const pickAuthor = () => {
  const r = rand();
  let acc = 0;
  for (const a of authors) {
    acc += a[2];
    if (r <= acc) return a;
  }
  return authors[0];
};

const git = (...args) => execFileSync('git', ['-C', root, '-c', 'core.autocrlf=false', ...args], { encoding: 'utf8', stdio: 'pipe' });
git('init', '-q', '-b', 'main');
git('config', 'commit.gpgsign', 'false');

const start = Date.UTC(2026, 0, 12);
let n = 0;
for (let week = 0; week < 40; week++) {
  const quiet = rand() < 0.18 || (week > 28 && rand() < 0.5);
  const count = quiet ? 0 : 1 + Math.floor(rand() * 5);
  for (let i = 0; i < count; i++) {
    const [name, email] = pickAuthor();
    const hour = 8 + Math.floor(rand() * 12);
    const day = start + week * 7 * 86400000 + Math.floor(rand() * 5) * 86400000 + hour * 3600000 + Math.floor(rand() * 60) * 60000;
    const file = pick(files);
    const chunks = 1 + Math.floor(rand() * 4);
    let line = '';
    for (let c = 0; c < chunks; c++) {
      line += `// ${n}.${c} ${pick(['handler', 'helper', 'wiring', 'edge case', 'retry'])}\n`;
      const width = 40 + Math.floor(rand() * 80);
      line += `const ${pick(['value', 'result', 'state', 'entry'])}${c} = ${'"' + 'x'.repeat(width) + '"'};\n`;
    }
    const abs = path.join(root, file);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, (fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : '') + line);
    if (rand() < 0.15) {
      const lines = fs.readFileSync(abs, 'utf8').split('\n');
      fs.writeFileSync(abs, `${lines.slice(0, Math.max(1, Math.floor(lines.length * 0.6))).join('\n')}\n`);
    }
    const stamp = new Date(day).toISOString();
    execFileSync('git', ['-C', root, 'add', '.'], { encoding: 'utf8' });
    execFileSync('git', ['-C', root, 'commit', '-q', '-m', `${pick(['fix', 'feat', 'refactor', 'test'])}: ${pick(['retry on 5xx', 'cache lookups', 'empty table state', 'parse dates', 'drop dead code', 'guard missing row'])} in ${path.basename(file)}`], {
      encoding: 'utf8',
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: name,
        GIT_AUTHOR_EMAIL: email,
        GIT_COMMITTER_NAME: name,
        GIT_COMMITTER_EMAIL: email,
        GIT_AUTHOR_DATE: stamp,
        GIT_COMMITTER_DATE: stamp,
      },
    });
    n++;
  }
}

console.log(`demo repo at ${root} with ${n} commits`);

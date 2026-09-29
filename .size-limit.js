// Budgets from README.md. Vite's manifest tells the initial chunks (entry plus its
// static imports) apart from lazy ones, so each lazy chunk is checked on its own.
import { readFileSync } from 'node:fs';

const manifest = JSON.parse(readFileSync('dist/.vite/manifest.json', 'utf8'));
const entryKey = Object.keys(manifest).find((key) => manifest[key].isEntry);
if (!entryKey) throw new Error('No entry chunk in dist/.vite/manifest.json; run npm run build');

const initial = new Set();
const css = new Set();
const visit = (key) => {
  const chunk = manifest[key];
  if (!chunk || initial.has(chunk.file)) return;
  initial.add(chunk.file);
  (chunk.css ?? []).forEach((file) => css.add(file));
  (chunk.imports ?? []).forEach(visit);
};
visit(entryKey);

const lazy = Object.values(manifest)
  .map((chunk) => chunk.file)
  .filter((file, i, all) => file.endsWith('.js') && !initial.has(file) && all.indexOf(file) === i);

const gzip = { gzip: true, brotli: false };
const dist = (file) => `dist/${file}`;

export default [
  { name: 'Initial JS', path: [...initial].map(dist), limit: '120 KB', ...gzip },
  ...(css.size ? [{ name: 'Initial CSS', path: [...css].map(dist), limit: '15 KB', ...gzip }] : []),
  ...lazy.map((file) => ({
    name: `Lazy chunk ${file}`,
    path: dist(file),
    limit: '40 KB',
    ...gzip,
  })),
];

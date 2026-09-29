import type { components } from '@/api/types.gen';

type DiffOp = components['schemas']['DiffOp'];

const UCI_LINE = /^(|package \S+|config \S+( '[^']*')?|\t(option|list) \S+ '[^']*'|\t?#.*)$/;

/** 1-based number of the first line that is not `uci export` syntax, or null. */
export function firstInvalidLine(text: string): number | null {
  const index = text.split('\n').findIndex((line) => !UCI_LINE.test(line));
  return index === -1 ? null : index + 1;
}

/** Line diff via longest common subsequence, as the backend's diff endpoint returns it. */
export function lineDiff(from: string, to: string): DiffOp[] {
  const a = from.split('\n');
  const b = to.split('\n');
  const lcs = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  const at = (i: number, j: number) => lcs[i]?.[j] ?? 0;
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      const row = lcs[i];
      if (row) row[j] = a[i] === b[j] ? at(i + 1, j + 1) + 1 : Math.max(at(i + 1, j), at(i, j + 1));
    }
  }
  const ops: DiffOp[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      ops.push({ op: '=', text: a[i++] ?? '' });
      j++;
    } else if (j < b.length && (i >= a.length || at(i, j + 1) >= at(i + 1, j))) {
      ops.push({ op: '+', text: b[j++] ?? '' });
    } else {
      ops.push({ op: '-', text: a[i++] ?? '' });
    }
  }
  return ops;
}

const SECRET = /^\t(option|list) (key|password|psk) /;

/** Fills {{scope.key}} from vars; masks secrets. `missing` lists unfilled names. */
export function renderTemplate(text: string, vars: Record<string, string>) {
  const missing = new Set<string>();
  const rendered = text
    .replace(/\{\{\s*([a-z]+\.[a-z_]+)\s*\}\}/g, (_, name: string) => {
      const value = vars[name];
      if (value === undefined) missing.add(name);
      return value ?? '';
    })
    .split('\n')
    .map((line) => (SECRET.test(line) ? line.replace(/'[^']*'$/, "'******'") : line))
    .join('\n');
  return { rendered, missing: [...missing] };
}

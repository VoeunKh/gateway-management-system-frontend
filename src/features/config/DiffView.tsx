import type { Schemas } from '@/api/endpoints';

const PREFIX = { '+': '+', '-': '-', '=': ' ' } as const;
const LABEL = { '+': 'added', '-': 'removed', '=': 'unchanged' } as const;

/**
 * The API's line diff. Each line keeps a leading "+", "-" or space, so it reads the same
 * without colour; long files scroll inside the panel.
 */
export function DiffView({ ops, label }: { ops: Schemas['DiffOp'][]; label: string }) {
  const changed = ops.some((op) => op.op !== '=');
  if (!changed) return <p class="muted">No changes from the previous version.</p>;
  const added = ops.filter((op) => op.op === '+').length;
  const removed = ops.filter((op) => op.op === '-').length;
  return (
    <figure class="diff">
      <figcaption class="muted">
        {added} added, {removed} removed
      </figcaption>
      <pre tabIndex={0} aria-label={label}>
        {ops.map((op, i) => (
          <span key={i} class={`diff__line diff__line--${LABEL[op.op]}`}>
            {PREFIX[op.op]} {op.text}
            {'\n'}
          </span>
        ))}
      </pre>
    </figure>
  );
}

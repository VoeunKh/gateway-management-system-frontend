import type { ComponentChildren } from 'preact';
import { useId } from 'preact/hooks';

export interface CardProps {
  title: string;
  /** Right side of the header, e.g. a badge. */
  aside?: ComponentChildren;
  children: ComponentChildren;
}

export function Card({ title, aside, children }: CardProps) {
  const id = useId();
  return (
    <section class="card" aria-labelledby={id}>
      <header class="card__head">
        <h2 id={id}>{title}</h2>
        {aside}
      </header>
      {children}
    </section>
  );
}

export interface DetailItem {
  label: string;
  /** null or undefined hides the row: unknown values are left out, never shown blank. */
  value: ComponentChildren | null | undefined;
}

export function DetailList({ items }: { items: DetailItem[] }) {
  const shown = items.filter((item) => item.value !== null && item.value !== undefined);
  return (
    <dl class="details">
      {shown.map((item) => (
        <div key={item.label} class="details__row">
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

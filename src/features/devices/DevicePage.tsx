import { Link } from 'wouter-preact';
import { EmptyState } from '@/ui';

// Placeholder until UI-07 builds this screen.
export function DevicePage({ sn }: { sn: string }) {
  return (
    <section class="page">
      <h1>{sn}</h1>
      <EmptyState
        title="Device detail arrives in UI-07"
        action={<Link href="/devices">All devices</Link>}
      >
        Interfaces, metrics and remote actions for this gateway will appear here.
      </EmptyState>
    </section>
  );
}

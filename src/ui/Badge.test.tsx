import { render, screen } from '@testing-library/preact';
import { Badge, TONES } from './Badge';

const LABELS = {
  ok: 'Online',
  warn: 'Degraded',
  danger: 'Offline',
  info: 'Updating',
  neutral: 'Unknown',
} as const;

describe('Badge', () => {
  it.each(TONES)('renders a text label alongside the %s colour', (tone) => {
    render(<Badge tone={tone}>{LABELS[tone]}</Badge>);
    const badge = screen.getByText(LABELS[tone]);
    expect(badge).toHaveClass('badge', `badge--${tone}`);
    expect(badge).toHaveTextContent(LABELS[tone]);
  });
});

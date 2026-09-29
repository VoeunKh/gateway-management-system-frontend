import { fireEvent, render, screen, waitFor } from '@testing-library/preact';
import { TrendChart, scaleOf } from './TrendChart';

const points = [
  { t: Date.parse('2026-09-29T08:00:00Z'), v: 50 },
  { t: Date.parse('2026-09-29T09:00:00Z'), v: 60 },
  { t: Date.parse('2026-09-29T10:00:00Z'), v: 55 },
];
const format = (v: number) => `${Math.round(v)} u`;

describe('scaleOf', () => {
  it('adds headroom around the values and spans the times', () => {
    const s = scaleOf(points);
    expect(s.min).toBeLessThan(50);
    expect(s.max).toBeGreaterThan(60);
    expect(s.t0).toBe(points[0]?.t);
    expect(s.t1).toBe(points[2]?.t);
  });

  it('gives a flat series a range so it can be drawn', () => {
    const s = scaleOf([
      { t: 0, v: 7 },
      { t: 1, v: 7 },
    ]);
    expect(s.max).toBeGreaterThan(s.min);
  });
});

describe('TrendChart', () => {
  it('draws a named chart with a line, an area and value labels on the y axis', () => {
    const { container } = render(<TrendChart points={points} format={format} label="Temp, 3 h" />);
    const chart = screen.getByRole('img', { name: 'Temp, 3 h' });
    expect(chart.querySelector('polyline')).toHaveAttribute('points');
    expect(chart.querySelector('polygon')).toBeInTheDocument();
    expect(container.querySelectorAll('.trend__yaxis span')).toHaveLength(4);
  });

  it('shows the reading under the pointer, and hides it on leave', async () => {
    const { container } = render(<TrendChart points={points} format={format} label="Temp" />);
    const plot = container.querySelector('.trend__plot') as HTMLElement;
    plot.getBoundingClientRect = () => ({ left: 0, width: 100 }) as DOMRect;
    // jsdom's pointer events carry no coordinates; a MouseEvent named pointermove does.
    fireEvent(plot, new MouseEvent('pointermove', { clientX: 50, bubbles: true }));
    expect(await screen.findByRole('status')).toHaveTextContent('60 u');
    fireEvent.pointerLeave(plot);
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
  });

  it('draws nothing without points', () => {
    const { container } = render(<TrendChart points={[]} format={format} label="Temp" />);
    expect(container).toBeEmptyDOMElement();
  });
});

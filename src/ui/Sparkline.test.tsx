import { render, screen } from '@testing-library/preact';
import { Sparkline, sparklinePoints } from './Sparkline';

describe('Sparkline', () => {
  it('draws one point per value and is named by its label', () => {
    const { container } = render(<Sparkline values={[-90, -85, -88, -70]} label="RSSI, 24 h" />);
    const svg = screen.getByRole('img', { name: 'RSSI, 24 h' });
    expect(svg).toHaveAttribute('preserveAspectRatio', 'none');
    const line = container.querySelector('polyline');
    expect(line).toHaveAttribute('vector-effect', 'non-scaling-stroke');
    expect(line?.getAttribute('points')?.split(' ')).toHaveLength(4);
  });

  it('renders nothing for an empty series', () => {
    const { container } = render(<Sparkline values={[]} label="No data" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('spans the width, puts the maximum at the top and handles flat series', () => {
    expect(sparklinePoints([0, 10])).toBe('0,28 100,2');
    expect(sparklinePoints([5, 5, 5])).toBe('0,15 50,15 100,15');
    expect(sparklinePoints([7])).toBe('50,15');
  });
});

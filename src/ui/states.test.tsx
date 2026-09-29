import { fireEvent, render, screen } from '@testing-library/preact';
import { ICONS } from './icons';
import { EmptyState, ErrorState, Skeleton } from './states';
import { Table } from './Table';
import { Tooltip } from './Tooltip';

describe('screen states', () => {
  it('Skeleton announces loading and hides its bars', () => {
    const { container } = render(<Skeleton lines={4} label="Loading devices" />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading devices');
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(4);
  });

  it('EmptyState shows its title, text and action', () => {
    render(
      <EmptyState title="No devices match" action={<a href="/devices">Clear filters</a>}>
        Try a different model or status.
      </EmptyState>,
    );
    expect(screen.getByRole('heading', { name: 'No devices match' })).toBeInTheDocument();
    expect(screen.getByText('Try a different model or status.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Clear filters' })).toBeInTheDocument();
  });

  it('ErrorState shows the message and retries', () => {
    const onRetry = vi.fn();
    render(<ErrorState message="The server did not respond." onRetry={onRetry} />);
    expect(screen.getByRole('alert')).toHaveTextContent('The server did not respond.');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});

describe('Table', () => {
  it('renders headers and cells, numeric columns right-aligned', () => {
    const rows = [
      { id: 'gw-001', name: 'Depot north', uptime: 12 },
      { id: 'gw-002', name: 'Depot south', uptime: 3 },
    ];
    render(
      <Table
        caption="Devices"
        hideCaption
        rows={rows}
        rowKey={(row) => row.id}
        columns={[
          { key: 'name', header: 'Name', cell: (row) => row.name },
          { key: 'uptime', header: 'Uptime (d)', cell: (row) => row.uptime, numeric: true },
        ]}
      />,
    );
    expect(screen.getByRole('table', { name: 'Devices' })).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader').map((th) => th.textContent)).toEqual([
      'Name',
      'Uptime (d)',
    ]);
    expect(screen.getAllByRole('row')).toHaveLength(3);
    expect(screen.getByRole('cell', { name: '12' })).toHaveClass('num');
  });
});

describe('icons and Tooltip', () => {
  it.each(Object.entries(ICONS))('%s is named by its title, else decorative', (name, Icon) => {
    const { container, unmount } = render(<Icon title={name} size={20} />);
    expect(screen.getByRole('img', { name })).toHaveAttribute('width', '20');
    unmount();
    render(<Icon />);
    expect(container.querySelector('svg')).toBeNull();
    expect(document.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('Tooltip sets the title', () => {
    render(<Tooltip text="Last seen 2 minutes ago">online</Tooltip>);
    expect(screen.getByText('online')).toHaveAttribute('title', 'Last seen 2 minutes ago');
  });
});

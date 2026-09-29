import { act, fireEvent, render, screen } from '@testing-library/preact';
import { TOAST_TIMEOUT_MS, ToastProvider, useToast } from './Toast';

let count = 0;

function Trigger() {
  const toast = useToast();
  return (
    <button type="button" onClick={() => toast({ message: `Saved ${++count}`, tone: 'ok' })}>
      Notify
    </button>
  );
}

function setup() {
  count = 0;
  render(
    <ToastProvider>
      <Trigger />
    </ToastProvider>,
  );
  return { notify: () => fireEvent.click(screen.getByRole('button', { name: 'Notify' })) };
}

describe('Toast', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('announces through a polite live region', () => {
    const { notify } = setup();
    notify();
    const region = screen.getByRole('region', { name: 'Notifications' });
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toHaveTextContent('Saved 1');
    expect(screen.getByRole('img', { name: 'Success' })).toBeInTheDocument();
  });

  it('keeps at most three toasts, dropping the oldest', () => {
    const { notify } = setup();
    for (let i = 0; i < 4; i++) notify();
    expect(screen.queryByText('Saved 1')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Dismiss notification' })).toHaveLength(3);
    expect(screen.getByText('Saved 4')).toBeInTheDocument();
  });

  it('dismisses itself after the timeout', () => {
    const { notify } = setup();
    notify();
    act(() => {
      vi.advanceTimersByTime(TOAST_TIMEOUT_MS - 1);
    });
    expect(screen.getByText('Saved 1')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByText('Saved 1')).not.toBeInTheDocument();
  });

  it('can be dismissed by hand', () => {
    const { notify } = setup();
    notify();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }));
    expect(screen.queryByText('Saved 1')).not.toBeInTheDocument();
  });

  it('throws when used outside the provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<Trigger />)).toThrow('useToast must be used inside <ToastProvider>');
  });
});

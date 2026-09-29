import { fireEvent, render, screen } from '@testing-library/preact';
import { Button } from './Button';

const ROLE_MESSAGE = "Your role (Viewer) can't do this";

describe('Button', () => {
  it('applies the variant and size classes', () => {
    render(
      <Button variant="primary" size="sm">
        Save
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toHaveClass('btn', 'btn--primary', 'btn--sm');
    expect(button).toHaveAttribute('type', 'button');
  });

  it('defaults to the secondary variant and calls onClick', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Refresh</Button>);
    const button = screen.getByRole('button', { name: 'Refresh' });
    expect(button).toHaveClass('btn--secondary');
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('when disabled, shows the role message as its tooltip and stays focusable', () => {
    const onClick = vi.fn();
    render(
      <Button disabled title={ROLE_MESSAGE} onClick={onClick}>
        Start rollout
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Start rollout' });
    expect(button).toHaveAttribute('title', ROLE_MESSAGE);
    expect(button).toHaveAccessibleDescription(ROLE_MESSAGE);
    expect(button).toHaveAttribute('aria-disabled', 'true');
    button.focus();
    expect(button).toHaveFocus();
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('blocks clicks and reports busy while loading', () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Rebooting
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Rebooting' });
    expect(button).toHaveAttribute('aria-busy', 'true');
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('does not submit its form while disabled', () => {
    const onSubmit = vi.fn((event: Event) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <Button type="submit" disabled>
          Push config
        </Button>
      </form>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Push config' }));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

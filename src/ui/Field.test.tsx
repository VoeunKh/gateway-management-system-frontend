import { render, screen } from '@testing-library/preact';
import { Field } from './Field';

describe('Field', () => {
  it('ties the label to the input', () => {
    render(<Field label="Email" type="email" autoComplete="username" />);
    const input = screen.getByLabelText('Email');
    const label = screen.getByText('Email');
    expect(input.id).not.toBe('');
    expect(label).toHaveAttribute('for', input.id);
    expect(input).not.toHaveAttribute('aria-invalid');
    expect(input).not.toHaveAttribute('aria-describedby');
  });

  it('keeps a caller-supplied id', () => {
    render(<Field label="Hostname" id="hostname" />);
    expect(screen.getByLabelText('Hostname')).toHaveAttribute('id', 'hostname');
  });

  it('describes the input with its error and marks it invalid', () => {
    render(<Field label="Password" type="password" error="Wrong email or password" />);
    const input = screen.getByLabelText('Password');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Wrong email or password');
  });

  it('includes both hint and error in the description', () => {
    render(<Field label="APN" hint="From the SIM provider" error="Required" />);
    expect(screen.getByLabelText('APN')).toHaveAccessibleDescription(
      'From the SIM provider Required',
    );
  });
});

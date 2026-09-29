import { fireEvent, render, screen } from '@testing-library/preact';
import { HealthBadge } from './HealthBadge';
import { SelectField } from './SelectField';
import { Table } from './Table';
import { Toggle } from './Toggle';

describe('SelectField', () => {
  it('is labelled and reports the chosen value', () => {
    const onChange = vi.fn();
    render(
      <SelectField
        label="Model"
        value=""
        options={[
          { value: '', label: 'All models' },
          { value: 'GW200', label: 'GW200 LTE Cat 4' },
        ]}
        onChange={onChange}
      />,
    );
    const select = screen.getByRole('combobox', { name: 'Model' }) as HTMLSelectElement;
    select.value = 'GW200';
    fireEvent(select, new Event('change', { bubbles: true }));
    expect(onChange).toHaveBeenCalledWith('GW200');
  });
});

describe('Toggle', () => {
  it('is a labelled switch', () => {
    const onChange = vi.fn();
    render(<Toggle label="Drifted only" checked={false} onChange={onChange} />);
    const toggle = screen.getByRole('switch', { name: 'Drifted only' });
    expect(toggle).not.toBeChecked();
    fireEvent.click(toggle);
    expect(onChange).toHaveBeenCalledWith(true);
  });
});

describe('HealthBadge', () => {
  it.each([
    ['healthy', 'Healthy', 'badge--ok'],
    ['warning', 'Warning', 'badge--warn'],
    ['critical', 'Critical', 'badge--danger'],
    ['offline', 'Offline', 'badge--neutral'],
  ] as const)('%s reads "%s"', (health, label, cls) => {
    render(<HealthBadge health={health} />);
    expect(screen.getByText(label)).toHaveClass(cls);
  });
});

describe('Table rows', () => {
  it('calls onRowClick with the row', () => {
    const onRowClick = vi.fn();
    render(
      <Table
        caption="Things"
        rows={[{ id: 'a' }]}
        rowKey={(r) => r.id}
        columns={[{ key: 'id', header: 'Id', cell: (r) => r.id }]}
        onRowClick={onRowClick}
      />,
    );
    fireEvent.click(screen.getByRole('cell', { name: 'a' }));
    expect(onRowClick).toHaveBeenCalledWith({ id: 'a' }, expect.any(MouseEvent));
  });
});

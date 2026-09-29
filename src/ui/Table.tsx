import type { ComponentChildren } from 'preact';

export interface Column<Row> {
  key: string;
  header: string;
  cell: (row: Row) => ComponentChildren;
  /** Right-aligned with tabular figures. */
  numeric?: boolean;
}

export interface TableProps<Row> {
  caption: string;
  /** Hide the caption visually; it still names the table for screen readers. */
  hideCaption?: boolean;
  columns: Column<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string;
  /** On phones, each row becomes a labelled card instead of scrolling sideways. */
  stack?: boolean;
  /** Makes whole rows clickable; keep a real link in a cell for keyboard and new-tab use. */
  onRowClick?: (row: Row, event: MouseEvent) => void;
}

export function Table<Row>({
  caption,
  hideCaption,
  stack,
  columns,
  rows,
  rowKey,
  onRowClick,
}: TableProps<Row>) {
  return (
    <div class="table-wrap">
      <table class={stack ? 'table table--stack' : 'table'}>
        <caption class={hideCaption ? 'sr-only' : undefined}>{caption}</caption>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} scope="col" class={col.numeric ? 'num' : undefined}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              class={onRowClick ? 'table__row--link' : undefined}
              onClick={onRowClick ? (event) => onRowClick(row, event) : undefined}
            >
              {columns.map((col) => (
                <td key={col.key} class={col.numeric ? 'num' : undefined} data-label={col.header}>
                  {col.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

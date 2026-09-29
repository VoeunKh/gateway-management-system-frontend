import {
  describeFilters,
  hasFilters,
  parseFilters,
  serializeFilters,
  toDeviceQuery,
} from './filters';

describe('device filters', () => {
  it('round-trips through the query string', () => {
    const filters = { q: 'GW2', model: 'GW200', health: 'warning' as const, drift: true };
    expect(serializeFilters(filters)).toBe('?q=GW2&model=GW200&health=warning&drift=true');
    expect(parseFilters(serializeFilters(filters))).toEqual(filters);
    expect(toDeviceQuery(filters)).toEqual(filters);
  });

  it('ignores unknown or empty values', () => {
    expect(parseFilters('?health=melting&drift=yes&q=%20%20&model=')).toEqual({
      q: undefined,
      model: undefined,
      health: undefined,
      drift: undefined,
    });
    expect(serializeFilters({})).toBe('');
    expect(hasFilters({})).toBe(false);
  });

  it('describes active filters in words', () => {
    expect(describeFilters({ q: 'x', model: 'GW300', health: 'offline', drift: true })).toEqual([
      'search "x"',
      'model GW300',
      'Offline',
      'drifted only',
    ]);
  });
});

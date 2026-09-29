import { devicesListHref, rememberListSearch } from './listState';

describe('device list state', () => {
  it('remembers the list query for the back link', () => {
    expect(devicesListHref()).toBe('/devices');
    rememberListSearch('?health=offline&drift=true');
    expect(devicesListHref()).toBe('/devices?health=offline&drift=true');
  });

  it('falls back to the plain list when storage is blocked', () => {
    const blocked = () => {
      throw new DOMException('blocked', 'SecurityError');
    };
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(blocked);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(blocked);
    expect(() => rememberListSearch('?q=x')).not.toThrow();
    expect(devicesListHref()).toBe('/devices');
    vi.restoreAllMocks();
  });
});

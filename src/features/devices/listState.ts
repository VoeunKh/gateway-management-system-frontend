// Remembers the device list's query string so "Back to devices" returns to the same view.
// Per tab (sessionStorage); storage can be unavailable, so every access is guarded.
const KEY = 'gwfleet.devices.search';

export function rememberListSearch(search: string): void {
  try {
    sessionStorage.setItem(KEY, search);
  } catch {
    // Private mode or blocked storage: the back link just returns to the unfiltered list.
  }
}

export function devicesListHref(): string {
  try {
    const search = sessionStorage.getItem(KEY);
    return search ? `/devices?${search.replace(/^\?/, '')}` : '/devices';
  } catch {
    return '/devices';
  }
}

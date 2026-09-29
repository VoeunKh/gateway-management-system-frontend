/** Matches the API on any origin, so the same handlers serve jsdom and the browser. */
export const api = (path: string) => `*/api/v1${path}`;

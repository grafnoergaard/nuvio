export const DEFAULT_START_SCREEN_HREF = '/';
const START_SCREEN_STORAGE_KEY = 'nuvio_start_screen_href';
const RELEASE_START_SCREEN_HREFS = new Set(['/', '/nuvio-flow', '/opsparing', '/indstillinger']);

export function getStartScreenHref(): string {
  if (typeof window === 'undefined') return DEFAULT_START_SCREEN_HREF;
  const stored = window.localStorage.getItem(START_SCREEN_STORAGE_KEY);
  return stored && RELEASE_START_SCREEN_HREFS.has(stored) ? stored : DEFAULT_START_SCREEN_HREF;
}

export function setStartScreenHref(href: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(START_SCREEN_STORAGE_KEY, RELEASE_START_SCREEN_HREFS.has(href) ? href : DEFAULT_START_SCREEN_HREF);
}

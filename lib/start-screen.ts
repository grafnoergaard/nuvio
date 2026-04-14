export const DEFAULT_START_SCREEN_HREF = '/nuvio-flow';
const START_SCREEN_STORAGE_KEY = 'nuvio_start_screen_href';

export function getStartScreenHref(): string {
  if (typeof window === 'undefined') return DEFAULT_START_SCREEN_HREF;
  return window.localStorage.getItem(START_SCREEN_STORAGE_KEY) || DEFAULT_START_SCREEN_HREF;
}

export function setStartScreenHref(href: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(START_SCREEN_STORAGE_KEY, href);
}

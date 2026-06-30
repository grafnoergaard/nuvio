export const VACATION_MODE_CHANGED_EVENT = 'kuvert-vacation-mode-changed';

export function notifyVacationModeChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(VACATION_MODE_CHANGED_EVENT));
}

export const FOCUS_MODE_NAME_KEY = 'hone:focus:macos-mode-name';

export function readFocusModeName(): string {
  if (typeof window === 'undefined') return '';
  try {
    return (window.localStorage.getItem(FOCUS_MODE_NAME_KEY) ?? '').trim();
  } catch {
    return '';
  }
}

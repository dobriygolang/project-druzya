export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'hone.theme';
const EVENT_NAME = 'hone:theme-changed';

export function currentTheme(): Theme {
  if (typeof document === 'undefined') return 'light';
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

export function loadStoredTheme(): Theme | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw === 'light' || raw === 'dark' ? raw : null;
  } catch {
    return null;
  }
}

export function setTheme(next: Theme): void {
  if (typeof document === 'undefined') return;
  const html = document.documentElement;
  html.classList.remove('light', 'dark');
  html.classList.add(next);
  html.style.colorScheme = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* private mode */
  }
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { theme: next } }));
}

export function toggleTheme(): Theme {
  const next: Theme = currentTheme() === 'dark' ? 'light' : 'dark';
  setTheme(next);
  return next;
}

export function onThemeChange(handler: (t: Theme) => void): () => void {
  const wrapped = (e: Event) => {
    const detail = (e as CustomEvent<{ theme: Theme }>).detail;
    if (detail) handler(detail.theme);
  };
  window.addEventListener(EVENT_NAME, wrapped);
  return () => window.removeEventListener(EVENT_NAME, wrapped);
}

export function bootstrapTheme(): void {
  const stored = loadStoredTheme();
  if (stored) setTheme(stored);
}

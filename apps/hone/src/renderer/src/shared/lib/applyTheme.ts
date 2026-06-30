import type { ThemeId } from '@widgets/CanvasBg';

const THEME_COLOR: Partial<Record<ThemeId, string>> = {
  light: '#fafaf8',
  birthday: '#140810',
};

/** Sync `<html>` palette class + meta theme-color with the selected canvas theme. */
export function applyTheme(theme: ThemeId): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.remove('light', 'birthday', 'dark');
  if (theme === 'light') {
    root.classList.add('light');
  } else if (theme === 'birthday') {
    root.classList.add('birthday', 'dark');
  } else {
    root.classList.add('dark');
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', THEME_COLOR[theme] ?? '#000000');
}

import type { ThemeId } from '@widgets/CanvasBg';

type Palette = 'light' | 'dark';

const THEME_PALETTE: Record<ThemeId, Palette> = {
  drift: 'light',
  visor: 'light',
  winter: 'dark',
  'birthday-light': 'light',
  particles: 'dark',
  debris: 'dark',
  launch: 'dark',
};

const THEME_COLOR: Partial<Record<ThemeId, string>> = {
  drift: '#fafaf8',
  visor: '#fafaf8',
  'birthday-light': '#fafaf8',
};

/** Sync `<html>` palette class + meta theme-color with the selected canvas theme. */
export function applyTheme(theme: ThemeId): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.remove('light', 'dark');
  const palette = THEME_PALETTE[theme] ?? 'dark';
  if (palette === 'light') {
    root.classList.add('light');
  } else {
    root.classList.add('dark');
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', THEME_COLOR[theme] ?? '#000000');
}

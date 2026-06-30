import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PREFS_KEYS } from '../prefs';

describe('prefs', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      localStorage: {
        store: {} as Record<string, string>,
        getItem(key: string) {
          return this.store[key] ?? null;
        },
        setItem(key: string, value: string) {
          this.store[key] = value;
        },
        removeItem(key: string) {
          delete this.store[key];
        },
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('defaults pomodoro to 25 minutes', async () => {
    const { readPomodoroSeconds } = await import('../prefs');
    expect(readPomodoroSeconds()).toBe(25 * 60);
  });

  it('reads pomodoro from settings blob', async () => {
    window.localStorage.setItem(
      PREFS_KEYS.SETTINGS_KEY,
      JSON.stringify({ pomodoroMinutes: 45, notifications: false }),
    );
    const { readPomodoroSeconds } = await import('../prefs');
    expect(readPomodoroSeconds()).toBe(45 * 60);
  });

  it('falls back to winter theme', async () => {
    const { readStoredTheme } = await import('../prefs');
    expect(readStoredTheme()).toBe('winter');
  });
});

// prefs.test.ts — synchronous localStorage readers (theme / pomodoro /
// daily goal / focus mode).
//
// Контракт:
//   • Дефолты применяются если ничего нет в storage.
//   • JSON parse-errors не падают — возвращают defaults.
//   • Clamp работает: number outside [lo, hi] → fallback внутри границ.
//   • Theme id whitelist — unknown значение → 'winter' default.
//   • FocusMode whitelist — unknown значение → 'pomodoro' default.
//   • writeFocusMode persist'ит string и readFocusMode читает обратно.

import { describe, it, expect, beforeEach } from 'vitest';

const SETTINGS_KEY = 'hone:settings';
const THEME_KEY = 'hone:theme';
const FOCUS_MODE_KEY = 'hone:focusMode';

// happy-dom localStorage = Proxy с lazy method-binding'ом. После
// vi.restoreAllMocks() (см. test/setup.ts) прямой доступ к
// `window.localStorage.setItem` иногда возвращает undefined: ClassMethodBinder
// привязывает методы lazy и vitest-restore сбрасывает их.
//
// Решение: shim'аем глобальный localStorage через простой in-memory store.
// Тесты work на этом store; production code тоже его видит (нет import path
// различия).
class MemoryStorage {
  private data = new Map<string, string>();
  getItem(k: string): string | null {
    return this.data.has(k) ? this.data.get(k)! : null;
  }
  setItem(k: string, v: string): void {
    this.data.set(k, String(v));
  }
  removeItem(k: string): void {
    this.data.delete(k);
  }
  clear(): void {
    this.data.clear();
  }
  get length(): number {
    return this.data.size;
  }
  key(i: number): string | null {
    return Array.from(this.data.keys())[i] ?? null;
  }
}

const mem = new MemoryStorage();
Object.defineProperty(window, 'localStorage', {
  configurable: true,
  get: () => mem,
});

beforeEach(() => {
  mem.clear();
});

function setLS(key: string, value: string): void {
  mem.setItem(key, value);
}

describe('prefs — readSettings (через readPomodoroSeconds / readDailyGoalMin)', () => {
  it('defaults: pomodoro=25min, daily=120min', async () => {
    const { readPomodoroSeconds, readDailyGoalMin } = await import('../prefs');
    expect(readPomodoroSeconds()).toBe(25 * 60);
    expect(readDailyGoalMin()).toBe(120);
  });

  it('reads stored pomodoroMinutes — clamp в 5–90', async () => {
    setLS(SETTINGS_KEY, JSON.stringify({ pomodoroMinutes: 50 }));
    const { readPomodoroSeconds } = await import('../prefs');
    expect(readPomodoroSeconds()).toBe(50 * 60);
  });

  it('clamp pomodoro below 5 → 5', async () => {
    setLS(SETTINGS_KEY, JSON.stringify({ pomodoroMinutes: 2 }));
    const { readPomodoroSeconds } = await import('../prefs');
    expect(readPomodoroSeconds()).toBe(5 * 60);
  });

  it('clamp pomodoro above 90 → 90', async () => {
    setLS(SETTINGS_KEY, JSON.stringify({ pomodoroMinutes: 500 }));
    const { readPomodoroSeconds } = await import('../prefs');
    expect(readPomodoroSeconds()).toBe(90 * 60);
  });

  it('clamp dailyGoalMin в 15–480', async () => {
    setLS(SETTINGS_KEY, JSON.stringify({ dailyGoalMin: 999 }));
    const { readDailyGoalMin } = await import('../prefs');
    expect(readDailyGoalMin()).toBe(480);
  });

  it('non-finite number → fallback к default', async () => {
    setLS(SETTINGS_KEY, JSON.stringify({ pomodoroMinutes: 'abc', dailyGoalMin: NaN }));
    const { readPomodoroSeconds, readDailyGoalMin } = await import('../prefs');
    expect(readPomodoroSeconds()).toBe(25 * 60);
    expect(readDailyGoalMin()).toBe(120);
  });

  it('round float pomodoro → nearest int', async () => {
    setLS(SETTINGS_KEY, JSON.stringify({ pomodoroMinutes: 17.7 }));
    const { readPomodoroSeconds } = await import('../prefs');
    expect(readPomodoroSeconds()).toBe(18 * 60);
  });

  it('malformed JSON → defaults без exception', async () => {
    setLS(SETTINGS_KEY, '{not-json');
    const { readPomodoroSeconds, readDailyGoalMin } = await import('../prefs');
    expect(readPomodoroSeconds()).toBe(25 * 60);
    expect(readDailyGoalMin()).toBe(120);
  });
});

describe('prefs — readStoredTheme', () => {
  it('default winter если ничего не записано', async () => {
    const { readStoredTheme } = await import('../prefs');
    expect(readStoredTheme()).toBe('winter');
  });

  it('whitelist accept: aurora / grid-rain / particles / abyss / cosmic', async () => {
    const { readStoredTheme } = await import('../prefs');
    for (const id of ['aurora', 'grid-rain', 'particles', 'abyss', 'cosmic']) {
      setLS(THEME_KEY, id);
      expect(readStoredTheme()).toBe(id);
    }
  });

  it('unknown theme id → fallback winter', async () => {
    setLS(THEME_KEY, 'rainbow-unicorn');
    const { readStoredTheme } = await import('../prefs');
    expect(readStoredTheme()).toBe('winter');
  });
});

describe('prefs — focus mode', () => {
  it('default pomodoro', async () => {
    const { readFocusMode } = await import('../prefs');
    expect(readFocusMode()).toBe('pomodoro');
  });

  it('writeFocusMode then readFocusMode round-trip', async () => {
    const { readFocusMode, writeFocusMode } = await import('../prefs');
    writeFocusMode('stopwatch');
    expect(readFocusMode()).toBe('stopwatch');
    writeFocusMode('plan');
    expect(readFocusMode()).toBe('plan');
  });

  it('каждый из 6 канонических focus mode persist round-trip', async () => {
    const { readFocusMode, writeFocusMode, FOCUS_MODES } = await import('../prefs');
    for (const mode of FOCUS_MODES) {
      writeFocusMode(mode);
      expect(readFocusMode()).toBe(mode);
    }
  });

  it('garbage в storage → fallback pomodoro', async () => {
    setLS(FOCUS_MODE_KEY, 'badmode');
    const { readFocusMode } = await import('../prefs');
    expect(readFocusMode()).toBe('pomodoro');
  });
});

describe('prefs — PREFS_KEYS export', () => {
  it('exposes canonical storage keys', async () => {
    const { PREFS_KEYS } = await import('../prefs');
    expect(PREFS_KEYS.SETTINGS_KEY).toBe(SETTINGS_KEY);
    expect(PREFS_KEYS.THEME_KEY).toBe(THEME_KEY);
    expect(PREFS_KEYS.FOCUS_MODE_KEY).toBe(FOCUS_MODE_KEY);
  });
});

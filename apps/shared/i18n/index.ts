import { useCallback, useSyncExternalStore } from 'react';

import { en } from './locales/en';
import { ru } from './locales/ru';

const LOCALE_STORAGE_KEY = 'hone:locale';

export type Locale = 'en' | 'ru';
export type Dict = typeof en;
export type TFunc = (key: keyof Dict | string, params?: Record<string, string | number>) => string;

const dictionaries: Record<Locale, Record<string, string>> = { en, ru };

function readStoredLocale(): Locale | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (v === 'en' || v === 'ru') return v;
  } catch {
    /* ignore */
  }
  return null;
}

function defaultLocale(): Locale {
  const stored = readStoredLocale();
  if (stored) return stored;
  if (typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('ru')) {
    return 'ru';
  }
  return 'en';
}

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => String(params[key] ?? ''));
}

function lookup(locale: Locale, key: string): string {
  const dict = dictionaries[locale];
  return dict[key] ?? dictionaries.en[key] ?? key.split('.').pop()?.replace(/_/g, ' ') ?? key;
}

type LocaleState = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
};

let localeState: LocaleState = {
  locale: defaultLocale(),
  setLocale: (locale) => {
    localeState = { ...localeState, locale };
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
      } catch {
        /* ignore */
      }
    }
    for (const listener of localeListeners) listener();
  },
};

const localeListeners = new Set<() => void>();

function subscribeLocale(listener: () => void): () => void {
  localeListeners.add(listener);
  return () => localeListeners.delete(listener);
}

function getLocaleSnapshot(): Locale {
  return localeState.locale;
}

/** Current UI locale (non-React callers, e.g. date formatters). */
export function getLocale(): Locale {
  return getLocaleSnapshot();
}

export function localeToBcp47(locale: Locale): string {
  return locale === 'ru' ? 'ru-RU' : 'en-US';
}

/** Zustand-compatible getState for LanguageSection bootstrap. */
export const useLocaleStore = {
  getState: (): LocaleState => localeState,
  subscribe: (listener: (state: LocaleState, prev: LocaleState) => void) => {
    let prev = localeState;
    const wrapped = () => {
      const next = localeState;
      listener(next, prev);
      prev = next;
    };
    localeListeners.add(wrapped);
    return () => localeListeners.delete(wrapped);
  },
};

export function translate(key: string, params?: Record<string, string | number>): string {
  return interpolate(lookup(localeState.locale, key), params);
}

export function useT(): TFunc {
  const locale = useSyncExternalStore(subscribeLocale, getLocaleSnapshot, getLocaleSnapshot);
  return useCallback(
    (key: keyof Dict | string, params?: Record<string, string | number>) =>
      interpolate(lookup(locale, String(key)), params),
    [locale],
  );
}

export function useLocale(): [Locale, (locale: Locale) => void] {
  const locale = useSyncExternalStore(subscribeLocale, getLocaleSnapshot, getLocaleSnapshot);
  return [locale, localeState.setLocale];
}

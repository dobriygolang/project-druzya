import { useCallback } from 'react';

import { createPromiseClient } from '@connectrpc/connect';
import { ProfileService } from '@generated/pb/druz9/v1/profile_connect';

import { useT, useLocale, useLocaleStore, type Locale } from '@d9-i18n';
import { transport } from '../../../api/transport';

// LanguageSection — language toggle. Source of truth is users.locale (DB):
// при выборе ru/en local store обновляется immediately + backend Settings RPC
// чтобы LLM (coach / mock / copilot в web) отвечал next call на том же языке.
// Cross-product sync приходит наутро при следующем bootstrap'е.
const profileClient = createPromiseClient(ProfileService, transport);

const wrapStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 10 };
const rowStyle: React.CSSProperties = { display: 'flex', gap: 8 };

const btnBase: React.CSSProperties = {
  flex: 1,
  padding: '10px 14px',
  borderRadius: 8,
  border: '1px solid var(--ink-20)',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'background-color var(--motion-dur-micro) var(--motion-ease-standard), border-color var(--motion-dur-micro) var(--motion-ease-standard), color var(--motion-dur-micro) var(--motion-ease-standard)',
};

const btnActiveStyle: React.CSSProperties = {
  ...btnBase,
  background: 'var(--ink-95)',
  color: 'var(--bg)',
};

const btnIdleStyle: React.CSSProperties = {
  ...btnBase,
  background: 'transparent',
  color: 'var(--ink-90)',
};

const LOCALES = ['ru', 'en'] as const;

export function LanguageSection() {
  const t = useT();
  const [locale, setLocale] = useLocale();

  const pick = useCallback(
    (next: Locale) => {
      if (next === locale) return;
      setLocale(next);
      void profileClient.updateSettings({ settings: { locale: next } }).catch((err: unknown) => {
        console.warn('hone.LanguageSection: backend sync failed', err);
      });
    },
    [locale, setLocale],
  );

  return (
    <div style={wrapStyle}>
      <div style={rowStyle}>
        {LOCALES.map((l) => {
          const active = locale === l;
          return (
            <button
              key={l}
              type="button"
              onClick={() => pick(l)}
              style={active ? btnActiveStyle : btnIdleStyle}
            >
              {l === 'ru' ? t('common.lang.ru') : t('common.lang.en')}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Exposed for bootstrap to read the current locale after auth restore.
export function getCurrentHoneLocale(): Locale {
  return useLocaleStore.getState().locale;
}

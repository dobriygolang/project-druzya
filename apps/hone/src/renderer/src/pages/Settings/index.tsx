import { useCallback, useEffect, useMemo, useState } from 'react';

import { useT } from '@d9-i18n';

import { type ThemeId, THEME_IDS } from '@widgets/CanvasBg';
import { HONE_HEADER_H } from '@widgets/Chrome';
import { readPomodoroSeconds as readPomodoroSecondsFromPrefs, readStoredTheme as readStoredThemeFromPrefs } from '@shared/model/prefs';
import { SignOutSection } from './sections/SignOutSection';
import { readSettings, SETTINGS_KEY, THEME_KEY, type HoneSettings } from './lib/settings-store';
import { Section, SectionHead } from './primitives/SectionGroup';
import { Slider } from './primitives/Slider';
import { Toggle } from './primitives/Toggle';
import { ThemeCard } from './primitives/ThemeCard';
import { LanguageSection } from './sections/LanguageSection';

export const readPomodoroSeconds = readPomodoroSecondsFromPrefs;
export const readStoredTheme = readStoredThemeFromPrefs;

interface SettingsPageProps {
  theme: ThemeId;
  onThemeChange: (t: ThemeId) => void;
  onPomoChange?: (secs: number) => void;
}

const pageStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  overflowY: 'auto',
  padding: `${HONE_HEADER_H}px 48px 80px`,
};
const innerStyle: React.CSSProperties = { maxWidth: 760, margin: '0 auto' };
const headingStyle: React.CSSProperties = {
  margin: '8px 0 24px',
  fontSize: 28,
  fontWeight: 500,
  letterSpacing: '-0.015em',
};
const themeGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
  gap: 14,
};

export function SettingsPage({ theme, onThemeChange, onPomoChange }: SettingsPageProps) {
  const t = useT();
  const [settings, setSettings] = useState<HoneSettings>(() => readSettings());

  useEffect(() => {
    try {
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      /* ignore */
    }
  }, [settings]);

  const setPomo = useCallback(
    (n: number) => {
      setSettings((s) => ({ ...s, pomodoroMinutes: n }));
      onPomoChange?.(n * 60);
    },
    [onPomoChange],
  );
  const setNotif = useCallback((b: boolean) => setSettings((s) => ({ ...s, notifications: b })), []);

  const pickTheme = useCallback(
    (id: ThemeId) => {
      onThemeChange(id);
      try {
        window.localStorage.setItem(THEME_KEY, id);
      } catch {
        /* ignore */
      }
    },
    [onThemeChange],
  );

  const sections = useMemo(
    () => [
      { title: 'SIGN OUT', hint: 'Clear local session.', render: () => <SignOutSection /> },
      { title: 'INTERFACE LANGUAGE', hint: 'Local preference.', render: () => <LanguageSection /> },
      {
        title: 'BACKGROUND THEME',
        hint: 'Ambient motion behind your work.',
        render: () => (
          <div style={themeGridStyle}>
            {THEME_IDS.map((id) => (
              <ThemeCard key={id} id={id} active={theme === id} onPick={() => pickTheme(id)} />
            ))}
          </div>
        ),
      },
      {
        title: 'POMODORO',
        hint: 'Default focus session length.',
        render: () => (
          <Slider min={5} max={90} step={5} value={settings.pomodoroMinutes} onChange={setPomo} unit="min" />
        ),
      },
      {
        title: 'NOTIFICATIONS',
        hint: 'System notification when a session ends.',
        render: () => (
          <Toggle value={settings.notifications} onChange={setNotif} label={settings.notifications ? 'On' : 'Off'} />
        ),
      },
    ],
    [theme, pickTheme, settings, setPomo, setNotif],
  );

  return (
    <div className="slide-from-bottom" style={pageStyle}>
      <div style={innerStyle}>
        <SectionHead label="SETTINGS" />
        <h1 style={headingStyle}>{t('hone.settings.heading')}</h1>
        {sections.map((s) => (
          <Section key={s.title} title={s.title} hint={s.hint}>
            {s.render()}
          </Section>
        ))}
      </div>
    </div>
  );
}

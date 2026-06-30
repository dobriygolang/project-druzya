import { useCallback, useEffect, useMemo, useState } from 'react';

import { useT, useLocale, type Locale } from '@d9-i18n';

import { type ThemeId, THEME_IDS } from '@widgets/CanvasBg';
import { applyTextScale } from '@shared/model/accessibility';
import { readPomodoroSeconds as readPomodoroSecondsFromPrefs, readStoredTheme as readStoredThemeFromPrefs } from '@shared/model/prefs';
import { SignOutSection } from './sections/SignOutSection';
import { SoftwareSection } from './sections/SoftwareSection';
import { GoogleCalendarSection } from './sections/GoogleCalendarSection';
import { VaultSection } from './sections/VaultSection';
import {
  readSettings,
  SETTINGS_KEY,
  TEXT_SCALES,
  THEME_KEY,
  type HoneSettings,
  type TextScale,
} from './lib/settings-store';
import { SettingRow, SettingsGroup } from './primitives/SettingRow';
import { SegmentedControl } from './primitives/SegmentedControl';
import { Slider } from './primitives/Slider';
import { Toggle } from './primitives/Toggle';
import { ThemeCard } from './primitives/ThemeCard';

export const readPomodoroSeconds = readPomodoroSecondsFromPrefs;
export const readStoredTheme = readStoredThemeFromPrefs;

interface SettingsPageProps {
  theme: ThemeId;
  onThemeChange: (t: ThemeId) => void;
  onPomoChange?: (secs: number) => void;
}

const LOCALES: Locale[] = ['ru', 'en'];

export function SettingsPage({ theme, onThemeChange, onPomoChange }: SettingsPageProps) {
  const t = useT();
  const [locale, setLocale] = useLocale();
  const [settings, setSettings] = useState<HoneSettings>(() => readSettings());

  useEffect(() => {
    try {
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      /* ignore */
    }
    applyTextScale(settings.textScale);
  }, [settings]);

  const setPomo = useCallback(
    (n: number) => {
      setSettings((s) => ({ ...s, pomodoroMinutes: n }));
      onPomoChange?.(n * 60);
    },
    [onPomoChange],
  );

  const setNotif = useCallback((b: boolean) => setSettings((s) => ({ ...s, notifications: b })), []);

  const setTextScale = useCallback((scale: TextScale) => {
    setSettings((s) => ({ ...s, textScale: scale }));
  }, []);

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

  const localeOptions = useMemo(
    () =>
      LOCALES.map((l) => ({
        value: l,
        label: l === 'ru' ? t('common.lang.ru') : t('common.lang.en'),
      })),
    [t],
  );

  const textScaleOptions = useMemo(
    () =>
      TEXT_SCALES.map((scale) => ({
        value: scale,
        label:
          scale === 'normal'
            ? t('hone.settings.text_scale.normal')
            : scale === 'large'
              ? t('hone.settings.text_scale.large')
              : t('hone.settings.text_scale.xlarge'),
      })),
    [t],
  );

  return (
    <div className="hone-settings-page">
      <div className="hone-settings-page__inner">
        <p className="hone-settings-page__eyebrow mono">{t('hone.settings.eyebrow').toUpperCase()}</p>
        <h1 className="hone-settings-page__title">{t('hone.settings.heading')}</h1>

        <SettingsGroup title={t('hone.settings.section.appearance')}>
          <SettingRow label={t('hone.settings.language.label')} hint={t('hone.settings.language.hint')}>
            <SegmentedControl
              ariaLabel={t('hone.settings.language.label')}
              value={locale}
              options={localeOptions}
              onChange={setLocale}
            />
          </SettingRow>

          <SettingRow label={t('hone.settings.text_scale.label')} hint={t('hone.settings.text_scale.hint')}>
            <SegmentedControl
              ariaLabel={t('hone.settings.text_scale.label')}
              value={settings.textScale}
              options={textScaleOptions}
              onChange={setTextScale}
            />
          </SettingRow>

          <SettingRow label={t('hone.settings.theme.label')} hint={t('hone.settings.theme.hint')}>
            <div className="hone-settings-theme-grid">
              {THEME_IDS.map((id) => (
                <ThemeCard key={id} id={id} active={theme === id} onPick={() => pickTheme(id)} />
              ))}
            </div>
          </SettingRow>
        </SettingsGroup>

        <SettingsGroup title={t('hone.settings.section.focus')}>
          <SettingRow label={t('hone.settings.pomodoro.label')} hint={t('hone.settings.pomodoro.hint')}>
            <Slider
              min={5}
              max={90}
              step={5}
              value={settings.pomodoroMinutes}
              onChange={setPomo}
              unit={t('hone.settings.pomodoro.unit')}
            />
          </SettingRow>

          <SettingRow label={t('hone.settings.notifications.label')} hint={t('hone.settings.notifications.hint')}>
            <Toggle
              value={settings.notifications}
              onChange={setNotif}
              label={settings.notifications ? t('hone.settings.notifications.on') : t('hone.settings.notifications.off')}
            />
          </SettingRow>
        </SettingsGroup>

        <SettingsGroup title={t('hone.settings.section.integrations')}>
          <GoogleCalendarSection />
        </SettingsGroup>

        <VaultSection />

        <SoftwareSection />

        <SettingsGroup title={t('hone.settings.section.account')}>
          <SignOutSection />
        </SettingsGroup>
      </div>
    </div>
  );
}

import { useCallback, useEffect, useState } from 'react';

import { useT } from '@d9-i18n';

import {
  disconnectGoogleCalendar,
  getGoogleCalendarAuthURL,
  getTrackerSettings,
  openExternalUrl,
  updateTrackerSettings,
  type TrackerSettings,
} from '@features/calendar/api/calendarClient';
import { LOCAL_ONLY } from '@app/config/features';
import { HONE_EVENTS } from '@shared/lib/custom-events';
import { SettingRow } from '../primitives/SettingRow';
import { Toggle } from '../primitives/Toggle';

export function GoogleCalendarSection(): JSX.Element | null {
  const t = useT();
  const [settings, setSettings] = useState<TrackerSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (LOCAL_ONLY) return;
    try {
      setSettings(await getTrackerSettings());
      setError(null);
    } catch {
      setError(t('hone.settings.google.error_load'));
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onOAuth = (e: Event): void => {
      const detail = (e as CustomEvent<{ status?: string; detail?: string | null }>).detail;
      if (!detail?.status) return;
      if (detail.status === 'connected') {
        void load();
        return;
      }
      setError(t('hone.settings.google.error_save'));
    };
    window.addEventListener(HONE_EVENTS.googleCalendarOAuth, onOAuth);
    return () => window.removeEventListener(HONE_EVENTS.googleCalendarOAuth, onOAuth);
  }, [load, t]);

  if (LOCAL_ONLY) return null;

  const connected = settings?.googleCalendarConnected ?? false;
  const syncEnabled = settings?.googleCalendarSyncEnabled ?? false;

  const setSync = async (enabled: boolean) => {
    setBusy(true);
    setError(null);
    try {
      setSettings(await updateTrackerSettings({ googleCalendarSyncEnabled: enabled }));
    } catch {
      setError(t('hone.settings.google.error_save'));
    } finally {
      setBusy(false);
    }
  };

  const connect = async () => {
    setBusy(true);
    setError(null);
    try {
      const url = await getGoogleCalendarAuthURL();
      openExternalUrl(url);
    } catch {
      setError(t('hone.settings.google.error_connect'));
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    setError(null);
    try {
      setSettings(await disconnectGoogleCalendar());
    } catch {
      setError(t('hone.settings.google.error_disconnect'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <SettingRow label={t('hone.settings.google.sync_label')} hint={t('hone.settings.google.sync_hint')}>
        <Toggle
          value={syncEnabled}
          onChange={(v) => void setSync(v)}
          label={syncEnabled ? t('hone.settings.google.sync_on') : t('hone.settings.google.sync_off')}
        />
      </SettingRow>

      <SettingRow label={t('hone.settings.google.account_label')} hint={t('hone.settings.google.account_hint')}>
        <div className="hone-settings-google-actions">
          <span className="mono hone-settings-google-status">
            {connected ? t('hone.settings.google.connected') : t('hone.settings.google.not_connected')}
          </span>
          {connected ? (
            <button type="button" className="hone-settings-vault-btn" disabled={busy} onClick={() => void disconnect()}>
              {t('hone.settings.google.disconnect')}
            </button>
          ) : (
            <button type="button" className="hone-settings-vault-btn" disabled={busy} onClick={() => void connect()}>
              {t('hone.settings.google.connect')}
            </button>
          )}
          <button type="button" className="hone-settings-vault-btn" disabled={busy} onClick={() => void load()}>
            {t('hone.settings.google.refresh')}
          </button>
        </div>
      </SettingRow>

      {error && <p className="hone-settings-google-error mono">{error}</p>}
    </>
  );
}

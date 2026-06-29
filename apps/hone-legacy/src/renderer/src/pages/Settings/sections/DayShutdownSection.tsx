// Main process owns the timer + truth (userData/day_shutdown.json) since the
// scheduler must survive renderer reloads. This section only reads/writes
// settings over a narrow IPC.
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useT } from '@d9-i18n';

const IPC_GET = 'day-shutdown:get-settings';
const IPC_SET = 'day-shutdown:set-settings';

interface DayShutdownSettings {
  enabled: boolean;
  time: string; // HH:MM
}

interface DayShutdownBridge {
  get: () => Promise<DayShutdownSettings>;
  set: (s: DayShutdownSettings) => Promise<void>;
}

function getBridge(): DayShutdownBridge | null {
  // ipcRenderer is not exposed by default — we route through window.__honeIPC
  // which the preload patches in alongside the other bridges. If absent (older
  // preload), the section turns into a read-only informational block.
  const ipc = window.__honeIPC;
  if (!ipc) return null;
  return {
    get: () => ipc.invoke(IPC_GET) as Promise<DayShutdownSettings>,
    set: (s) => ipc.invoke(IPC_SET, s) as Promise<void>,
  };
}

const DEFAULT_TIME = '21:00';

const wrapStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 12 };

const leadStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 12,
  lineHeight: 1.55,
  color: 'var(--ink-60)',
  maxWidth: 580,
};

const noteStyle: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--ink-40)',
  letterSpacing: '0.04em',
  padding: '6px 10px',
  border: '1px solid var(--ink-10)',
  borderRadius: 6,
};

const checkboxStyle: React.CSSProperties = { width: 16, height: 16, accentColor: '#ffffff' };

const timeInputStyle: React.CSSProperties = {
  padding: '6px 10px',
  fontSize: 13,
  background: 'transparent',
  border: '1px solid var(--ink-10)',
  borderRadius: 6,
  color: 'var(--ink-90)',
  fontFamily: 'inherit',
};

export function DayShutdownSection() {
  const t = useT();
  // Bridge is process-stable; memo so deps below don't churn.
  const bridge = useMemo(() => getBridge(), []);
  const [enabled, setEnabled] = useState<boolean>(true);
  const [time, setTime] = useState<string>(DEFAULT_TIME);
  const [loaded, setLoaded] = useState<boolean>(false);

  useEffect(() => {
    if (!bridge) {
      setLoaded(true);
      return;
    }
    let cancelled = false;
    void bridge.get().then((s) => {
      if (cancelled) return;
      setEnabled(s.enabled);
      setTime(s.time || DEFAULT_TIME);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [bridge]);

  // Persist on changes (debounced through React's batching naturally).
  useEffect(() => {
    if (!bridge || !loaded) return;
    void bridge.set({ enabled, time });
  }, [bridge, loaded, enabled, time]);

  const onToggle = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setEnabled(e.target.checked),
    [],
  );
  const onTimeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setTime(e.target.value),
    [],
  );

  const toggleLabelStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    fontSize: 13,
    color: 'var(--ink-90)',
    cursor: bridge ? 'pointer' : 'default',
  };

  const timeLabelStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    fontSize: 13,
    color: 'var(--ink-90)',
    opacity: enabled && bridge ? 1 : 0.5,
  };

  return (
    <div style={wrapStyle}>
      <p style={leadStyle}>{t('hone.day_shutdown.lead')}</p>
      {!bridge && (
        <div className="mono" style={noteStyle}>
          {t('hone.day_shutdown.note_desktop_only')}
        </div>
      )}
      <label style={toggleLabelStyle}>
        <input
          type="checkbox"
          checked={enabled}
          onChange={onToggle}
          disabled={!bridge}
          style={checkboxStyle}
        />
        {t('hone.day_shutdown.toggle_label')}
      </label>
      <label style={timeLabelStyle}>
        {t('hone.day_shutdown.time_label')}
        <input
          type="time"
          value={time}
          onChange={onTimeChange}
          disabled={!enabled || !bridge}
          className="focus-ring"
          style={timeInputStyle}
        />
      </label>
    </div>
  );
}

// FocusModeSection — macOS Focus mode integration.
//
// Hone не блокирует приложения напрямую — это требовало бы accessibility
// permission'ов / kernel hooks. Вместо этого делегируем macOS-у:
//
//   1. Юзер открывает System Settings → Focus, создаёт новый Focus
//      (например, "Druz9 Focus") с собственными app/website-фильтрами
//      (Twitter, Reddit, YouTube…).
//   2. Юзер создаёт shortcut с именем (например, "Druz9 Focus On"),
//      action = "Set Focus" → выбирает "Druz9 Focus" с настройкой
//      "Turn On". В подавляющем большинстве случаев macOS сам
//      автоматически создаёт «Set Druz9 Focus» shortcut.
//   3. Юзер вписывает имя shortcut'а сюда.
//   4. Hone вызывает `shortcuts run "<name>"` на старте/завершении
//      pomodoro через main process (focus_mode.ts).
//
// Сохранение: localStorage `hone:focus:macos-mode-name`. Пустая строка
// = блокировка отключена (no-op).
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useT, translate } from '@d9-i18n';

export const FOCUS_MODE_NAME_KEY = 'hone:focus:macos-mode-name';

/** Returns the stored shortcut name (trimmed) or '' если не задано. */
export function readFocusModeName(): string {
  if (typeof window === 'undefined') return '';
  try {
    return (window.localStorage.getItem(FOCUS_MODE_NAME_KEY) ?? '').trim();
  } catch {
    return '';
  }
}

type Status = { kind: 'idle' } | { kind: 'busy' } | { kind: 'ok' } | { kind: 'err'; msg: string };

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

const rowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 10,
  alignItems: 'center',
  flexWrap: 'wrap',
};

const inputStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 220,
  padding: '8px 12px',
  fontSize: 13,
  background: 'transparent',
  border: '1px solid var(--ink-10)',
  borderRadius: 8,
  color: 'var(--ink-90)',
  outline: 'none',
  fontFamily: 'inherit',
};

const okStyle: React.CSSProperties = { fontSize: 12, color: 'var(--ink-60)' };

const errWrapStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 10,
  fontSize: 11.5,
  color: 'var(--red)',
};

const errDashStyle: React.CSSProperties = {
  display: 'inline-block',
  width: 24,
  height: 1.5,
  background: 'var(--red)',
  marginTop: 5,
  flex: '0 0 auto',
};

export function FocusModeSection() {
  const t = useT();
  const [value, setValue] = useState<string>(() => readFocusModeName());
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  // Persist on every change. Triming на write — пустое имя = выключено.
  useEffect(() => {
    try {
      window.localStorage.setItem(FOCUS_MODE_NAME_KEY, value.trim());
    } catch {
      /* ignore quota / private mode */
    }
  }, [value]);

  const isMac = useMemo(
    () => typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform ?? ''),
    [],
  );

  const handleCheck = useCallback(async () => {
    const name = value.trim();
    if (!name) {
      setStatus({ kind: 'err', msg: translate('hone.focus_mode.err.empty') });
      return;
    }
    const bridge = typeof window !== 'undefined' ? window.hone : undefined;
    if (!bridge?.focusMode?.start) {
      setStatus({ kind: 'err', msg: translate('hone.focus_mode.err.no_bridge') });
      return;
    }
    setStatus({ kind: 'busy' });
    try {
      const res = await bridge.focusMode.start(name);
      if (res.ok) {
        setStatus({ kind: 'ok' });
      } else {
        setStatus({ kind: 'err', msg: res.error ?? translate('hone.focus_mode.err.run_failed') });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatus({ kind: 'err', msg });
    }
  }, [value]);

  const handleInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
    setStatus((prev) => (prev.kind !== 'idle' && prev.kind !== 'busy' ? { kind: 'idle' } : prev));
  }, []);

  const handleClick = useCallback(() => void handleCheck(), [handleCheck]);

  const trimmedLen = value.trim().length;
  const busy = status.kind === 'busy';
  const buttonStyle = useMemo<React.CSSProperties>(
    () => ({
      padding: '8px 14px',
      fontSize: 12,
      background: 'transparent',
      border: '1px solid var(--ink-20)',
      borderRadius: 8,
      color: 'var(--ink-90)',
      cursor: busy ? 'default' : 'pointer',
      opacity: trimmedLen === 0 ? 0.5 : 1,
      fontFamily: 'inherit',
      letterSpacing: '0.04em',
    }),
    [busy, trimmedLen],
  );

  return (
    <div style={wrapStyle}>
      <p style={leadStyle}>{t('hone.focus_mode.lead')}</p>
      {!isMac && (
        <div className="mono" style={noteStyle}>
          {t('hone.focus_mode.note_macos_only')}
        </div>
      )}
      <div style={rowStyle}>
        <input
          type="text"
          placeholder="Druz9 Focus On"
          value={value}
          onChange={handleInput}
          className="focus-ring"
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
          style={inputStyle}
        />
        <button
          type="button"
          onClick={handleClick}
          disabled={busy || trimmedLen === 0}
          className="focus-ring"
          style={buttonStyle}
        >
          {busy ? t('hone.focus_mode.cta.testing') : t('hone.focus_mode.cta.test')}
        </button>
      </div>
      {status.kind === 'ok' && <div style={okStyle}>{t('hone.focus_mode.ready')}</div>}
      {status.kind === 'err' && (
        <div className="mono" style={errWrapStyle}>
          <span aria-hidden="true" style={errDashStyle} />
          <span>{status.msg}</span>
        </div>
      )}
    </div>
  );
}

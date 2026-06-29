// QuickCaptureSection — Quick Capture global hotkey.
//
// Renders a single toggle: «Включить глобальный захват (⌘⇧Space)». Reads /
// writes the flag via main-process IPC (it owns the on-disk file under
// userData/quick_capture.json, since main is what registers the hotkey
// before any renderer is loaded).
//
// We avoid persisting through localStorage here because the renderer
// is not guaranteed to be loaded when the shortcut needs to be active
// (cold-launch: app.whenReady → globalShortcut.register → main window
// follows). Disk-backed state is the single source of truth.
import { useCallback, useEffect, useState } from 'react';

import { useT } from '@d9-i18n';

declare global {
  interface Window {
    honeQuickCapture?: {
      save: (text: string) => Promise<{ ok: boolean; error?: string }>;
      dismiss: () => Promise<void>;
      getEnabled: () => Promise<boolean>;
      setEnabled: (enabled: boolean) => Promise<void>;
    };
  }
}

const wrapStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 12 };

const leadStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 12,
  lineHeight: 1.55,
  color: 'var(--ink-60)',
  maxWidth: 580,
};

const monoInkStyle: React.CSSProperties = { color: 'var(--ink-90)' };

const checkboxStyle: React.CSSProperties = { width: 16, height: 16, accentColor: '#ffffff' };

export function QuickCaptureSection() {
  const t = useT();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [pending, setPending] = useState<boolean>(false);

  useEffect(() => {
    const bridge = typeof window !== 'undefined' ? window.honeQuickCapture : undefined;
    if (!bridge) {
      setEnabled(false);
      return;
    }
    let cancelled = false;
    void bridge.getEnabled().then((v) => {
      if (!cancelled) setEnabled(v);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleToggle = useCallback(async () => {
    const bridge = typeof window !== 'undefined' ? window.honeQuickCapture : undefined;
    if (!bridge || enabled === null) return;
    const next = !enabled;
    setPending(true);
    try {
      await bridge.setEnabled(next);
      setEnabled(next);
    } finally {
      setPending(false);
    }
  }, [enabled]);

  const onChange = useCallback(() => void handleToggle(), [handleToggle]);

  const labelStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    cursor: enabled === null || pending ? 'default' : 'pointer',
    fontSize: 13,
    color: 'var(--ink-90)',
  };

  return (
    <div style={wrapStyle}>
      <p style={leadStyle}>
        {t('hone.quick_capture.lead_pre')}
        <span className="mono" style={monoInkStyle}>
          ⌘⇧Space
        </span>
        {t('hone.quick_capture.lead_post')}
        <span className="mono" style={monoInkStyle}>
          #inbox
        </span>
        .
      </p>
      <label style={labelStyle}>
        <input
          type="checkbox"
          checked={enabled === true}
          disabled={enabled === null || pending}
          onChange={onChange}
          style={checkboxStyle}
        />
        {t('hone.quick_capture.toggle_label')}
      </label>
    </div>
  );
}

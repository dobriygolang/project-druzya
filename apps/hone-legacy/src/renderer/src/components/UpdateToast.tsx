// UpdateToast — минимальный non-intrusive toast в углу.
//
// Отображается когда updaterStatus = { kind: 'downloaded' } — main
// скачал новую версию, ждёт quit+install. Клик по «Restart» вызывает
// window.hone.updater.install(), Electron закрывается и стартует с
// новой версией.
//
// 'checking' / 'available' — тихо, не отвлекаем. 'error' — тоже тихо
// (попробует ещё раз через 4 часа).
import { memo, useCallback, useEffect, useState, type CSSProperties } from 'react';

import type { EventPayload } from '../../../shared/ipc';
import { zIndex } from '../lib/z-index';

type Status = EventPayload['updaterStatus'];

const ROOT_STYLE: CSSProperties = {
  position: 'fixed',
  bottom: 100,
  right: 24,
  zIndex: zIndex.toast,
  padding: '12px 16px',
  borderRadius: 'var(--radius-inner)',
  background: 'rgba(12,12,12,0.94)',
  border: '1px solid rgb(var(--ink-rgb) / 0.1)',
  backdropFilter: 'blur(14px)',
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  fontSize: 12.5,
  color: 'var(--ink)',
  boxShadow: '0 16px 40px -10px rgba(0,0,0,0.7)',
};

const RESTART_BTN_STYLE: CSSProperties = {
  padding: '5px 11px',
  fontSize: 10,
  letterSpacing: '0.08em',
  color: '#000',
  background: '#fff',
  borderRadius: 'var(--radius-inner)',
};

export const UpdateToast = memo(function UpdateToast() {
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  useEffect(() => {
    const bridge = typeof window !== 'undefined' ? window.hone : undefined;
    if (!bridge) return;
    const off = bridge.on('updaterStatus', setStatus);
    return off;
  }, []);

  const handleRestart = useCallback(() => {
    void window.hone.updater.install();
  }, []);

  if (status.kind !== 'downloaded') return null;

  return (
    <div
      className="fadein"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      style={ROOT_STYLE}
    >
      <span>
        Hone {status.version} is ready.
      </span>
      <button type="button" onClick={handleRestart} className="focus-ring mono" style={RESTART_BTN_STYLE}>
        RESTART
      </button>
    </div>
  );
});

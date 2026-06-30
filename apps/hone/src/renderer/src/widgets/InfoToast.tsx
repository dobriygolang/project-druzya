import { useToastStore } from '@shared/model/toast';
import { zIndex } from '@shared/lib/z-index';

export function InfoToastContainer(): JSX.Element | null {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismissToast);
  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 88,
        right: 28,
        zIndex: zIndex.toast,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        maxWidth: 320,
      }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          style={{
            padding: '10px 14px',
            borderRadius: 10,
            background: 'rgba(12,12,12,0.94)',
            border: '1px solid var(--ink-tint-08)',
            color: 'var(--ink-90)',
            fontSize: 12,
            boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <span>{t.message}</span>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--ink-40)',
                cursor: 'pointer',
                fontSize: 11,
              }}
            >
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

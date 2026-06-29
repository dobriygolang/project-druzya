// ConflictModal — surfaces 409 (version_mismatch) conflicts из outbox /
// sync handlers. Two-column diff view: local vs server, плюс three actions:
//
//   • Keep local        — отправляет local snapshot заново с force-overwrite
//   • Accept server     — drops local change, обновляет UI to server state
//   • Merge manually    — opens a side-by-side textarea editor с обеими
//                         versions; юзер собирает финальный текст руками,
//                         submits как новую save (local-win).
//
// Контракт: модал управляется через `useConflictStore`. Caller выявляет 409
// у себя (см outbox/wire.ts `rpcError` или прямой sync handler) и пушит:
//
//   useConflictStore.getState().open({
//     kind: 'note',
//     id: noteId,
//     local: { title, body, updatedAt },
//     server: { title, body, updatedAt },
//     onKeepLocal: () => retryWithForceFlag(),
//     onAcceptServer: () => reloadFromServer(),
//     onMergeManually: (merged) => saveMerged(merged),
//   });
//
// Modal subscribes к store, рендерится once в App.tsx (top-level).
//
// Polish-scope only — caller integration на стороне sync handlers лежит
// на следующем PR'е. Этот компонент plug-and-play через store.
import { useEffect, useState } from 'react';
import { create } from 'zustand';

import { zIndex } from '../lib/z-index';
import { HONE_EVENTS } from '../lib/custom-events';

interface ConflictSnapshot {
  title?: string;
  body: string;
  updatedAt?: string;
}

export interface ConflictPayload {
  kind: 'note' | 'task' | 'editor_doc' | 'whiteboard' | string;
  id: string;
  local: ConflictSnapshot;
  server: ConflictSnapshot;
  // Three resolution handlers. Modal calls one then closes.
  onKeepLocal: () => void | Promise<void>;
  onAcceptServer: () => void | Promise<void>;
  onMergeManually: (merged: string) => void | Promise<void>;
}

interface ConflictState {
  current: ConflictPayload | null;
  open: (p: ConflictPayload) => void;
  close: () => void;
}

const useConflictStore = create<ConflictState>((set) => ({
  current: null,
  open: (p) => set({ current: p }),
  close: () => set({ current: null }),
}));

// Convenience: callers без direct zustand-dep могут toss'нуть через event.
// useConflictListener подхватит и push'нет в store.
export function emitConflict(detail: ConflictPayload): void {
  window.dispatchEvent(new CustomEvent(HONE_EVENTS.conflict, { detail }));
}

export function useConflictListener(): void {
  const open = useConflictStore((s) => s.open);
  useEffect(() => {
    const h = (e: Event) => {
      const ce = e as CustomEvent<ConflictPayload>;
      if (ce.detail) open(ce.detail);
    };
    window.addEventListener(HONE_EVENTS.conflict, h as EventListener);
    return () => window.removeEventListener(HONE_EVENTS.conflict, h as EventListener);
  }, [open]);
}

export function ConflictModal(): JSX.Element | null {
  const current = useConflictStore((s) => s.current);
  const close = useConflictStore((s) => s.close);
  const [mergeMode, setMergeMode] = useState(false);
  const [mergedText, setMergedText] = useState('');
  const [busy, setBusy] = useState(false);

  // Reset state when payload changes.
  useEffect(() => {
    if (current) {
      setMergeMode(false);
      // Default merge text = local body (юзер edit'нёт оттуда).
      setMergedText(current.local.body);
      setBusy(false);
    }
  }, [current]);

  // Esc closes.
  useEffect(() => {
    if (!current) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) close();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [current, busy, close]);

  if (!current) return null;

  async function doAction(fn: () => void | Promise<void>) {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
      close();
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="conflict-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        zIndex: zIndex.toast,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
      onClick={() => { if (!busy) close(); }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 920,
          minWidth: 0,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg, #0d0d0d)',
          border: '1px solid rgb(var(--ink-rgb) / 0.10)',
          borderTop: '1.5px solid #FF3B30', // sync-conflict stripe
          borderRadius: 10,
          color: 'var(--ink)',
          fontFamily: 'inherit',
        }}
      >
        {/* Header */}
        <header style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--ink-tint-08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div
              id="conflict-modal-title"
              className="mono"
              style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-60)' }}
            >
              Sync conflict · {current.kind}
            </div>
            <div style={{ marginTop: 4, fontSize: 14, color: 'var(--ink)' }}>
              {current.local.title || current.server.title || current.id}
            </div>
          </div>
          <button
            onClick={() => { if (!busy) close(); }}
            aria-label="Close"
            disabled={busy}
            style={closeBtn}
          >
            ✕
          </button>
        </header>

        {/* Body: side-by-side OR merge editor */}
        {!mergeMode ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, flex: 1, minHeight: 0, background: 'var(--ink-tint-06)' }}>
            <Side
              label="Local version"
              hint={current.local.updatedAt ?? ''}
              body={current.local.body}
            />
            <Side
              label="Server version"
              hint={current.server.updatedAt ?? ''}
              body={current.server.body}
            />
          </div>
        ) : (
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: 16, gap: 8 }}>
            <div className="mono" style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-60)' }}>
              Manual merge — edit below, then save
            </div>
            <textarea
              value={mergedText}
              onChange={(e) => setMergedText(e.target.value)}
              spellCheck={false}
              style={{
                flex: 1,
                minHeight: 220,
                padding: 12,
                background: 'var(--ink-tint-02)',
                border: '1px solid rgb(var(--ink-rgb) / 0.10)',
                color: 'var(--ink)',
                borderRadius: 6,
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                fontSize: 12,
                lineHeight: 1.5,
                resize: 'vertical',
              }}
            />
            <details>
              <summary style={{ cursor: 'pointer', fontSize: 11, color: 'var(--ink-60)' }}>Show both originals</summary>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                <pre style={preStyle}><strong style={{ color: 'var(--ink-60)' }}>Local</strong>{'\n'}{current.local.body}</pre>
                <pre style={preStyle}><strong style={{ color: 'var(--ink-60)' }}>Server</strong>{'\n'}{current.server.body}</pre>
              </div>
            </details>
          </div>
        )}

        {/* Footer: actions */}
        <footer style={{ padding: '12px 20px', display: 'flex', justifyContent: 'flex-end', gap: 8, borderTop: '1px solid var(--ink-tint-08)', flexWrap: 'wrap' }}>
          {!mergeMode ? (
            <>
              <button
                onClick={() => setMergeMode(true)}
                disabled={busy}
                style={ghostBtn}
              >
                Merge manually
              </button>
              <span style={{ flex: 1, minWidth: 0 }} />
              <button
                onClick={() => void doAction(current.onAcceptServer)}
                disabled={busy}
                style={ghostBtn}
              >
                Accept server
              </button>
              <button
                onClick={() => void doAction(current.onKeepLocal)}
                disabled={busy}
                style={primaryBtn}
              >
                Keep local
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setMergeMode(false)}
                disabled={busy}
                style={ghostBtn}
              >
                Back
              </button>
              <span style={{ flex: 1, minWidth: 0 }} />
              <button
                onClick={() => void doAction(() => current.onMergeManually(mergedText))}
                disabled={busy || mergedText.length === 0}
                style={primaryBtn}
              >
                Save merge
              </button>
            </>
          )}
        </footer>
      </div>
    </div>
  );
}

function Side({ label, hint, body }: { label: string; hint: string; body: string }) {
  return (
    <div style={{ background: 'var(--bg, #0d0d0d)', padding: 16, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
        <div className="mono" style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-60)' }}>
          {label}
        </div>
        {hint && (
          <div className="mono" style={{ fontSize: 10, color: 'var(--ink-40)' }}>
            {hint}
          </div>
        )}
      </div>
      <pre style={{ ...preStyle, flex: 1, minHeight: 200, maxHeight: '60vh', overflow: 'auto' }}>{body || '—'}</pre>
    </div>
  );
}

const preStyle: React.CSSProperties = {
  margin: 0,
  padding: 10,
  background: 'var(--ink-tint-02)',
  border: '1px solid var(--ink-tint-06)',
  borderRadius: 6,
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontSize: 11.5,
  lineHeight: 1.5,
  color: 'var(--ink)',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
};

const ghostBtn: React.CSSProperties = {
  padding: '6px 12px',
  background: 'transparent',
  border: '1px solid rgb(var(--ink-rgb) / 0.18)',
  color: 'var(--ink)',
  borderRadius: 4,
  fontFamily: 'inherit',
  fontSize: 11,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  cursor: 'pointer',
};

const primaryBtn: React.CSSProperties = {
  padding: '6px 14px',
  background: 'var(--ink-tint-16)',
  border: '1px solid rgb(var(--ink-rgb) / 0.30)',
  color: 'var(--ink)',
  borderRadius: 4,
  fontFamily: 'inherit',
  fontSize: 11,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  cursor: 'pointer',
  fontWeight: 600,
};

const closeBtn: React.CSSProperties = {
  width: 28,
  height: 28,
  display: 'grid',
  placeItems: 'center',
  background: 'transparent',
  border: '1px solid rgb(var(--ink-rgb) / 0.10)',
  color: 'var(--ink-60)',
  borderRadius: 4,
  fontFamily: 'inherit',
  fontSize: 12,
  cursor: 'pointer',
};

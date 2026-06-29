// Transient toast «Auto-tagged as <Kind>» surfaced when backend's
// categoriser pushes a card.categorise SSE event OR BulkAutoCategorise
// stream packet arrives. Shows:
//   • Kind chip (icon + label).
//   • «Why?» chevron — expands to LLM reasoning (1-2 sentences).
//   • «Set to…» button — opens KindPicker for manual override.
//   • Auto-dismiss after 5.5s (clearable via × button).
//
// Renders inside <CategorizeToastContainer />, mounted globally в App.tsx
// — single instance reads the toast store and stacks active toasts at
// bottom-right (above the FAB which sits at 28px from the corner).
//
// B/W rule: red dot used ONLY as priority indicator (manual override hint).
// Background — hairline border on var(--surface-2), no color fill.

import { memo, useCallback, useState, type CSSProperties, type JSX } from 'react';

import { updateTaskKind, type TaskKind } from '../../api/tasks';
import {
  useToastStore,
  type CategorizeToastEntry,
  type InfoToastEntry,
  type ToastEntry,
} from '../../stores/toast';

import { KINDS, KindIcon } from './kinds';
import { KindPicker } from './KindPicker';

const CONTAINER_STYLE: CSSProperties = {
  position: 'fixed',
  bottom: 84,
  right: 24,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  zIndex: 650,
  pointerEvents: 'none',
  maxWidth: 'min(360px, calc(100vw - 48px))',
};

// CategorizeToastContainer — global mount point. Reads the toast store
// and renders a stacked column at the bottom-right corner.
export const CategorizeToastContainer = memo(function CategorizeToastContainer(): JSX.Element {
  const toasts = useToastStore((s) => s.toasts);
  return (
    <div
      role="region"
      aria-label="Notifications"
      aria-live="polite"
      style={CONTAINER_STYLE}
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} entry={t} />
      ))}
    </div>
  );
});

const ToastItem = memo(function ToastItem({ entry }: { entry: ToastEntry }): JSX.Element {
  if (entry.kind === 'info') {
    return <InfoToast entry={entry} />;
  }
  return <CategorizeToast entry={entry} />;
});

const INFO_TOAST_STYLE: CSSProperties = {
  padding: '8px 14px',
  fontSize: 12,
  color: 'var(--ink-60)',
  animation: 'toastIn var(--motion-dur-medium) var(--motion-ease-emphasized)',
};

// InfoToast — simple confirmation surface. Replaces the inline toasts
// previously rendered inside TaskBoard.tsx.
const InfoToast = memo(function InfoToast({ entry }: { entry: InfoToastEntry }): JSX.Element {
  const dismiss = useToastStore((s) => s.dismissToast);
  const handleClick = useCallback(() => dismiss(entry.id), [dismiss, entry.id]);
  return (
    <div style={INFO_TOAST_MERGED_STYLE} onClick={handleClick}>
      {entry.message}
      <style>{toastKeyframes}</style>
    </div>
  );
});

const CATEGORIZE_TOAST_STYLE: CSSProperties = {
  padding: '10px 12px 10px 14px',
  animation: 'toastIn var(--motion-dur-medium) var(--motion-ease-emphasized)',
};

const HEADER_ROW_STYLE: CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 };

const KIND_BADGE_STYLE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 22,
  height: 22,
  borderRadius: 5,
  background: 'var(--ink-tint-06)',
  flexShrink: 0,
};

const HEADER_TEXT_STYLE: CSSProperties = { flex: 1, minWidth: 0 };

const HEADER_KICKER_STYLE: CSSProperties = {
  fontSize: 9,
  fontWeight: 600,
  letterSpacing: '0.10em',
  textTransform: 'uppercase',
  color: 'var(--ink-40)',
  marginBottom: 2,
};

const HEADER_TITLE_STYLE: CSSProperties = {
  fontSize: 12.5,
  fontWeight: 600,
  color: 'var(--ink)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const HEADER_TITLE_TASK_STYLE: CSSProperties = { fontWeight: 400, color: 'var(--ink-40)', marginLeft: 6 };

const iconBtnStyle: CSSProperties = {
  background: 'transparent',
  border: 'none',
  padding: '2px 6px',
  cursor: 'pointer',
  borderRadius: 4,
  flexShrink: 0,
  color: 'inherit',
  fontFamily: 'inherit',
};

const DISMISS_BTN_STYLE: CSSProperties = {
  ...iconBtnStyle,
  color: 'var(--ink-40)',
  fontSize: 14,
  lineHeight: 1,
};

const ACTIONS_ROW_STYLE: CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, flexWrap: 'wrap' };

const CHEVRON_STYLE_BASE: CSSProperties = {
  display: 'inline-block',
  transition: 'transform var(--motion-dur-small) var(--motion-ease-standard)',
  fontSize: 9,
  marginRight: 4,
};

const CONFIDENCE_STYLE: CSSProperties = {
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: 9,
  color: 'var(--ink-40)',
  marginLeft: 'auto',
};

const REASONING_STYLE: CSSProperties = {
  margin: '8px 0 0',
  fontSize: 11.5,
  lineHeight: 1.55,
  color: 'var(--ink-60)',
  paddingTop: 8,
  borderTop: '1px solid var(--ink-20)',
};

// CategorizeToast — fuller toast with kind badge, reasoning, override.
const CategorizeToast = memo(function CategorizeToast({ entry }: { entry: CategorizeToastEntry }): JSX.Element {
  const dismiss = useToastStore((s) => s.dismissToast);
  const [expanded, setExpanded] = useState(false);
  const [pickerAnchor, setPickerAnchor] = useState<{ x: number; y: number } | null>(null);
  const [overrideInFlight, setOverrideInFlight] = useState(false);
  const def = KINDS[entry.detectedKind];

  const pickOverride = useCallback(async (nextKind: TaskKind): Promise<void> => {
    if (overrideInFlight) return;
    setOverrideInFlight(true);
    try {
      await updateTaskKind(entry.taskId, nextKind, true);
      dismiss(entry.id);
    } catch (err) {
      // Сохраняем toast открытым (не dismiss) — юзер увидит что override
      // не применился и может retry. Surface error в DevTools для debug.
      console.warn('CategorizeToast: updateTaskKind failed', err);
      setOverrideInFlight(false);
    }
  }, [overrideInFlight, entry.taskId, entry.id, dismiss]);

  const handleDismiss = useCallback(() => dismiss(entry.id), [dismiss, entry.id]);
  const toggleExpanded = useCallback(() => setExpanded((v) => !v), []);
  const closePicker = useCallback(() => setPickerAnchor(null), []);

  const handleSetTo = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setPickerAnchor({ x: r.left, y: r.top });
  }, []);

  const handlePick = useCallback((next: TaskKind) => {
    setPickerAnchor(null);
    void pickOverride(next);
  }, [pickOverride]);

  const setToBtnStyle: CSSProperties = {
    ...chevronBtnStyle,
    opacity: overrideInFlight ? 0.5 : 1,
    cursor: overrideInFlight ? 'wait' : 'pointer',
  };

  const chevronArrowStyle: CSSProperties = {
    ...CHEVRON_STYLE_BASE,
    transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
  };

  return (
    <article role="status" style={CATEGORIZE_TOAST_MERGED_STYLE}>
      <div style={HEADER_ROW_STYLE}>
        <span style={KIND_BADGE_STYLE}>
          <KindIcon kind={entry.detectedKind} size={14} color={def.color} />
        </span>
        <div style={HEADER_TEXT_STYLE}>
          <div style={HEADER_KICKER_STYLE}>
            Auto-tagged
          </div>
          <div style={HEADER_TITLE_STYLE} title={entry.taskTitle}>
            {def.label}
            <span style={HEADER_TITLE_TASK_STYLE}>
              · {truncate(entry.taskTitle, 28)}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss toast"
          style={DISMISS_BTN_STYLE}
        >
          ×
        </button>
      </div>

      <div style={ACTIONS_ROW_STYLE}>
        {entry.reasoning && (
          <button
            type="button"
            onClick={toggleExpanded}
            aria-expanded={expanded}
            style={chevronBtnStyle}
          >
            <span style={chevronArrowStyle}>
              {'▶'}
            </span>
            Why?
          </button>
        )}
        <button
          type="button"
          onClick={handleSetTo}
          aria-label="Override task kind"
          disabled={overrideInFlight}
          style={setToBtnStyle}
        >
          Set to…
        </button>
        {typeof entry.confidence === 'number' && entry.confidence > 0 && (
          <span
            style={CONFIDENCE_STYLE}
            title={`LLM self-confidence: ${(entry.confidence * 100).toFixed(0)}%`}
          >
            {(entry.confidence * 100).toFixed(0)}%
          </span>
        )}
      </div>

      {expanded && entry.reasoning && (
        <p style={REASONING_STYLE}>
          {entry.reasoning}
        </p>
      )}

      {pickerAnchor && (
        <KindPicker
          current={entry.detectedKind}
          anchor={pickerAnchor}
          onClose={closePicker}
          onPick={handlePick}
        />
      )}
      <style>{toastKeyframes}</style>
    </article>
  );
});

// ── styles ───────────────────────────────────────────────────────────────

const toastShellStyle: CSSProperties = {
  pointerEvents: 'auto',
  background: 'var(--surface-2)',
  border: '1px solid var(--ink-20)',
  borderRadius: 8,
  boxShadow: '0 4px 18px rgba(0,0,0,0.45)',
  minWidth: 240,
  cursor: 'default',
  display: 'flex',
  flexDirection: 'column',
};

const chevronBtnStyle: CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--ink-20)',
  color: 'var(--ink-60)',
  padding: '3px 9px',
  borderRadius: 5,
  fontSize: 10,
  fontWeight: 500,
  letterSpacing: '0.04em',
  cursor: 'pointer',
  fontFamily: 'inherit',
  display: 'inline-flex',
  alignItems: 'center',
  transition:
    'background var(--motion-dur-small) var(--motion-ease-standard), color var(--motion-dur-small) var(--motion-ease-standard), border-color var(--motion-dur-small) var(--motion-ease-standard)',
};

const INFO_TOAST_MERGED_STYLE: CSSProperties = { ...toastShellStyle, ...INFO_TOAST_STYLE };

const CATEGORIZE_TOAST_MERGED_STYLE: CSSProperties = { ...toastShellStyle, ...CATEGORIZE_TOAST_STYLE };

const toastKeyframes = `
@keyframes toastIn {
  from { opacity: 0; transform: translateY(8px) scale(0.98); }
  to   { opacity: 1; transform: translateY(0)  scale(1); }
}
`;

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return `${s.slice(0, n - 1)}…`;
}

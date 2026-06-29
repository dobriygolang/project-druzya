import { memo, type CSSProperties } from 'react';

import type { TaskCard } from '../../api/tasks';
import { KINDS } from './lib/kinds';
import { COLUMNS } from './lib/columns';
import { relativeAge } from './lib/helpers';

interface TaskDrawerProps {
  task: TaskCard | undefined;
  onClose: () => void;
}

const OVERLAY_STYLE: CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 400,
};
const ASIDE_STYLE: CSSProperties = {
  position: 'fixed', top: 0, right: 0, width: 420, maxWidth: '100vw', height: '100vh',
  background: 'var(--surface)', borderLeft: '1px solid var(--ink-20)', zIndex: 401,
  display: 'flex', flexDirection: 'column', overflow: 'hidden',
  animation: 'drawerIn 280ms ease',
};

export function TaskDrawer({ task, onClose }: TaskDrawerProps): JSX.Element | null {
  if (!task) return null;
  const k = KINDS[task.kind];
  const c = COLUMNS.find((x) => x.status === task.status);
  const statusLabel = c?.label ?? '';

  return (
    <>
      <div onClick={onClose} aria-hidden="true" style={OVERLAY_STYLE} />
      <aside style={ASIDE_STYLE}>
        <header
          style={{
            padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            borderBottom: '1px solid var(--ink-20)', flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-60)' }}>{statusLabel}</span>
          <button type="button" onClick={onClose} aria-label="Close" style={{
            width: 28, height: 28, borderRadius: 6, border: 'none', background: 'none',
            color: 'var(--ink-40)', cursor: 'pointer', fontSize: 16,
          }}
          >
            ×
          </button>
        </header>
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          <div style={{ width: 32, height: 4, borderRadius: 2, marginBottom: 12, background: k.color }} />
          <div style={{
            fontSize: 11, fontWeight: 600, color: 'var(--ink-40)',
            textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8,
          }}
          >
            {k.label}
          </div>
          <h3 style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.35, margin: '0 0 16px' }}>
            {task.title}
          </h3>
          <MetaRow label="Created" value={`${relativeAge(task.createdAt)} ago`} />
          <MetaRow label="Source" value={task.source === 'ai' ? 'AI' : 'You'} />
          {task.skillKey && <MetaRow label="Skill" value={task.skillKey} />}
          {task.briefMd && (
            <>
              <div style={{ height: 1, background: 'var(--ink-20)', margin: '16px 0' }} />
              <p style={{ fontSize: 13, lineHeight: 1.65, color: 'var(--ink-60)', margin: 0 }}>
                {task.briefMd}
              </p>
            </>
          )}
          {task.deepLink && (
            <a href={task.deepLink} style={{
              display: 'inline-block', marginTop: 12, fontSize: 12, color: 'var(--ink-60)', textDecoration: 'underline',
            }}
            >
              Open link
            </a>
          )}
        </div>
      </aside>
    </>
  );
}

const MetaRow = memo(function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ fontSize: 11, color: 'var(--ink-40)', marginBottom: 6 }}>
      {label}: <span style={{ color: 'var(--ink-60)' }}>{value}</span>
    </div>
  );
});

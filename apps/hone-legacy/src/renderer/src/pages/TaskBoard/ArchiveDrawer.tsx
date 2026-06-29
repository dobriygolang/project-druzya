import { useEffect, useMemo } from 'react';

import { useT, translate } from '@d9-i18n';

import type { TaskCard } from '../../api/tasks';
import { KINDS, KindIcon } from './lib/kinds';
import { relativeAge, pluralArchive } from './lib/helpers';

interface ArchiveDrawerProps {
  tasks: TaskCard[];
  onClose: () => void;
  onRestore: (taskId: string) => void;
  onDelete: (taskId: string) => void;
}

export function ArchiveDrawer({ tasks, onClose, onRestore, onDelete }: ArchiveDrawerProps): JSX.Element {
  const t = useT();
  // Sort newest-first by updatedAt fallback createdAt. Memoize: archive
  // может содержать сотни task'ов и Date.parse N×log(N) на каждом
  // re-render'е (hover/dropdown открыт) — лишний шум на main thread.
  const sorted = useMemo(() => {
    const copy = [...tasks];
    copy.sort((a, b) => {
      const at = Date.parse(a.updatedAt || a.createdAt);
      const bt = Date.parse(b.updatedAt || b.createdAt);
      return (Number.isFinite(bt) ? bt : 0) - (Number.isFinite(at) ? at : 0);
    });
    return copy;
  }, [tasks]);

  // ESC closes drawer.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.55)',
          zIndex: 500,
          animation: 'fadein var(--motion-dur-medium) var(--motion-ease-standard)',
        }}
      />
      {/* Drawer panel */}
      <aside
        role="dialog"
        aria-label="Archive drawer"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 'min(420px, 95vw)',
          background: 'var(--bg)',
          borderLeft: '1px solid var(--ink-20)',
          zIndex: 501,
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideInRight var(--motion-dur-medium) var(--motion-ease-standard)',
        }}
      >
        <header
          style={{
            padding: '20px 24px 14px',
            borderBottom: '1px solid var(--hair)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div>
            <p
              style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 10,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: 'var(--ink-40)',
                margin: 0,
                marginBottom: 4,
              }}
            >
              {t('hone.taskboard.archive.eyebrow')}
            </p>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink-90)', margin: 0 }}>
              {sorted.length === 0
                ? t('hone.taskboard.archive.empty_title')
                : `${sorted.length} ${pluralArchive(sorted.length)}`}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close archive"
            style={{
              background: 'transparent',
              border: '1px solid var(--ink-20)',
              borderRadius: 6,
              padding: '4px 10px',
              fontSize: 11,
              color: 'var(--ink-60)',
              cursor: 'pointer',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            esc
          </button>
        </header>

        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 24px 24px' }}>
          {sorted.length === 0 ? (
            <p
              style={{
                fontSize: 12.5,
                color: 'var(--ink-40)',
                fontStyle: 'italic',
                lineHeight: 1.6,
                margin: 0,
                marginTop: 24,
              }}
            >
              {t('hone.taskboard.archive.empty_help')}
            </p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {sorted.map((task) => (
                <li
                  key={task.id}
                  style={{
                    padding: '10px 12px',
                    background: 'var(--surface-1)',
                    border: '1px solid var(--hair)',
                    borderRadius: 6,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <KindIcon kind={task.kind} size={13} />
                    <span style={{ fontSize: 13, color: 'var(--ink-90)', flex: 1, lineHeight: 1.4 }}>
                      {task.title}
                    </span>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 6,
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: 10,
                      color: 'var(--ink-40)',
                    }}
                  >
                    <span>
                      {KINDS[task.kind].label} · {relativeAge(task.updatedAt || task.createdAt)}
                    </span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        onClick={() => onRestore(task.id)}
                        style={{
                          background: 'transparent',
                          border: '1px solid var(--ink-20)',
                          borderRadius: 4,
                          padding: '3px 8px',
                          fontSize: 10,
                          color: 'var(--ink-60)',
                          cursor: 'pointer',
                          textTransform: 'uppercase',
                          letterSpacing: '0.08em',
                        }}
                      >
                        restore
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm(translate('hone.taskboard.archive.delete_confirm'))) onDelete(task.id);
                        }}
                        style={{
                          background: 'transparent',
                          border: '1px solid var(--ink-20)',
                          borderRadius: 4,
                          padding: '3px 8px',
                          fontSize: 10,
                          color: 'var(--ink-40)',
                          cursor: 'pointer',
                          textTransform: 'uppercase',
                          letterSpacing: '0.08em',
                        }}
                      >
                        delete
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </>
  );
}

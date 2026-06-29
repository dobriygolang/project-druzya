import { useEffect, useRef, useState } from 'react';

import { useT, translate } from '@d9-i18n';

import type { TaskCard, TaskStatus } from '../../api/tasks';
import { COLUMNS } from './lib/columns';
import { ctxBtnStyle } from './lib/styles';

interface ContextMenuProps {
  x: number;
  y: number;
  task: TaskCard | undefined;
  onMove: (s: TaskStatus) => void;
  onDelete: () => void;
  onClose: () => void;
}

export function ContextMenu({ x, y, task, onMove, onDelete }: ContextMenuProps): JSX.Element | null {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });

  useEffect(() => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    let nx = x, ny = y;
    if (r.right > window.innerWidth) nx = x - r.width;
    if (r.bottom > window.innerHeight) ny = y - r.height;
    setPos({ x: nx, y: ny });
  }, [x, y]);

  if (!task) return null;
  return (
    <div
      ref={ref}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        position: 'fixed', left: pos.x, top: pos.y, zIndex: 300,
        background: 'var(--surface-2)', border: '1px solid var(--ink-20)',
        borderRadius: 8, padding: 4, minWidth: 180,
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)', animation: 'fadein var(--motion-dur-small) var(--motion-ease-standard)',
      }}
    >
      {COLUMNS.filter((c) => c.status !== task.status).map((c) => (
        <button key={c.status} onClick={() => onMove(c.status)} style={ctxBtnStyle}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: c.accent, marginRight: 4 }} />
          {t('hone.taskboard.ctx.move_to', { label: c.label })}
        </button>
      ))}
      <div style={{ height: 1, background: 'var(--ink-20)', margin: '4px 8px' }} />
      <button
        onClick={() => { if (confirm(translate('hone.taskboard.ctx.delete_confirm'))) onDelete(); }}
        style={{ ...ctxBtnStyle, color: 'var(--red)' }}
      >
        🗑 {t('hone.taskboard.ctx.delete')}
      </button>
    </div>
  );
}

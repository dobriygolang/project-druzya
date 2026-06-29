import React, { useEffect, useRef, useState } from 'react';

import type { TaskKind } from '../../api/tasks';
import { KINDS, KindIcon } from './lib/kinds';

interface CreateModalProps {
  onClose: () => void;
  onSubmit: (input: { kind: TaskKind; title: string; briefMd: string; skillKey: string; priority: number }) => Promise<void>;
}

const CREATE_KINDS: TaskKind[] = ['algo', 'sysdesign', 'quiz', 'reflection', 'reading', 'ml', 'custom'];

export function CreateTaskModal({ onClose, onSubmit }: CreateModalProps): JSX.Element {
  const [title, setTitle] = useState('');
  const [briefMd, setBriefMd] = useState('');
  const [kind, setKind] = useState<TaskKind>('custom');
  const [priority, setPriority] = useState(2);
  const [skillKey, setSkillKey] = useState('');
  const [showMore, setShowMore] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [closing, setClosing] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => { titleRef.current?.focus(); }, []);

  // Exit-анимация: ставим closing=true, ждём пока CSS-keyframes доиграют,
  // потом дёргаем onClose у родителя — иначе компонент unmount'ится сразу
  // и анимацию никто не увидит.
  function startClose(): void {
    if (closing) return;
    setClosing(true);
    window.setTimeout(onClose, 180);
  }

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit({ kind, title: title.trim(), briefMd, skillKey, priority });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) startClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 500,
        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '15vh', paddingLeft: 16, paddingRight: 16,
        animation: closing ? 'modalOverlayOut var(--motion-dur-medium) var(--motion-ease-standard) forwards' : 'modalOverlayIn var(--motion-dur-medium) var(--motion-ease-standard)',
      }}
    >
      <form
        onSubmit={submit}
        onKeyDown={(e) => {
          if (e.key === 'Escape') { e.preventDefault(); startClose(); return; }
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { void submit(e); }
        }}
        style={{
          width: 520, maxWidth: '92vw', display: 'flex', flexDirection: 'column', gap: 12,
          background: 'var(--surface)', border: '1px solid var(--ink-20)',
          borderRadius: 12, padding: 18, boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
          animation: closing
            ? 'modalOut var(--motion-dur-medium) var(--motion-ease-accelerate) forwards'
            : 'modalIn var(--motion-dur-medium) var(--motion-ease-emphasized)',
          willChange: 'transform, opacity',
        }}
      >
        <input
          ref={titleRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Task title"
          required
          style={{
            background: 'transparent', border: 'none', outline: 'none',
            color: 'var(--ink)', fontSize: 16, fontWeight: 600,
            fontFamily: 'inherit', padding: 0,
          }}
        />
        <textarea
          value={briefMd}
          onChange={(e) => setBriefMd(e.target.value)}
          placeholder="Notes (optional)"
          rows={2}
          style={{
            background: 'transparent', border: 'none', outline: 'none', resize: 'none',
            color: 'var(--ink-60)', fontSize: 14, lineHeight: 1.5,
            fontFamily: 'inherit', padding: 0,
          }}
        />

        <div role="radiogroup" aria-label="Task kind" style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {CREATE_KINDS.map((k) => {
            const def = KINDS[k];
            const on = kind === k;
            return (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                role="radio"
                aria-checked={on}
                aria-pressed={on}
                className="tb-kind-chip"
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 11px', borderRadius: 6, fontSize: 11, fontWeight: 500,
                  border: `1px solid ${on ? 'var(--ink-20)' : 'rgb(var(--ink-rgb) / 0.045)'}`,
                  background: on ? 'var(--surface-2)' : 'transparent',
                  color: on ? 'var(--ink)' : 'var(--ink-40)',
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                <KindIcon kind={k} size={13} color={on ? def.color : 'currentColor'} />
                {def.label}
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11, color: 'var(--ink-40)' }}>
          <span id="priority-label">Priority</span>
          <div role="radiogroup" aria-labelledby="priority-label" style={{ display: 'flex', gap: 4 }}>
            {[1, 2, 3].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setPriority(n)}
                role="radio"
                aria-checked={n === priority}
                aria-pressed={n === priority}
                aria-label={n === 1 ? 'Low priority' : n === 2 ? 'Medium priority' : 'High priority'}
                title={n === 1 ? 'Low' : n === 2 ? 'Medium' : 'High'}
                style={{
                  width: 6, height: 6, borderRadius: '50%', border: 'none',
                  background: n <= priority ? 'var(--ink)' : 'var(--ink-20)',
                  cursor: 'pointer', padding: 0,
                }}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => setShowMore((v) => !v)}
            aria-expanded={showMore}
            aria-controls="task-skill-input"
            style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--ink-40)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            {showMore ? 'Less' : 'More'}
          </button>
        </div>

        {showMore && (
          <input
            id="task-skill-input"
            value={skillKey}
            onChange={(e) => setSkillKey(e.target.value)}
            placeholder="Skill tag (optional)"
            style={{
              padding: '7px 10px', background: 'var(--surface-2)',
              border: '1px solid var(--ink-20)', borderRadius: 6,
              color: 'var(--ink)', fontFamily: 'inherit', fontSize: 12, outline: 'none',
            }}
          />
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--ink-20)', paddingTop: 12, marginTop: 4 }}>
          <span style={{ fontSize: 10, color: 'var(--ink-40)' }}>
            ⌘↵ to save
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              onClick={startClose}
              className="tb-modal-btn-ghost"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim() || submitting}
              className="tb-modal-btn-primary"
            >
              {submitting ? 'Saving…' : 'Create'}
            </button>
          </div>
        </div>
      </form>
      <style>{`
        @keyframes modalOverlayIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes modalOverlayOut { from { opacity: 1; } to { opacity: 0; } }
        @keyframes modalIn {
          from { opacity: 0; transform: translateY(-12px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes modalOut {
          from { opacity: 1; transform: translateY(0) scale(1); }
          to { opacity: 0; transform: translateY(-8px) scale(0.97); }
        }
        .tb-modal-btn-ghost {
          padding: 7px 14px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 500;
          background: var(--surface-2);
          border: 1px solid var(--ink-20);
          color: var(--ink-60);
          cursor: pointer;
          font-family: inherit;
          transition: background var(--motion-dur-small) var(--motion-ease-standard), color var(--motion-dur-small) var(--motion-ease-standard), border-color var(--motion-dur-small) var(--motion-ease-standard), transform var(--motion-dur-small) var(--motion-ease-standard);
        }
        .tb-modal-btn-ghost:hover {
          background: rgb(var(--ink-rgb) / 0.05);
          color: var(--ink);
          border-color: var(--ink-40);
        }
        .tb-modal-btn-ghost:active { transform: scale(0.97); }
        .tb-modal-btn-primary {
          padding: 7px 18px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          background: var(--ink);
          color: var(--bg);
          border: none;
          cursor: pointer;
          font-family: inherit;
          transition: opacity var(--motion-dur-small) var(--motion-ease-standard), transform var(--motion-dur-small) var(--motion-ease-standard), box-shadow var(--motion-dur-small) var(--motion-ease-standard);
          box-shadow: 0 1px 2px rgba(0,0,0,0.3);
        }
        .tb-modal-btn-primary:hover:not(:disabled) {
          opacity: 0.92;
          box-shadow: 0 4px 14px var(--ink-tint-12);
          transform: translateY(-1px);
        }
        .tb-modal-btn-primary:active:not(:disabled) { transform: scale(0.97) translateY(0); }
        .tb-modal-btn-primary:disabled { opacity: 0.4; cursor: default; }
        .tb-kind-chip { transition: background var(--motion-dur-small) var(--motion-ease-standard), color var(--motion-dur-small) var(--motion-ease-standard), border-color var(--motion-dur-small) var(--motion-ease-standard), transform var(--motion-dur-small) var(--motion-ease-standard); }
        .tb-kind-chip:hover { border-color: var(--ink-20); color: var(--ink); }
        .tb-kind-chip:active { transform: scale(0.97); }
      `}</style>
    </div>
  );
}

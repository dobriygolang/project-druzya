// FloatingToolbar — bubble-toolbar над выделенным текстом (Notion-style).
// Standalone компонент:
//   - Принимает `range` (DOMRect выделения) для позиционирования
//   - Кнопки B/I/S/`/<>/🔗/H1/H2 → callback'и на integrator
//   - Активная кнопка = выделение УЖЕ обёрнуто в соответствующий
//     markdown-syntax (integrator передаёт active-set по своему расчёту)
//   - Link flow: внутреннее состояние; toolbar превращается в url-input,
//     Enter применяет, Esc возвращает кнопки
//
// Рендерится через ReactDOM.createPortal в document.body — иначе
// `overflow:hidden` на родителе обрежет toolbar.

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { useT } from '@d9-i18n';

import { zIndex } from '@shared/lib/z-index';

// ─── Types ────────────────────────────────────────────────────────────────

export type ToolbarOp =
  | 'bold'
  | 'italic'
  | 'strike'
  | 'inlineCode'
  | 'codeBlock'
  | 'link'
  | 'h1'
  | 'h2';

interface FloatingToolbarProps {
  /** Selection rect в viewport coords (window.getSelection() →
   *  getRangeAt(0).getBoundingClientRect()) или null = hide. */
  rect: DOMRect | null;
  /** Set ops уже применённых к выделению (для подсветки active state). */
  activeOps: ReadonlySet<ToolbarOp>;
  /** Inline ops: bold/italic/strike/inlineCode/codeBlock/h1/h2 — integrator
   *  применяет к выделению / линии. */
  onOp: (op: Exclude<ToolbarOp, 'link'>) => void;
  /** Link flow: integrator получает url, обёртывает selection в [text](url). */
  onLink: (url: string) => void;
  /** Закрывается без действия (Esc, click outside). */
  onDismiss: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────

export function FloatingToolbar({
  rect,
  activeOps,
  onOp,
  onLink,
  onDismiss,
}: FloatingToolbarProps) {
  const [linkMode, setLinkMode] = useState(false);
  const [url, setUrl] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset link mode когда rect пропадает (selection снят).
  useEffect(() => {
    if (!rect) {
      setLinkMode(false);
      setUrl('');
    }
  }, [rect]);

  // Esc → dismiss / выйти из link mode без сохранения.
  useEffect(() => {
    if (!rect) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (linkMode) {
          e.preventDefault();
          setLinkMode(false);
          setUrl('');
        } else {
          onDismiss();
        }
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [rect, linkMode, onDismiss]);

  // Click outside → dismiss. Игнорируем mousedown ВНУТРИ toolbar'а
  // (mousedown'ы в редакторе заберут selection и сами уберут rect).
  useEffect(() => {
    if (!rect) return;
    const onMd = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) onDismiss();
    };
    window.addEventListener('mousedown', onMd);
    return () => window.removeEventListener('mousedown', onMd);
  }, [rect, onDismiss]);

  if (!rect) return null;

  // Position: 8px над верхним edge selection'а, центр по горизонтали.
  // Clamp по viewport чтобы не уезжал за края.
  const TOOLBAR_W = linkMode ? 320 : 232;
  const TOOLBAR_H = 34;
  const left = clamp(
    rect.left + rect.width / 2 - TOOLBAR_W / 2,
    8,
    window.innerWidth - TOOLBAR_W - 8,
  );
  const top = clamp(rect.top - TOOLBAR_H - 8, 8, window.innerHeight - TOOLBAR_H - 8);

  return createPortal(
    <div
      ref={containerRef}
      className="fadein"
      // mousedown.preventDefault — не отбираем focus у редактора, иначе
      // selection пропадает до того как мы успеем применить op.
      onMouseDown={(e) => e.preventDefault()}
      style={{
        position: 'fixed',
        left,
        top,
        background: 'rgba(20,20,22,0.96)',
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
        border: '1px solid var(--ink-tint-08)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        borderRadius: 8,
        padding: '3px 4px',
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        zIndex: zIndex.dropdown,
        animationDuration: 'var(--motion-dur-small)',
      }}
    >
      {linkMode ? (
        <LinkInput
          url={url}
          onChange={setUrl}
          onSubmit={() => {
            const u = url.trim();
            if (u) onLink(u);
            setLinkMode(false);
            setUrl('');
          }}
          onCancel={() => {
            setLinkMode(false);
            setUrl('');
          }}
        />
      ) : (
        <>
          <Btn label="B" title="Bold" weight={700} active={activeOps.has('bold')} onClick={() => onOp('bold')} />
          <Btn label="I" title="Italic" italic active={activeOps.has('italic')} onClick={() => onOp('italic')} />
          <Btn label="S" title="Strikethrough" strike active={activeOps.has('strike')} onClick={() => onOp('strike')} />
          <Btn label="`" title="Inline code" mono active={activeOps.has('inlineCode')} onClick={() => onOp('inlineCode')} />
          <Btn label="<>" title="Code block" mono active={activeOps.has('codeBlock')} onClick={() => onOp('codeBlock')} />
          <Sep />
          <Btn label="🔗" title="Link" plain active={activeOps.has('link')} onClick={() => setLinkMode(true)} />
          <Sep />
          <Btn label="H1" title="Heading 1" active={activeOps.has('h1')} onClick={() => onOp('h1')} />
          <Btn label="H2" title="Heading 2" active={activeOps.has('h2')} onClick={() => onOp('h2')} />
        </>
      )}
    </div>,
    document.body,
  );
}

// ─── Buttons ──────────────────────────────────────────────────────────────

function Btn({
  label,
  title,
  active = false,
  weight = 600,
  italic = false,
  strike = false,
  mono = false,
  plain = false,
  onClick,
}: {
  label: string;
  title: string;
  active?: boolean;
  weight?: number;
  italic?: boolean;
  strike?: boolean;
  mono?: boolean;
  plain?: boolean;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      style={{
        width: 28,
        height: 28,
        borderRadius: 5,
        background: active
          ? 'var(--ink-tint-12)'
          : hover
            ? 'var(--ink-tint-08)'
            : 'transparent',
        border: 'none',
        color: active || hover ? 'var(--ink)' : 'var(--ink-60)',
        fontSize: plain ? 13 : 12,
        fontWeight: plain ? 400 : weight,
        fontStyle: italic ? 'italic' : 'normal',
        textDecoration: strike ? 'line-through' : 'none',
        fontFamily: mono ? 'var(--font-mono, monospace)' : 'inherit',
        cursor: 'pointer',
        padding: 0,
        transition: 'background-color var(--motion-dur-small) var(--motion-ease-standard), color var(--motion-dur-small) var(--motion-ease-standard)',
        display: 'inline-grid',
        placeItems: 'center',
      }}
    >
      {label}
    </button>
  );
}

function Sep() {
  return (
    <span
      aria-hidden
      style={{
        width: 1,
        height: 16,
        background: 'var(--ink-tint-08)',
        margin: '0 2px',
      }}
    />
  );
}

// ─── Link input ───────────────────────────────────────────────────────────

function LinkInput({
  url,
  onChange,
  onSubmit,
  onCancel,
}: {
  url: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        width: '100%',
        padding: '0 4px',
      }}
    >
      <input
        autoFocus
        value={url}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            onCancel();
          }
        }}
        placeholder={t('hone.floating_toolbar.link_placeholder')}
        aria-label="Link URL"
        style={{
          flex: 1,
          height: 24,
          padding: '0 8px',
          background: 'transparent',
          border: 'none',
          color: 'var(--ink)',
          fontSize: 13,
          outline: 'none',
        }}
      />
      <button
        type="submit"
        title="Apply link"
        aria-label="Apply link"
        onMouseDown={(e) => e.preventDefault()}
        style={{
          width: 24,
          height: 24,
          borderRadius: 5,
          background: 'var(--ink-tint-08)',
          border: 'none',
          color: 'var(--ink)',
          fontSize: 12,
          cursor: 'pointer',
          display: 'inline-grid',
          placeItems: 'center',
        }}
      >
        ↵
      </button>
    </form>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function clamp(n: number, lo: number, hi: number): number {
  if (lo > hi) return lo;
  return Math.max(lo, Math.min(hi, n));
}

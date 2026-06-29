// SlashMenu — Notion-style block-insert меню. Standalone компонент:
// принимает координаты для absolute-position'а, query-фильтр, и
// callback'и для выбора / закрытия. Сам не следит за caret'ом —
// решает intеgrator (RichMarkdownEditor / MarkdownEditor).
//
// EditorAPI — узкая прослойка для вставки блоков; реализуется по-разному
// для textarea (RichMarkdown) и CM6 (MarkdownEditor), но контракт один.
//
// Стиль: winter palette + только existing CSS-токены. Никаких новых
// цветов, hardcoded анимаций кроме `fadein` (см. globals.css).

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { zIndex } from '../lib/z-index';

// ─── Types ────────────────────────────────────────────────────────────────

export interface EditorAPI {
  /** Insert plain block prefix (e.g. "# ", "- [ ] "). Replaces /query slash-trigger. */
  insertBlock(prefix: string): void;
  /** Insert ```lang\n\n``` fenced code block; cursor lands inside. */
  insertCodeBlock(): void;
  /** Insert <details><summary>Title</summary>\n\nContent\n</details>. */
  insertToggle(): void;
  /** Insert > **Note:** callout block. */
  insertCallout(): void;
}

interface SlashCommand {
  id: string;
  label: string;
  description: string;
  shortcut?: string;
  action: (editor: EditorAPI) => void;
}

// Strict список — добавлять новые команды только сюда.
const SLASH_COMMANDS: SlashCommand[] = [
  {
    id: 'h1',
    label: 'Heading 1',
    description: 'Large section header',
    action: (e) => e.insertBlock('# '),
  },
  {
    id: 'h2',
    label: 'Heading 2',
    description: 'Medium section header',
    action: (e) => e.insertBlock('## '),
  },
  {
    id: 'h3',
    label: 'Heading 3',
    description: 'Small section header',
    action: (e) => e.insertBlock('### '),
  },
  {
    id: 'code',
    label: 'Code block',
    description: 'Syntax-highlighted code',
    shortcut: '```',
    action: (e) => e.insertCodeBlock(),
  },
  {
    id: 'todo',
    label: 'To-do',
    description: 'Trackable checkbox item',
    shortcut: '[]',
    action: (e) => e.insertBlock('- [ ] '),
  },
  {
    id: 'toggle',
    label: 'Toggle',
    description: 'Collapsible content block',
    action: (e) => e.insertToggle(),
  },
  {
    id: 'callout',
    label: 'Callout',
    description: 'Highlighted note or warning',
    action: (e) => e.insertCallout(),
  },
  {
    id: 'divider',
    label: 'Divider',
    description: 'Horizontal rule',
    shortcut: '---',
    action: (e) => e.insertBlock('---\n'),
  },
  {
    id: 'quote',
    label: 'Quote',
    description: 'Blockquote',
    shortcut: '>',
    action: (e) => e.insertBlock('> '),
  },
];

interface SlashMenuProps {
  /** Anchor point in viewport coords — обычно caret position. Меню
   *  позиционируется ниже `(x, y)` с небольшим offset. */
  x: number;
  y: number;
  /** Текст после `/` — фильтр. Пустой = все команды. */
  query: string;
  editor: EditorAPI;
  onClose: () => void;
  /** Вызывается ПЕРЕД action — integrator должен удалить /query текст
   *  из документа. Action затем вставляет block. */
  onBeforeAction?: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────

export function SlashMenu({ x, y, query, editor, onClose, onBeforeAction }: SlashMenuProps) {
  const filtered = useMemo(() => filterCommands(query), [query]);
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  // Adjusted position — после первого render'а измеряем фактический rect и
  // clamp'аем чтобы меню не вылезало за viewport (правый/нижний край).
  // На первом рендере рисуем по anchor (x, y); useLayoutEffect синхронно
  // корректирует ДО paint'а, так что юзер не увидит overflow flash.
  const [pos, setPos] = useState({ x, y });
  useLayoutEffect(() => {
    setPos({ x, y });
  }, [x, y]);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    let nx = pos.x;
    let ny = pos.y;
    if (r.right > window.innerWidth - 8) {
      nx = Math.max(8, window.innerWidth - r.width - 8);
    }
    if (r.bottom > window.innerHeight - 8) {
      // Flip — показываем над anchor'ом вместо под.
      ny = Math.max(8, pos.y - r.height - 24);
    }
    if (nx !== pos.x || ny !== pos.y) {
      setPos({ x: nx, y: ny });
    }
  }, [pos.x, pos.y, filtered.length]);

  // Reset active index когда фильтр меняется (иначе active может уйти
  // за пределы filtered).
  useEffect(() => {
    setActive(0);
  }, [query]);

  // Keyboard nav: ↑↓ Enter Esc. Обрабатываем на window — иначе
  // textarea/CodeMirror перехватят все события первыми. preventDefault
  // важен чтобы стрелки не двигали caret в редакторе.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActive((i) => Math.min(filtered.length - 1, i + 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActive((i) => Math.max(0, i - 1));
        return;
      }
      if (e.key === 'Enter') {
        if (filtered.length === 0) {
          // Empty filter result — let Enter pass через; integrator
          // решит что делать (обычно — вставить newline + закрыть меню).
          onClose();
          return;
        }
        e.preventDefault();
        const cmd = filtered[active];
        if (cmd) {
          onBeforeAction?.();
          cmd.action(editor);
          onClose();
        }
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [filtered, active, editor, onClose, onBeforeAction]);

  // Click-outside closes.
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    // mousedown — чтобы не пропустить click на editor (focus уйдёт раньше mouseup'а).
    window.addEventListener('mousedown', onDocClick);
    return () => window.removeEventListener('mousedown', onDocClick);
  }, [onClose]);

  // Scroll active в видимую область при keyboard nav.
  useEffect(() => {
    const el = ref.current?.querySelector(`[data-slash-idx="${active}"]`);
    if (el && 'scrollIntoView' in el) {
      (el as HTMLElement).scrollIntoView({ block: 'nearest' });
    }
  }, [active]);

  if (filtered.length === 0) return null;

  // Render через portal в document.body — overflow:hidden родителя
  // Notes-сетки нас не обрезает + z-index изолирован.
  return createPortal(
    <div
      ref={ref}
      role="listbox"
      aria-label="Insert block"
      className="fadein"
      onMouseDown={(e) => e.preventDefault()} // не отбираем focus у редактора
      style={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        zIndex: zIndex.dropdown,
        background: 'rgba(20,20,22,0.96)',
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
        border: '1px solid var(--ink-tint-08)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        borderRadius: 10,
        padding: 6,
        minWidth: 320,
        maxHeight: 360,
        overflowY: 'auto',
        animationDuration: 'var(--motion-dur-small)',
      }}
    >
      <div
        className="mono"
        style={{
          fontSize: 9,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--ink-40)',
          padding: '6px 10px 6px',
        }}
      >
        Blocks
      </div>
      {filtered.map((cmd, idx) => (
        <SlashItem
          key={cmd.id}
          cmd={cmd}
          idx={idx}
          active={idx === active}
          onHover={() => setActive(idx)}
          onSelect={() => {
            onBeforeAction?.();
            cmd.action(editor);
            onClose();
          }}
        />
      ))}
    </div>,
    document.body,
  );
}

// ─── Item ─────────────────────────────────────────────────────────────────

function SlashItem({
  cmd,
  idx,
  active,
  onHover,
  onSelect,
}: {
  cmd: SlashCommand;
  idx: number;
  active: boolean;
  onHover: () => void;
  onSelect: () => void;
}) {
  return (
    <button
      data-slash-idx={idx}
      role="option"
      aria-selected={active}
      onMouseEnter={onHover}
      // mousedown — чтобы не потерять focus в editor'е.
      onMouseDown={(e) => {
        e.preventDefault();
        onSelect();
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        padding: '8px 10px 8px 8px',
        marginLeft: 0,
        borderRadius: 6,
        // Active: левый accent-border + lighter background.
        borderLeft: active ? '2px solid rgb(var(--ink-rgb) / 0.3)' : '2px solid transparent',
        background: active ? 'var(--ink-tint-06)' : 'transparent',
        color: active ? 'var(--ink)' : 'var(--ink-90)',
        border: 'none',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'background-color var(--motion-dur-small) var(--motion-ease-standard), color var(--motion-dur-small) var(--motion-ease-standard)',
      }}
    >
      <span style={{ fontSize: 13 }}>{cmd.label}</span>
      <span
        style={{
          fontSize: 12,
          color: 'var(--ink-40)',
          marginLeft: 14,
          flexShrink: 0,
          fontFamily: cmd.shortcut ? 'var(--font-mono, monospace)' : undefined,
        }}
      >
        {cmd.description}
      </span>
    </button>
  );
}

// ─── Filtering ────────────────────────────────────────────────────────────

/** Fuzzy-match: нечувствительный к регистру substring-match по label.
 *  Если query пустой — возвращает all. */
function filterCommands(query: string): SlashCommand[] {
  const q = query.trim().toLowerCase();
  if (!q) return SLASH_COMMANDS;
  return SLASH_COMMANDS.filter((c) => {
    const lab = c.label.toLowerCase();
    if (lab.startsWith(q)) return true;
    if (lab.includes(q)) return true;
    // Fuzzy: разреженный subsequence-match. "h1" должен матчить "Heading 1".
    let qi = 0;
    for (let i = 0; i < lab.length && qi < q.length; i++) {
      if (lab[i] === q[qi]) qi += 1;
    }
    return qi === q.length;
  });
}

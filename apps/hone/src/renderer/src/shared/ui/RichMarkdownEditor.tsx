// RichMarkdownEditor — Obsidian-like overlay over plain <textarea>.
//
// Source-of-truth остаётся markdown-строка. Поверх textarea:
//   1) slash menu (`/`) для вставки блоков
//   2) checkbox / code-fence overlays
//   3) markdown shortcuts: ⌘B/⌘I/⌘K, tab-indent, list continuation, …
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { type IconName } from './primitives/Icon';
import { SlashMenu, type EditorAPI } from './SlashMenu';
import { zIndex } from '@shared/lib/z-index';

interface RichMarkdownEditorProps {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  variant?: 'default' | 'plain';
}

// Todo — одна `- [ ]` или `- [x]` позиция в textarea + её координаты для
// absolute overlay'а. checkboxStart — позиция `[` в исходном value (нужно
// для toggle dispatch'а).
interface Todo {
  checkboxStart: number;
  checked: boolean;
  top: number;
  left: number;
}

// Fence — open ``` line + позиция language-token внутри неё для inline-pill
// overlay'а. contentFrom/contentTo — границы content body для copy.
interface Fence {
  fenceLineFrom: number; // позиция самого ```
  langStart: number; // позиция первого char языка после ```
  langEnd: number;
  language: string;
  contentFrom: number;
  contentTo: number;
  top: number;
  left: number;
}

const RICHMD_CODE_LANGUAGES = [
  'javascript',
  'typescript',
  'python',
  'go',
  'rust',
  'sql',
  'bash',
  'json',
  'yaml',
  'html',
  'css',
  'markdown',
];

// ──────────────────────────────────────────────────────────────────────
// Caret/selection coordinate measurement.
// Стандартный mirror-div trick: создаём скрытый div с теми же стилями что
// и textarea, копируем туда текст до selection, ставим <span> в позицию
// — span.getBoundingClientRect() даёт нам экранные координаты caret-а.
// Берётся MIN(start, end) для top-edge выделения.
// ──────────────────────────────────────────────────────────────────────

const MIRROR_PROPS: (keyof CSSStyleDeclaration)[] = [
  'boxSizing',
  'width',
  'height',
  'overflowX',
  'overflowY',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'fontStyle',
  'fontVariant',
  'fontWeight',
  'fontStretch',
  'fontSize',
  'fontSizeAdjust',
  'lineHeight',
  'fontFamily',
  'textAlign',
  'textTransform',
  'textIndent',
  'textDecoration',
  'letterSpacing',
  'wordSpacing',
  'tabSize',
  'whiteSpace',
  'wordWrap',
  'wordBreak',
];

function getCaretCoords(
  ta: HTMLTextAreaElement,
  position: number,
): { top: number; left: number; height: number } {
  const div = document.createElement('div');
  document.body.appendChild(div);
  const style = div.style;
  const computed = window.getComputedStyle(ta);
  style.position = 'absolute';
  style.visibility = 'hidden';
  style.whiteSpace = 'pre-wrap';
  style.wordWrap = 'break-word';
  style.top = '0';
  style.left = '-9999px';
  for (const prop of MIRROR_PROPS) {
    // @ts-expect-error indexed access on CSSStyleDeclaration
    style[prop] = computed[prop];
  }
  div.textContent = ta.value.substring(0, position);
  const span = document.createElement('span');
  span.textContent = ta.value.substring(position) || '.';
  div.appendChild(span);
  const rect = span.getBoundingClientRect();
  const taRect = ta.getBoundingClientRect();
  const top = rect.top - taRect.top + ta.scrollTop * -1;
  const left = rect.left - taRect.left + ta.scrollLeft * -1;
  const height = parseFloat(computed.lineHeight) || 18;
  document.body.removeChild(div);
  return { top, left, height };
}

// ──────────────────────────────────────────────────────────────────────
// Selection helpers
// ──────────────────────────────────────────────────────────────────────

function wrapSelection(
  ta: HTMLTextAreaElement,
  before: string,
  after: string,
  placeholder = '',
): { value: string; selStart: number; selEnd: number } {
  const start = ta.selectionStart;
  const end = ta.selectionEnd;
  const sel = ta.value.slice(start, end) || placeholder;
  const value = ta.value.slice(0, start) + before + sel + after + ta.value.slice(end);
  return {
    value,
    selStart: start + before.length,
    selEnd: start + before.length + sel.length,
  };
}

function prependLines(
  ta: HTMLTextAreaElement,
  prefix: string | ((i: number) => string),
): { value: string; selStart: number; selEnd: number } {
  const start = ta.selectionStart;
  const end = ta.selectionEnd;
  const lineStart = ta.value.lastIndexOf('\n', start - 1) + 1;
  const lineEnd =
    ta.value.indexOf('\n', end) === -1 ? ta.value.length : ta.value.indexOf('\n', end);
  const block = ta.value.slice(lineStart, lineEnd);
  const lines = block.split('\n');
  const transformed = lines
    .map((l, i) => {
      const px = typeof prefix === 'function' ? prefix(i) : prefix;
      // strip pre-existing same-class prefix to make toolbar idempotent
      const stripped = l.replace(/^(#{1,6}\s|>\s|-\s|\d+\.\s)/, '');
      return px + stripped;
    })
    .join('\n');
  const value = ta.value.slice(0, lineStart) + transformed + ta.value.slice(lineEnd);
  return {
    value,
    selStart: lineStart,
    selEnd: lineStart + transformed.length,
  };
}

// ──────────────────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────────────────

interface ToolbarBtn {
  icon: IconName;
  title: string;
  fn: (ta: HTMLTextAreaElement) => { value: string; selStart: number; selEnd: number } | null;
  group: number;
}

const BUTTONS: ToolbarBtn[] = [
  { group: 0, icon: 'bold', title: 'Bold ⌘B', fn: (ta) => wrapSelection(ta, '**', '**', 'bold') },
  { group: 0, icon: 'italic', title: 'Italic ⌘I', fn: (ta) => wrapSelection(ta, '*', '*', 'italic') },
  { group: 0, icon: 'underline', title: 'Underline', fn: (ta) => wrapSelection(ta, '<u>', '</u>', 'underline') },
  { group: 0, icon: 'strike', title: 'Strikethrough', fn: (ta) => wrapSelection(ta, '~~', '~~', 'strike') },
  { group: 0, icon: 'inline-code', title: 'Inline code', fn: (ta) => wrapSelection(ta, '`', '`', 'code') },
  { group: 1, icon: 'h1', title: 'Heading 1', fn: (ta) => prependLines(ta, '# ') },
  { group: 1, icon: 'h2', title: 'Heading 2', fn: (ta) => prependLines(ta, '## ') },
  { group: 1, icon: 'h3', title: 'Heading 3', fn: (ta) => prependLines(ta, '### ') },
  { group: 2, icon: 'quote', title: 'Quote', fn: (ta) => prependLines(ta, '> ') },
  { group: 2, icon: 'list-ul', title: 'Bullet list', fn: (ta) => prependLines(ta, '- ') },
  { group: 2, icon: 'list-ol', title: 'Numbered list', fn: (ta) => prependLines(ta, (i) => `${i + 1}. `) },
  {
    group: 3,
    icon: 'link',
    title: 'Link ⌘K',
    fn: (ta) => {
      const url = window.prompt('URL', 'https://') || '';
      if (!url) return null;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const sel = ta.value.slice(start, end) || 'link';
      const value = ta.value.slice(0, start) + `[${sel}](${url})` + ta.value.slice(end);
      return {
        value,
        selStart: start + 1,
        selEnd: start + 1 + sel.length,
      };
    },
  },
  {
    group: 3,
    icon: 'code-block',
    title: 'Code block',
    fn: (ta) => {
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const sel = ta.value.slice(start, end);
      const before = start === 0 || ta.value[start - 1] === '\n' ? '' : '\n';
      const block = `${before}\`\`\`\n${sel || ''}\n\`\`\`\n`;
      const value = ta.value.slice(0, start) + block + ta.value.slice(end);
      const inner = start + before.length + 4; // ```\n
      return { value, selStart: inner, selEnd: inner + (sel?.length ?? 0) };
    },
  },
];

const PAIRS: Record<string, string> = {
  '[': ']',
  '(': ')',
  '{': '}',
  '"': '"',
  '`': '`',
};

export function RichMarkdownEditor({
  value,
  onChange,
  placeholder,
  variant = 'default',
}: RichMarkdownEditorProps) {
  const plain = variant === 'plain';
  const taRef = useRef<HTMLTextAreaElement>(null);
  // Slash menu state — координаты в viewport для absolute popup'а, query —
  // текст после `/` (для фильтра), slashStart — позиция `/` в textarea (нужна
  // чтобы при выборе команды стереть `/query` перед вставкой блока).
  const [slash, setSlash] = useState<{ x: number; y: number; query: string; slashStart: number } | null>(null);
  // Checkbox overlays — список positions `- [ ]` / `- [x]` строк.
  // Координаты absolute-relative к textarea, рендерим overlay <div> поверх.
  // Click → модифицируем value (toggle `[ ]` ↔ `[x]`).
  const [todos, setTodos] = useState<Todo[]>([]);
  // Fence overlays — list ``` open-fence lines с пилюлей выбора языка +
  // copy-button. Параллельная checkbox-логика, отдельный list чтобы re-render
  // не зависел от todos.
  const [fences, setFences] = useState<Fence[]>([]);
  // Открытый fence-dropdown: либо null, либо anchor-fence + position.
  const [langDropdown, setLangDropdown] = useState<{ fenceIdx: number } | null>(null);

  const apply = useCallback(
    (btn: ToolbarBtn) => {
      const ta = taRef.current;
      if (!ta) return;
      const out = btn.fn(ta);
      if (!out) return;
      onChange(out.value);
      // Restore selection after React re-renders.
      requestAnimationFrame(() => {
        if (!ta) return;
        ta.focus();
        ta.setSelectionRange(out.selStart, out.selEnd);
      });
    },
    [onChange],
  );

  // ─── Slash menu ───────────────────────────────────────────────────────
  //
  // Trigger: пользователь набирает `/` в начале строки или после whitespace.
  // Меню следует за caret'ом, query — chars после `/` до cursor'а. При
  // удалении `/` (backspace) или whitespace в query — закрываем.

  const updateSlash = useCallback(() => {
    const ta = taRef.current;
    if (!ta) return;
    if (document.activeElement !== ta) {
      setSlash(null);
      return;
    }
    const { selectionStart, selectionEnd, value: v } = ta;
    if (selectionStart !== selectionEnd) {
      setSlash(null);
      return;
    }
    // Идём назад от caret'а в поисках `/` — но останавливаемся на whitespace
    // или начале строки. Если по пути встретили newline — `/` будет после
    // newline → начало строки, валидный trigger.
    let i = selectionStart - 1;
    while (i >= 0) {
      const ch = v.charAt(i);
      if (ch === '/') break;
      if (ch === '\n' || ch === ' ' || ch === '\t') {
        // `/` не нашли до whitespace — не trigger.
        setSlash(null);
        return;
      }
      i -= 1;
    }
    if (i < 0) {
      setSlash(null);
      return;
    }
    // `/` должен быть в начале строки или после whitespace.
    const before = i === 0 ? '\n' : v.charAt(i - 1);
    if (before !== '\n' && before !== ' ' && before !== '\t') {
      setSlash(null);
      return;
    }
    const query = v.slice(i + 1, selectionStart);
    // Multi-line query — закрыть.
    if (query.includes('\n')) {
      setSlash(null);
      return;
    }
    const coords = getCaretCoords(ta, selectionStart);
    // Меню под caret'ом, на ~8px ниже.
    setSlash({
      x: coords.left,
      y: coords.top + 22,
      query,
      slashStart: i,
    });
  }, []);

  // EditorAPI for slash-menu — вставляет блок, удаляя `/query` и вставляя
  // нужный prefix. Вызывается после onBeforeAction (см. integrator
  // contract в SlashMenu.tsx).
  const slashEditorAPI: EditorAPI = useMemo(() => {
    const replaceSlashWith = (insert: string, cursorOffset?: number) => {
      const ta = taRef.current;
      if (!ta || !slash) return;
      const { selectionStart } = ta;
      const before = ta.value.slice(0, slash.slashStart);
      const after = ta.value.slice(selectionStart);
      const newValue = before + insert + after;
      onChange(newValue);
      const newCaret =
        cursorOffset !== undefined ? slash.slashStart + cursorOffset : slash.slashStart + insert.length;
      requestAnimationFrame(() => {
        ta.focus();
        ta.setSelectionRange(newCaret, newCaret);
      });
    };
    return {
      insertBlock: (prefix) => replaceSlashWith(prefix),
      insertCodeBlock: () => {
        const block = '```javascript\n\n```\n';
        // Курсор между fence-строками: after "```javascript\n".
        replaceSlashWith(block, '```javascript\n'.length);
      },
    };
  }, [slash, onChange]);

  // ─── Checkbox overlay ────────────────────────────────────────────────
  //
  // Сканируем value на `- [ ]` / `- [x]` строки, для каждой считаем coords
  // через getCaretCoords. Overlay div поверх textarea (с pointer-events:
  // auto только на самих чекбоксах) отрисовывает кликабельные input'ы.
  const recomputeTodos = useCallback(() => {
    const ta = taRef.current;
    if (!ta) {
      setTodos([]);
      return;
    }
    const v = ta.value;
    const out: Todo[] = [];
    // Match `[ ]` or `[x]` после `-` / `*` + spaces в начале строки.
    const re = /(^|\n)([ \t]*[-*][ \t]+)\[([ xX])\]/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(v)) !== null) {
      const lineStart = m.index + (m[1] === '\n' ? 1 : 0);
      const checkboxStart = lineStart + m[2]!.length;
      const coords = getCaretCoords(ta, checkboxStart);
      out.push({
        checkboxStart,
        checked: m[3] !== ' ',
        top: coords.top,
        left: coords.left,
      });
    }
    setTodos(out);
  }, []);

  // ─── Fence overlay ───────────────────────────────────────────────────
  //
  // Сканируем value на пары ```...``` строк, для каждой open-fence считаем
  // координаты + body range (для copy-button'а).
  const recomputeFences = useCallback(() => {
    const ta = taRef.current;
    if (!ta) {
      setFences([]);
      return;
    }
    const v = ta.value;
    const lines = v.split('\n');
    const out: Fence[] = [];
    let openIdx = -1;
    let openLang = '';
    let openCharPos = 0;
    let openLangStart = 0;
    let openLangEnd = 0;
    let charPos = 0;
    for (let i = 0; i < lines.length; i++) {
      const ln = lines[i] ?? '';
      const m = /^```(\S*)/.exec(ln);
      if (m) {
        if (openIdx === -1) {
          openIdx = i;
          openLang = m[1] ?? '';
          openCharPos = charPos;
          openLangStart = charPos + 3;
          openLangEnd = openLangStart + openLang.length;
        } else {
          // Close fence: сохраняем pair.
          const contentFrom =
            openCharPos + ('```' + openLang).length + 1; // +1 for \n after open-line
          const contentTo = charPos - 1; // \n перед close-line — оставляем за content'ом
          const coords = getCaretCoords(ta, openCharPos);
          out.push({
            fenceLineFrom: openCharPos,
            langStart: openLangStart,
            langEnd: openLangEnd,
            language: openLang,
            contentFrom,
            contentTo: Math.max(contentFrom, contentTo),
            top: coords.top,
            left: coords.left,
          });
          openIdx = -1;
        }
      }
      charPos += ln.length + 1; // +1 for \n
    }
    setFences(out);
  }, []);

  const setFenceLanguage = useCallback(
    (fence: Fence, newLang: string) => {
      const ta = taRef.current;
      if (!ta) return;
      const v = ta.value;
      const newValue = v.slice(0, fence.langStart) + newLang + v.slice(fence.langEnd);
      onChange(newValue);
      requestAnimationFrame(() => {
        recomputeFences();
      });
    },
    [onChange, recomputeFences],
  );

  const copyFenceBody = useCallback((fence: Fence) => {
    const ta = taRef.current;
    if (!ta) return;
    const body = ta.value.slice(fence.contentFrom, fence.contentTo);
    void navigator.clipboard.writeText(body);
  }, []);

  const toggleTodo = useCallback(
    (todo: Todo) => {
      const ta = taRef.current;
      if (!ta) return;
      // Заменяем единственный символ внутри `[X]` (positions
      // checkboxStart+1 .. checkboxStart+2).
      const v = ta.value;
      const charPos = todo.checkboxStart + 1;
      const newChar = todo.checked ? ' ' : 'x';
      const newValue = v.slice(0, charPos) + newChar + v.slice(charPos + 1);
      onChange(newValue);
      // Не двигаем caret — toggle бесшумный.
      requestAnimationFrame(() => {
        recomputeTodos();
      });
    },
    [onChange, recomputeTodos],
  );

  useEffect(() => {
    const onSel = () => updateSlash();
    document.addEventListener('selectionchange', onSel);
    return () => document.removeEventListener('selectionchange', onSel);
  }, [updateSlash]);

  useLayoutEffect(() => {
    updateSlash();
    recomputeTodos();
    recomputeFences();
  }, [value, updateSlash, recomputeTodos, recomputeFences]);

  // ──────────────────────────────────────────────────────────────────
  // Keyboard handler
  // ──────────────────────────────────────────────────────────────────

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const ta = e.currentTarget;
      const mod = e.metaKey || e.ctrlKey;

      if (mod && !e.shiftKey && !e.altKey) {
        const k = e.key.toLowerCase();
        if (k === 'b') {
          e.preventDefault();
          apply(BUTTONS.find((b) => b.icon === 'bold')!);
          return;
        }
        if (k === 'i') {
          e.preventDefault();
          apply(BUTTONS.find((b) => b.icon === 'italic')!);
          return;
        }
        if (k === 'k') {
          e.preventDefault();
          apply(BUTTONS.find((b) => b.icon === 'link')!);
          return;
        }
      }

      // Tab / Shift-Tab — indent / unindent
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const lineStart = ta.value.lastIndexOf('\n', start - 1) + 1;
        if (e.shiftKey) {
          // unindent: remove up to 2 leading spaces on each affected line
          const lineEnd =
            ta.value.indexOf('\n', end) === -1 ? ta.value.length : ta.value.indexOf('\n', end);
          const block = ta.value.slice(lineStart, lineEnd);
          const transformed = block
            .split('\n')
            .map((l) => l.replace(/^ {1,2}/, ''))
            .join('\n');
          const newValue = ta.value.slice(0, lineStart) + transformed + ta.value.slice(lineEnd);
          onChange(newValue);
          requestAnimationFrame(() => {
            ta.focus();
            ta.setSelectionRange(lineStart, lineStart + transformed.length);
          });
        } else {
          if (start !== end) {
            const lineEnd =
              ta.value.indexOf('\n', end) === -1 ? ta.value.length : ta.value.indexOf('\n', end);
            const block = ta.value.slice(lineStart, lineEnd);
            const transformed = block
              .split('\n')
              .map((l) => '  ' + l)
              .join('\n');
            const newValue = ta.value.slice(0, lineStart) + transformed + ta.value.slice(lineEnd);
            onChange(newValue);
            requestAnimationFrame(() => {
              ta.focus();
              ta.setSelectionRange(lineStart, lineStart + transformed.length);
            });
          } else {
            const newValue = ta.value.slice(0, start) + '  ' + ta.value.slice(end);
            onChange(newValue);
            requestAnimationFrame(() => {
              ta.focus();
              ta.setSelectionRange(start + 2, start + 2);
            });
          }
        }
        return;
      }

      // Enter — list continuation + fenced code scaffolding follow-up
      if (e.key === 'Enter' && !e.shiftKey) {
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        if (start === end) {
          const lineStart = ta.value.lastIndexOf('\n', start - 1) + 1;
          const line = ta.value.slice(lineStart, start);

          // Empty list item — exit list
          const emptyBullet = /^(\s*)([-*]|\d+\.)\s+$/.exec(line);
          if (emptyBullet) {
            e.preventDefault();
            const newValue = ta.value.slice(0, lineStart) + ta.value.slice(start);
            onChange(newValue);
            requestAnimationFrame(() => {
              ta.focus();
              ta.setSelectionRange(lineStart, lineStart);
            });
            return;
          }

          // Continue bullet list
          const bulletM = /^(\s*)([-*])\s+/.exec(line);
          if (bulletM) {
            e.preventDefault();
            const insert = `\n${bulletM[1]}${bulletM[2]} `;
            const newValue = ta.value.slice(0, start) + insert + ta.value.slice(end);
            onChange(newValue);
            const pos = start + insert.length;
            requestAnimationFrame(() => {
              ta.focus();
              ta.setSelectionRange(pos, pos);
            });
            return;
          }
          // Continue numbered list
          const numM = /^(\s*)(\d+)\.\s+/.exec(line);
          if (numM) {
            e.preventDefault();
            const next = parseInt(numM[2], 10) + 1;
            const insert = `\n${numM[1]}${next}. `;
            const newValue = ta.value.slice(0, start) + insert + ta.value.slice(end);
            onChange(newValue);
            const pos = start + insert.length;
            requestAnimationFrame(() => {
              ta.focus();
              ta.setSelectionRange(pos, pos);
            });
            return;
          }
          // Continue blockquote
          const quoteM = /^(\s*)>\s+/.exec(line);
          if (quoteM) {
            e.preventDefault();
            const insert = `\n${quoteM[1]}> `;
            const newValue = ta.value.slice(0, start) + insert + ta.value.slice(end);
            onChange(newValue);
            const pos = start + insert.length;
            requestAnimationFrame(() => {
              ta.focus();
              ta.setSelectionRange(pos, pos);
            });
            return;
          }
        }
        return;
      }

      // Auto-pair brackets/quotes/backticks
      if (PAIRS[e.key]) {
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        // Triple-backtick scaffolding: if we're typing third backtick, expand to fenced block
        if (e.key === '`' && start === end && start >= 2 && ta.value.slice(start - 2, start) === '``') {
          e.preventDefault();
          const insert = '`\n\n```';
          const newValue = ta.value.slice(0, start) + insert + ta.value.slice(end);
          onChange(newValue);
          const pos = start + 2; // place cursor at empty line between fences
          requestAnimationFrame(() => {
            ta.focus();
            ta.setSelectionRange(pos, pos);
          });
          return;
        }
        e.preventDefault();
        const sel = ta.value.slice(start, end);
        const close = PAIRS[e.key];
        const insert = e.key + sel + close;
        const newValue = ta.value.slice(0, start) + insert + ta.value.slice(end);
        onChange(newValue);
        requestAnimationFrame(() => {
          ta.focus();
          if (sel) {
            ta.setSelectionRange(start + 1, start + 1 + sel.length);
          } else {
            ta.setSelectionRange(start + 1, start + 1);
          }
        });
        return;
      }
    },
    [apply, onChange],
  );

  // Group buttons for divider rendering
  const groups: ToolbarBtn[][] = [];
  for (const b of BUTTONS) {
    if (!groups[b.group]) groups[b.group] = [];
    groups[b.group]!.push(b);
  }

  return (
    <div style={{ position: 'relative', ...(plain ? { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' } : {}) }}>
      <textarea
        ref={taRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onSelect={updateSlash}
        placeholder={placeholder}
        rows={20}
        className={plain ? 'mono hone-notes-body' : 'mono focus-ring'}
        style={{
          width: '100%',
          color: 'var(--ink-90)',
          background: plain ? 'transparent' : 'var(--ink-tint-02)',
          border: plain ? 'none' : '1px solid var(--ink-tint-04)',
          borderRadius: plain ? 0 : 8,
          padding: plain ? 0 : '14px 16px',
          resize: 'none',
          outline: 'none',
          boxShadow: 'none',
          transition: plain
            ? 'none'
            : 'background-color var(--t-fast), border-color var(--t-fast), box-shadow var(--t-fast)',
        }}
      />
      {/* Checkbox overlays — absolute-positioned поверх `[ ]`/`[x]` glyph'ов
       *  в textarea. pointer-events:none на контейнере чтобы клики через
       *  overlay уходили в textarea (caret положительный flow); pointer-events:
       *  auto на самих input'ах. mousedown.preventDefault — не отбираем focus. */}
      {todos.length > 0 && (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            overflow: 'hidden',
          }}
        >
          {todos.map((t) => (
            <input
              key={t.checkboxStart}
              type="checkbox"
              checked={t.checked}
              onMouseDown={(e) => e.preventDefault()}
              onChange={() => toggleTodo(t)}
              style={{
                position: 'absolute',
                top: t.top + 4,
                left: t.left,
                width: 14,
                height: 14,
                margin: 0,
                borderRadius: 3,
                border: '1.5px solid var(--ink-20)',
                background: 'transparent',
                cursor: 'pointer',
                accentColor: t.checked ? 'var(--ink)' : 'var(--ink-60)',
                pointerEvents: 'auto',
              }}
            />
          ))}
        </div>
      )}
      {/* Fence pill+copy overlays — позиционируем над `` ``` `` строкой,
       *  справа от fence-маркера. pointer-events:auto на самих кнопках. */}
      {fences.length > 0 && (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            overflow: 'hidden',
          }}
        >
          {fences.map((f, idx) => (
            <span
              key={f.fenceLineFrom}
              style={{
                position: 'absolute',
                top: f.top + 2,
                left: f.left + 36,
                display: 'inline-flex',
                gap: 4,
                alignItems: 'center',
                pointerEvents: 'auto',
              }}
            >
              <button
                type="button"
                className="hone-fence-chip"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() =>
                  setLangDropdown(langDropdown?.fenceIdx === idx ? null : { fenceIdx: idx })
                }
              >
                {f.language || 'plain'} ▾
              </button>
              <CopyFenceBtn onClick={() => copyFenceBody(f)} />
              {langDropdown?.fenceIdx === idx && (
                <FenceLangDropdown
                  current={f.language}
                  onPick={(lang) => {
                    setFenceLanguage(f, lang);
                    setLangDropdown(null);
                  }}
                  onClose={() => setLangDropdown(null)}
                />
              )}
            </span>
          ))}
        </div>
      )}
      {slash && (
        <SlashMenu
          x={slash.x}
          y={slash.y}
          query={slash.query}
          editor={slashEditorAPI}
          onClose={() => setSlash(null)}
        />
      )}
    </div>
  );
}

// ─── Fence pill helpers ───────────────────────────────────────────────────

function CopyFenceBtn({ onClick }: { onClick: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="hone-fence-copy"
      title="Copy code"
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => {
        onClick();
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1200);
      }}
    >
      {copied ? '✓' : 'copy'}
    </button>
  );
}

function FenceLangDropdown({
  current,
  onPick,
  onClose,
}: {
  current: string;
  onPick: (lang: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onMd = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('mousedown', onMd);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onMd);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);
  return (
    <div
      ref={ref}
      className="hone-floating-menu"
      onMouseDown={(e) => e.preventDefault()}
      style={{
        position: 'absolute',
        top: 22,
        left: 0,
        zIndex: zIndex.dropdown,
        borderRadius: 10,
        padding: 6,
        minWidth: 160,
        maxHeight: 280,
        overflowY: 'auto',
      }}
    >
      {RICHMD_CODE_LANGUAGES.map((lang) => (
        <button
          key={lang}
          type="button"
          className="hone-menu-item"
          data-current={lang === current ? 'true' : 'false'}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onPick(lang)}
        >
          {lang}
        </button>
      ))}
    </div>
  );
}

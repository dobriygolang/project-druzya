import { EditorSelection } from '@codemirror/state';
import { type EditorView } from '@codemirror/view';

// ─── Editing helpers ──────────────────────────────────────────────────────

export function wrapSelection(before: string, after: string): (view: EditorView) => boolean {
  return (view: EditorView) => {
    const { state } = view;
    const tr = state.update(
      state.changeByRange((range) => {
        const sel = state.sliceDoc(range.from, range.to);
        const replacement = before + sel + after;
        const newSelectionFrom = range.from + before.length;
        const newSelectionTo = newSelectionFrom + sel.length;
        return {
          changes: { from: range.from, to: range.to, insert: replacement },
          range: range.empty
            ? EditorSelection.cursor(range.from + before.length)
            : EditorSelection.range(newSelectionFrom, newSelectionTo),
        };
      }),
    );
    view.dispatch(tr);
    return true;
  };
}

export function insertLink(view: EditorView): boolean {
  const { state } = view;
  const tr = state.update(
    state.changeByRange((range) => {
      const sel = state.sliceDoc(range.from, range.to);
      const text = sel || 'link';
      const insert = `[${text}](url)`;
      const urlStart = range.from + text.length + 3;
      const urlEnd = urlStart + 'url'.length;
      return {
        changes: { from: range.from, to: range.to, insert },
        range: EditorSelection.range(urlStart, urlEnd),
      };
    }),
  );
  view.dispatch(tr);
  return true;
}

/**
 * togglePrefix — добавляет или удаляет префикс (`# `, `> `, `- `) на
 * текущей строке. Если уже есть тот же префикс → snimaет (toggle off);
 * иначе ставит. Multi-line selection — применяет ко всем строкам.
 */
export function togglePrefix(view: EditorView, prefix: string): boolean {
  const { state } = view;
  const tr = state.update(
    state.changeByRange((range) => {
      const startLine = state.doc.lineAt(range.from);
      const endLine = state.doc.lineAt(range.to);
      const changes: Array<{ from: number; to: number; insert: string }> = [];
      for (let n = startLine.number; n <= endLine.number; n++) {
        const line = state.doc.line(n);
        const stripped = stripExistingMarker(line.text);
        if (line.text.startsWith(prefix)) {
          // Уже есть → toggle off (delete prefix).
          changes.push({ from: line.from, to: line.from + prefix.length, insert: '' });
        } else {
          // Нет → заменяем существующий heading-marker (если был) на новый
          // prefix, или добавляем prefix к чистой строке.
          const replaceFrom = line.from;
          const replaceTo = line.from + (line.text.length - stripped.length);
          changes.push({ from: replaceFrom, to: replaceTo, insert: prefix });
        }
      }
      // Caret в конец первой изменённой строки.
      const updatedFirstLine = state.doc.line(startLine.number);
      const newCaret = updatedFirstLine.from + prefix.length;
      return {
        changes,
        range: EditorSelection.cursor(Math.max(newCaret, range.from)),
      };
    }),
  );
  view.dispatch(tr);
  return true;
}

const HEADING_PREFIX_RE = /^#{1,6}\s+/;
const QUOTE_PREFIX_RE = /^>\s+/;
const BULLET_PREFIX_RE = /^[-*]\s+/;
const ORDERED_PREFIX_RE = /^(\d+)\.\s+/;

function stripExistingMarker(line: string): string {
  let out = line;
  out = out.replace(HEADING_PREFIX_RE, '');
  out = out.replace(QUOTE_PREFIX_RE, '');
  out = out.replace(BULLET_PREFIX_RE, '');
  out = out.replace(ORDERED_PREFIX_RE, '');
  return out;
}

/**
 * continueLinePrefix — Enter behaviour as Notion/Obsidian:
 *   - Внутри `- list item` → следующая строка `- ` (cursor после)
 *   - Внутри `1. item` → `2. ` (auto-increment)
 *   - Внутри `> quote` → `> ` continuation
 *   - Если prefix пустой (e.g. `- ` без content) → удаляем его (выход
 *     из structure), обычный Enter
 *   - Иначе обычный Enter
 */
// Todo prefix REGEX — должен идти ПЕРЕД BULLET_PREFIX_RE т.к. `- [ ]`
// match'ит и BULLET_PREFIX_RE как `- ` (rest = `[ ] task`). Continuation
// должен быть `- [ ] ` (новый пустой todo), не `- ` (downgrade в bullet).
const TODO_PREFIX_RE = /^(\s*)- \[[ xX]\]\s+/;

export function continueLinePrefix(view: EditorView): boolean {
  const { state } = view;
  const range = state.selection.main;
  if (!range.empty) return false; // multi-char selection — let default behaviour handle
  const line = state.doc.lineAt(range.head);
  // Курсор должен быть в конце строки (Notion behaviour). Если нет —
  // обычный Enter.
  if (range.head !== line.to) return false;

  // Detect prefix. Important: TODO check ПЕРЕД bullet (см. TODO_PREFIX_RE).
  let prefix = '';
  let isOrdered = false;
  let isTodo = false;
  let orderedNum = 0;

  const todoMatch = TODO_PREFIX_RE.exec(line.text);
  const orderedMatch = !todoMatch ? ORDERED_PREFIX_RE.exec(line.text) : null;

  if (todoMatch) {
    isTodo = true;
    // Сохраняем indentation (если есть) + новый пустой `- [ ] ` checkbox.
    prefix = (todoMatch[1] ?? '') + '- [ ] ';
  } else if (orderedMatch && orderedMatch[1]) {
    isOrdered = true;
    orderedNum = parseInt(orderedMatch[1], 10) + 1;
    prefix = `${orderedNum}. `;
  } else if (BULLET_PREFIX_RE.test(line.text)) {
    prefix = line.text.startsWith('* ') ? '* ' : '- ';
  } else if (QUOTE_PREFIX_RE.test(line.text)) {
    prefix = '> ';
  } else {
    return false; // не наша зона ответственности — let defaultKeymap'у обработать
  }

  // Если строка содержит ТОЛЬКО prefix (empty content) — выходим из
  // structure: удаляем prefix + переводим строку. Это natural way
  // закончить список без копания в раскладке.
  let stripped: string;
  if (isTodo) {
    stripped = line.text.replace(TODO_PREFIX_RE, '');
  } else if (isOrdered) {
    stripped = line.text.replace(ORDERED_PREFIX_RE, '');
  } else {
    stripped = line.text.replace(BULLET_PREFIX_RE, '').replace(QUOTE_PREFIX_RE, '');
  }
  if (stripped.trim() === '') {
    view.dispatch({
      changes: { from: line.from, to: line.to, insert: '' },
      selection: EditorSelection.cursor(line.from),
    });
    return true;
  }

  // Иначе — Enter + новый prefix.
  view.dispatch({
    changes: { from: range.head, to: range.head, insert: '\n' + prefix },
    selection: EditorSelection.cursor(range.head + 1 + prefix.length),
  });
  return true;
}

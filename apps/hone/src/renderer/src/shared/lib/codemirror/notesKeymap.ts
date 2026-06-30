import { indentLess, indentMore } from '@codemirror/commands';
import type { EditorState, Transaction } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';

function wrapSelection(state: EditorState, before: string, after: string, placeholder = ''): Transaction | null {
  const range = state.selection.main;
  const sel = state.sliceDoc(range.from, range.to) || placeholder;
  return state.update({
    changes: {
      from: range.from,
      to: range.to,
      insert: before + sel + after,
    },
    selection: { anchor: range.from + before.length, head: range.from + before.length + sel.length },
  });
}

function prependLines(state: EditorState, prefix: string | ((i: number) => string)): Transaction | null {
  const range = state.selection.main;
  const lineStart = state.doc.lineAt(range.from).from;
  const lineEnd = state.doc.lineAt(range.to).to;
  const block = state.sliceDoc(lineStart, lineEnd);
  const lines = block.split('\n');
  const transformed = lines
    .map((l, i) => {
      const px = typeof prefix === 'function' ? prefix(i) : prefix;
      const stripped = l.replace(/^(#{1,6}\s|>\s|-\s|\d+\.\s)/, '');
      return px + stripped;
    })
    .join('\n');
  return state.update({
    changes: { from: lineStart, to: lineEnd, insert: transformed },
    selection: { anchor: lineStart, head: lineStart + transformed.length },
  });
}

function continueListOnEnter(view: EditorView): boolean {
  const { state } = view;
  const { from, to } = state.selection.main;
  if (from !== to) return false;

  const line = state.doc.lineAt(from);
  const before = state.sliceDoc(line.from, from);

  const emptyBullet = /^(\s*)([-*+]|\d+\.)\s+$/.exec(before);
  if (emptyBullet) {
    view.dispatch({
      changes: { from: line.from, to: from, insert: '' },
      selection: { anchor: line.from },
    });
    return true;
  }

  const bullet = /^(\s*)([-*+])\s+/.exec(before);
  if (bullet) {
    const insert = `\n${bullet[1]}${bullet[2]} `;
    view.dispatch({
      changes: { from, to, insert },
      selection: { anchor: from + insert.length },
    });
    return true;
  }

  const numbered = /^(\s*)(\d+)\.\s+/.exec(before);
  if (numbered) {
    const next = parseInt(numbered[2], 10) + 1;
    const insert = `\n${numbered[1]}${next}. `;
    view.dispatch({
      changes: { from, to, insert },
      selection: { anchor: from + insert.length },
    });
    return true;
  }

  const quote = /^(\s*)>\s+/.exec(before);
  if (quote) {
    const insert = `\n${quote[1]}> `;
    view.dispatch({
      changes: { from, to, insert },
      selection: { anchor: from + insert.length },
    });
    return true;
  }

  return false;
}

export const notesKeymap = [
  {
    key: 'Mod-b',
    run(view: EditorView) {
      const tr = wrapSelection(view.state, '**', '**', 'bold');
      if (!tr) return false;
      view.dispatch(tr);
      return true;
    },
  },
  {
    key: 'Mod-i',
    run(view: EditorView) {
      const tr = wrapSelection(view.state, '*', '*', 'italic');
      if (!tr) return false;
      view.dispatch(tr);
      return true;
    },
  },
  {
    key: 'Mod-k',
    run(view: EditorView) {
      const url = window.prompt('URL', 'https://') || '';
      if (!url) return true;
      const range = view.state.selection.main;
      const sel = view.state.sliceDoc(range.from, range.to) || 'link';
      view.dispatch({
        changes: {
          from: range.from,
          to: range.to,
          insert: `[${sel}](${url})`,
        },
        selection: { anchor: range.from + 1, head: range.from + 1 + sel.length },
      });
      return true;
    },
  },
  {
    key: 'Tab',
    run(view: EditorView) {
      indentMore(view);
      return true;
    },
  },
  {
    key: 'Shift-Tab',
    run(view: EditorView) {
      indentLess(view);
      return true;
    },
  },
  {
    key: 'Enter',
    run(view: EditorView) {
      return continueListOnEnter(view);
    },
  },
];

export { wrapSelection, prependLines };

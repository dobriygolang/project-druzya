import { type EditorView } from '@codemirror/view';

import { type ToolbarOp } from '../../FloatingToolbar';

// ─── Slash / bubble recompute helpers ─────────────────────────────────────
//
// Извлечены из MarkdownEditor чтобы не загромождать тело компонента и
// чтобы можно было дёргать из CM6 updateListener'а который не имеет
// прямого доступа к state hook'ам React'а — мы передаём setters внутрь.

export function recomputeSlash(
  view: EditorView,
  setSlash: (s: { x: number; y: number; query: string; slashStart: number } | null) => void,
): void {
  const sel = view.state.selection.main;
  if (!sel.empty) {
    setSlash(null);
    return;
  }
  const cursor = sel.head;
  const doc = view.state.doc.toString();
  // Идём назад от cursor'а в поисках `/`. Останавливаемся на whitespace
  // или newline (тогда не trigger).
  let i = cursor - 1;
  while (i >= 0) {
    const ch = doc.charAt(i);
    if (ch === '/') break;
    if (ch === '\n' || ch === ' ' || ch === '\t') {
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
  const before = i === 0 ? '\n' : doc.charAt(i - 1);
  if (before !== '\n' && before !== ' ' && before !== '\t') {
    setSlash(null);
    return;
  }
  const query = doc.slice(i + 1, cursor);
  if (query.includes('\n')) {
    setSlash(null);
    return;
  }
  // Координаты caret'а в viewport через CM6 API.
  const coords = view.coordsAtPos(cursor);
  if (!coords) {
    setSlash(null);
    return;
  }
  setSlash({
    x: coords.left,
    y: coords.bottom + 4, // под cursor'ом, 4px gap
    query,
    slashStart: i,
  });
}

export function recomputeBubble(
  view: EditorView,
  setRect: (r: DOMRect | null) => void,
  setActiveOps: (s: Set<ToolbarOp>) => void,
): void {
  const sel = view.state.selection.main;
  if (sel.empty) {
    setRect(null);
    return;
  }
  // Не показываем bubble внутри code-fence строк — там pure мarkdown
  // syntax не имеет смысла.
  const fromLine = view.state.doc.lineAt(sel.from);
  if (fromLine.text.trimStart().startsWith('```')) {
    setRect(null);
    return;
  }
  const fromCoords = view.coordsAtPos(sel.from);
  const toCoords = view.coordsAtPos(sel.to);
  if (!fromCoords || !toCoords) {
    setRect(null);
    return;
  }
  const left = Math.min(fromCoords.left, toCoords.left);
  const right = Math.max(fromCoords.right, toCoords.right);
  const top = Math.min(fromCoords.top, toCoords.top);
  const bottom = Math.max(fromCoords.bottom, toCoords.bottom);
  setRect(new DOMRect(left, top, right - left, bottom - top));

  // Active ops: проверяем wrap'ы вокруг selection через doc.sliceDoc.
  const out = new Set<ToolbarOp>();
  const before2 = view.state.sliceDoc(Math.max(0, sel.from - 2), sel.from);
  const after2 = view.state.sliceDoc(sel.to, Math.min(view.state.doc.length, sel.to + 2));
  const before1 = view.state.sliceDoc(Math.max(0, sel.from - 1), sel.from);
  const after1 = view.state.sliceDoc(sel.to, Math.min(view.state.doc.length, sel.to + 1));
  if (before2 === '**' && after2 === '**') out.add('bold');
  if ((before1 === '_' && after1 === '_') || (before1 === '*' && after1 === '*' && before2 !== '**')) {
    out.add('italic');
  }
  if (before2 === '~~' && after2 === '~~') out.add('strike');
  const before3 = view.state.sliceDoc(Math.max(0, sel.from - 3), sel.from);
  if (before1 === '`' && after1 === '`' && before3 !== '```') out.add('inlineCode');
  // Heading prefix — line.text начинается с # или ##.
  if (fromLine.text.startsWith('# ')) out.add('h1');
  else if (fromLine.text.startsWith('## ')) out.add('h2');
  setActiveOps(out);
}

// ─── Bubble toolbar op runner ─────────────────────────────────────────────

export function runCMBubbleOp(
  view: EditorView,
  op: Exclude<ToolbarOp, 'link'>,
  active: ReadonlySet<ToolbarOp>,
): void {
  const { from, to } = view.state.selection.main;
  const sel = view.state.sliceDoc(from, to);

  const wrap = (marker: string, isActive: boolean) => {
    if (isActive) {
      // Unwrap: remove marker before `from` and after `to`.
      const before = view.state.sliceDoc(Math.max(0, from - marker.length), from);
      const after = view.state.sliceDoc(to, to + marker.length);
      if (before === marker && after === marker) {
        view.dispatch({
          changes: [
            { from: from - marker.length, to: from, insert: '' },
            { from: to, to: to + marker.length, insert: '' },
          ],
          selection: { anchor: from - marker.length, head: to - marker.length },
        });
      }
      return;
    }
    view.dispatch({
      changes: { from, to, insert: marker + sel + marker },
      selection: {
        anchor: from + marker.length,
        head: to + marker.length,
      },
    });
  };

  if (op === 'bold') return wrap('**', active.has('bold'));
  if (op === 'italic') return wrap('*', active.has('italic'));
  if (op === 'strike') return wrap('~~', active.has('strike'));
  if (op === 'inlineCode') return wrap('`', active.has('inlineCode'));
  if (op === 'codeBlock') {
    view.dispatch({
      changes: { from, to, insert: '```\n' + sel + '\n```' },
      selection: { anchor: from + 4, head: from + 4 + sel.length },
    });
    return;
  }
  if (op === 'h1' || op === 'h2') {
    const prefix = op === 'h1' ? '# ' : '## ';
    const line = view.state.doc.lineAt(from);
    if (line.text.startsWith(prefix)) {
      // Toggle off: strip prefix.
      view.dispatch({
        changes: { from: line.from, to: line.from + prefix.length, insert: '' },
      });
    } else {
      // Strip any other heading prefix first (one update'ом — без двойной транзакции).
      const stripMatch = /^#{1,6}\s+/.exec(line.text);
      const stripLen = stripMatch ? stripMatch[0].length : 0;
      view.dispatch({
        changes: { from: line.from, to: line.from + stripLen, insert: prefix },
      });
    }
  }
}

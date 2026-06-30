import { RangeSetBuilder, type EditorState } from '@codemirror/state';
import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  WidgetType,
  type ViewUpdate,
} from '@codemirror/view';

function rangeTouches(from: number, to: number, start: number, end: number): boolean {
  return from < end && to > start;
}

/** Raw markdown syntax is visible only while the caret or a selection is on this line. */
function showLineSyntax(state: EditorState, line: { from: number; to: number }): boolean {
  for (const range of state.selection.ranges) {
    if (range.head >= line.from && range.head <= line.to) return true;
    if (range.from !== range.to && rangeTouches(range.from, range.to, line.from, line.to)) {
      return true;
    }
  }
  return false;
}

class HiddenWidget extends WidgetType {
  toDOM(): HTMLElement {
    return document.createElement('span');
  }
}

class BulletWidget extends WidgetType {
  toDOM(): HTMLElement {
    const el = document.createElement('span');
    el.className = 'hone-md-bullet';
    el.setAttribute('aria-hidden', 'true');
    el.textContent = '•';
    return el;
  }
}

class CheckboxWidget extends WidgetType {
  constructor(
    readonly checked: boolean,
    readonly pos: number,
  ) {
    super();
  }

  eq(other: CheckboxWidget): boolean {
    return other.checked === this.checked && other.pos === this.pos;
  }

  toDOM(view: EditorView): HTMLElement {
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = this.checked;
    input.className = 'hone-md-checkbox';
    input.addEventListener('mousedown', (e) => e.preventDefault());
    input.addEventListener('change', () => {
      const ch = this.checked ? ' ' : 'x';
      view.dispatch({
        changes: { from: this.pos + 1, to: this.pos + 2, insert: ch },
      });
    });
    return input;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

class HrWidget extends WidgetType {
  toDOM(): HTMLElement {
    const hr = document.createElement('hr');
    hr.className = 'hone-md-hr';
    return hr;
  }

  ignoreEvent(): boolean {
    return true;
  }
}

const hidden = new HiddenWidget();

function buildLivePreview(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const doc = view.state.doc;

  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i);
    const text = line.text;
    const showSyntax = showLineSyntax(view.state, line);

    // Heading — style the whole line (including `#`); hide markers only off-line.
    const heading = /^(#{1,6})(\s*)(.*)$/.exec(text);
    if (heading) {
      const level = heading[1].length;
      const prefixEnd = line.from + heading[1].length + heading[2].length;
      if (showSyntax) {
        builder.add(line.from, line.to, Decoration.mark({ class: `hone-md-h${level}` }));
      } else {
        if (prefixEnd > line.from) {
          builder.add(line.from, prefixEnd, Decoration.replace({ widget: hidden }));
        }
        if (prefixEnd < line.to) {
          builder.add(prefixEnd, line.to, Decoration.mark({ class: `hone-md-h${level}` }));
        }
      }
      continue;
    }

    // Horizontal rule — rendered preview unless line is active.
    if (/^(\*{3,}|-{3,}|_{3,})\s*$/.test(text)) {
      if (!showSyntax) {
        builder.add(line.from, line.to, Decoration.replace({ widget: new HrWidget(), block: true }));
      }
      continue;
    }

    // Todo checkbox
    const todo = /^(\s*)([-*+]\s+)\[([ xX])\](\s*)(.*)$/.exec(text);
    if (todo) {
      const indentLen = todo[1].length;
      const listMarkerLen = todo[2].length;
      const checkboxFrom = line.from + indentLen + listMarkerLen;
      const markerFrom = line.from + indentLen;
      const markerTo = checkboxFrom;

      builder.add(line.from, line.to, Decoration.line({ class: 'hone-md-list-item' }));
      if (!showSyntax) {
        builder.add(markerFrom, markerTo, Decoration.replace({ widget: hidden }));
        builder.add(
          checkboxFrom,
          checkboxFrom + 3,
          Decoration.replace({
            widget: new CheckboxWidget(todo[3] !== ' ', checkboxFrom),
            inclusive: true,
          }),
        );
      }
      continue;
    }

    // Bullet list (not todo)
    const bullet = /^(\s*)([-*+])(\s+)(.*)$/.exec(text);
    if (bullet) {
      const markerFrom = line.from + bullet[1].length;
      const markerTo = markerFrom + bullet[2].length + bullet[3].length;
      builder.add(line.from, line.to, Decoration.line({ class: 'hone-md-list-item' }));
      if (!showSyntax) {
        builder.add(markerFrom, markerTo, Decoration.replace({ widget: new BulletWidget(), side: 1 }));
      }
      continue;
    }

    // Numbered list
    const ordered = /^(\s*)(\d+\.)(\s+)(.*)$/.exec(text);
    if (ordered) {
      const numFrom = line.from + ordered[1].length;
      const numTo = numFrom + ordered[2].length;
      builder.add(line.from, line.to, Decoration.line({ class: 'hone-md-list-item' }));
      builder.add(numFrom, numTo, Decoration.mark({ class: 'hone-md-list-num' }));
      continue;
    }

    // Blockquote — hide `> ` when line inactive; always style line.
    const quote = /^(\s*)(>\s+)(.*)$/.exec(text);
    if (quote) {
      const markerFrom = line.from + quote[1].length;
      const markerTo = markerFrom + quote[2].length;
      builder.add(line.from, line.to, Decoration.line({ class: 'hone-md-quote' }));
      if (!showSyntax) {
        builder.add(markerFrom, markerTo, Decoration.replace({ widget: hidden }));
      }
    }
  }

  return builder.finish();
}

export const livePreviewPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildLivePreview(view);
    }

    update(update: ViewUpdate): void {
      if (update.docChanged || update.selectionSet || update.viewportChanged) {
        this.decorations = buildLivePreview(update.view);
      }
    }
  },
  { decorations: (v) => v.decorations },
);

export const notesEditorTheme = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: '1rem',
    lineHeight: '1.7',
  },
  '&.cm-focused': {
    outline: 'none',
  },
  '.cm-scroller': {
    overflow: 'auto',
    fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif",
  },
  '.cm-content': {
    padding: 0,
    caretColor: 'var(--ink)',
  },
  '.cm-line': {
    padding: '1px 0',
  },
  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: 'var(--ink)',
  },
  '.cm-selectionBackground, ::selection': {
    backgroundColor: 'rgb(var(--ink-rgb) / 0.14) !important',
  },
  '&.cm-focused .cm-selectionBackground': {
    backgroundColor: 'rgb(var(--ink-rgb) / 0.18) !important',
  },
  /* Live preview wins over CM markdown token colors */
  '.cm-header, .tok-heading, .tok-heading1, .tok-heading2, .tok-heading3, .tok-strong, .tok-emphasis': {
    color: 'inherit',
    fontSize: 'inherit',
    fontWeight: 'inherit',
    fontStyle: 'inherit',
  },
});

import {
  EditorView,
  ViewPlugin,
  Decoration,
  WidgetType,
  type DecorationSet,
  type ViewUpdate,
} from '@codemirror/view';

// ─── Checkbox decoration ──────────────────────────────────────────────────
//
// Pattern: `- [ ]` (unchecked) или `- [x]` (checked) в начале строки —
// рендерим `[ ]` / `[x]` как replace-decoration с Widget'ом-input'ом.
// Click → dispatch transaction которая меняет `[ ]` ↔ `[x]`. Cursor
// position не меняем — Widget вне normal selection flow'а.
//
// Атомичность: важно `atomic: true` чтобы caret прыгал мимо widget'а
// при стрелочках (как в Notion — пустой checkbox не "доступен" caret'у),
// иначе курсор застревает в hidden range.

class CheckboxWidget extends WidgetType {
  constructor(
    readonly checked: boolean,
    readonly checkboxFrom: number,
    readonly checkboxTo: number,
  ) {
    super();
  }
  eq(other: CheckboxWidget): boolean {
    return other.checked === this.checked && other.checkboxFrom === this.checkboxFrom;
  }
  toDOM(view: EditorView): HTMLElement {
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = this.checked;
    input.style.cssText = [
      'width:14px',
      'height:14px',
      'margin:0 4px 0 0',
      'border-radius:3px',
      'border:1.5px solid var(--ink-20)',
      'background:transparent',
      'cursor:pointer',
      'vertical-align:-2px',
      `accent-color:${this.checked ? 'var(--ink)' : 'var(--ink-60)'}`,
    ].join(';');
    input.addEventListener('mousedown', (e) => {
      // Не отбираем focus у редактора + не позволяем CM6 трактовать
      // mousedown как селекшн-старт.
      e.preventDefault();
      e.stopPropagation();
    });
    input.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      // Toggle `[ ]` ↔ `[x]` через CM6 transaction. Меняем единственный
      // символ внутри скобок (положения checkboxFrom+1 .. checkboxFrom+2).
      view.dispatch({
        changes: {
          from: this.checkboxFrom + 1,
          to: this.checkboxFrom + 2,
          insert: this.checked ? ' ' : 'x',
        },
      });
    });
    return input;
  }
  ignoreEvent(): boolean {
    // Возвращаем false — позволяем mousedown/click пробросить наш handler.
    return false;
  }
}

const TODO_RE = /^(\s*[-*]\s+)\[([ xX])\]/;

export function checkboxDecorations() {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = this.build(view);
      }
      update(u: ViewUpdate) {
        if (u.docChanged || u.viewportChanged) {
          this.decorations = this.build(u.view);
        }
      }
      build(view: EditorView): DecorationSet {
        const builder: Array<{ from: number; to: number; deco: Decoration }> = [];
        for (const { from, to } of view.visibleRanges) {
          let pos = from;
          while (pos <= to) {
            const line = view.state.doc.lineAt(pos);
            const m = TODO_RE.exec(line.text);
            if (m) {
              const checkboxOffset = m[1]!.length; // прыгаем за `- ` префикс
              const checkboxFrom = line.from + checkboxOffset;
              const checkboxTo = checkboxFrom + 3; // `[x]` или `[ ]`
              const checked = m[2] !== ' ';
              builder.push({
                from: checkboxFrom,
                to: checkboxTo,
                deco: Decoration.replace({
                  widget: new CheckboxWidget(checked, checkboxFrom, checkboxTo),
                  // Atomic — caret skip'ает widget при keyboard nav.
                  inclusive: false,
                }),
              });
            }
            if (line.to >= to) break;
            pos = line.to + 1;
          }
        }
        builder.sort((a, b) => a.from - b.from);
        return Decoration.none.update({
          add: builder.map((b) => b.deco.range(b.from, b.to)),
        });
      }
    },
    {
      decorations: (v) => v.decorations,
    },
  );
}

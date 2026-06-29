import {
  EditorView,
  ViewPlugin,
  Decoration,
  WidgetType,
  type DecorationSet,
  type ViewUpdate,
} from '@codemirror/view';

// ─── Toggle (<details>) decoration ────────────────────────────────────────
//
// Pattern:
//   <details>
//   <summary>Title</summary>
//
//   Content
//
//   </details>
//
// Добавляем:
//   - <summary> строка получает widget triangle ▶/▼ слева — клик toggle'ит
//     collapsed state. State хранится per-document в Set<openLine> на
//     module-уровне (in-memory, не персистится — Notion ведёт себя так же).
//   - В collapsed state — все строки между <summary> и </details>
//     получают line-decoration с display:none. Курсор пользователя
//     может туда попасть стрелочками (atomic не используем — иначе
//     юзер потеряет доступ к редактированию content'а).
//
// Парсинг прост: regex по строкам, парим open/close. Не nested
// (Notion толком тоже не поддерживает nested toggle UI).

// Глобальный set открытых toggle'ов, индексируется по от <details> line position.
// Не персистится — при reopen note все toggle'ы закрытые. Это ок для MVP.
const collapsedToggles = new Set<number>();

class ToggleSummaryWidget extends WidgetType {
  constructor(
    readonly detailsLineFrom: number,
    readonly collapsed: boolean,
  ) {
    super();
  }
  eq(other: ToggleSummaryWidget): boolean {
    return other.detailsLineFrom === this.detailsLineFrom && other.collapsed === this.collapsed;
  }
  toDOM(view: EditorView): HTMLElement {
    const tri = document.createElement('button');
    tri.type = 'button';
    tri.textContent = this.collapsed ? '▶' : '▼';
    tri.style.cssText = [
      'display:inline-block',
      'width:18px',
      'margin:0 6px 0 0',
      'border:none',
      'background:transparent',
      'color:var(--ink-40)',
      'font-size:10px',
      'cursor:pointer',
      'transition:color var(--motion-dur-small) var(--motion-ease-standard)',
    ].join(';');
    tri.addEventListener('mouseenter', () => {
      tri.style.color = 'var(--ink-60)';
    });
    tri.addEventListener('mouseleave', () => {
      tri.style.color = 'var(--ink-40)';
    });
    tri.addEventListener('mousedown', (e) => e.preventDefault());
    tri.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (collapsedToggles.has(this.detailsLineFrom)) {
        collapsedToggles.delete(this.detailsLineFrom);
      } else {
        collapsedToggles.add(this.detailsLineFrom);
      }
      // Force CM6 re-render: empty no-op transaction triggers ViewPlugin.update.
      view.dispatch({});
    });
    return tri;
  }
  ignoreEvent(): boolean {
    return false;
  }
}

const collapsedLineDeco = Decoration.line({
  attributes: { style: 'display:none' },
});

export function toggleDecorations() {
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
        const builder: Array<{ from: number; to?: number; deco: Decoration }> = [];
        const doc = view.state.doc;
        let openDetails: number | null = null; // line number `<details>` строки
        for (let i = 1; i <= doc.lines; i++) {
          const line = doc.line(i);
          const trimmed = line.text.trim();
          if (trimmed === '<details>') {
            openDetails = i;
          } else if (trimmed === '</details>' && openDetails !== null) {
            // Найдём <summary> между openDetails и i.
            let summaryLine: number | null = null;
            for (let j = openDetails + 1; j < i; j++) {
              const inner = doc.line(j).text.trim();
              if (inner.startsWith('<summary>')) {
                summaryLine = j;
                break;
              }
            }
            if (summaryLine !== null) {
              const summary = doc.line(summaryLine);
              const detailsLineFrom = doc.line(openDetails).from;
              const collapsed = collapsedToggles.has(detailsLineFrom);
              // Triangle widget — at start of <summary> line.
              builder.push({
                from: summary.from,
                deco: Decoration.widget({
                  widget: new ToggleSummaryWidget(detailsLineFrom, collapsed),
                  side: -1,
                }),
              });
              if (collapsed) {
                // Hide все строки между <summary>+1 и </details>-1.
                for (let j = summaryLine + 1; j < i; j++) {
                  const cl = doc.line(j);
                  builder.push({ from: cl.from, deco: collapsedLineDeco });
                }
              }
            }
            openDetails = null;
          }
        }
        builder.sort((a, b) => a.from - b.from);
        return Decoration.none.update({
          add: builder.map((b) => b.deco.range(b.from)),
        });
      }
    },
    {
      decorations: (v) => v.decorations,
    },
  );
}

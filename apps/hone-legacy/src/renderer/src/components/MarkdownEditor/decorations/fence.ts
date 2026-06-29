import { Text } from '@codemirror/state';
import {
  EditorView,
  ViewPlugin,
  Decoration,
  WidgetType,
  type DecorationSet,
  type ViewUpdate,
} from '@codemirror/view';

// ─── Code block language picker ───────────────────────────────────────────
//
// Pattern: ` ```lang ` или ` ``` ` в начале строки = open fence. Рендерим
// поверх line'а pill с текущим языком + copy-button. Клик на pill →
// dropdown со списком LANGUAGES; выбор → replace `lang` в fence-строке.
// Click на copy → копируем тело блока (между fence-строками) в clipboard.
//
// Pill — Decoration.widget (НЕ replace — оставляем fence-text видимым;
// pill висит float'ом справа от fence-маркера). Сам widget просто overlay'ит
// абсолютную пилюлю над fence строкой.

const CODE_LANGUAGES = [
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
] as const;

class FenceWidget extends WidgetType {
  constructor(
    readonly language: string,
    readonly fenceLineFrom: number,
    readonly fenceLineTo: number,
    readonly contentFrom: number,
    readonly contentTo: number,
  ) {
    super();
  }
  eq(other: FenceWidget): boolean {
    return (
      other.language === this.language &&
      other.fenceLineFrom === this.fenceLineFrom &&
      other.contentFrom === this.contentFrom &&
      other.contentTo === this.contentTo
    );
  }
  toDOM(view: EditorView): HTMLElement {
    const wrap = document.createElement('span');
    wrap.style.cssText = [
      'display:inline-flex',
      'gap:4px',
      'align-items:center',
      'margin-left:8px',
      'vertical-align:middle',
    ].join(';');

    // Lang pill — кликабельная, открывает dropdown.
    const pill = document.createElement('button');
    pill.type = 'button';
    pill.textContent = this.language || 'plain';
    pill.style.cssText = [
      'font-size:10px',
      'font-family:var(--font-mono, monospace)',
      'letter-spacing:0.08em',
      'color:var(--ink-40)',
      'background:var(--hair)',
      'border:1px solid var(--hair)',
      'border-radius:4px',
      'padding:2px 6px',
      'cursor:pointer',
      'transition:color var(--motion-dur-small) var(--motion-ease-standard)',
    ].join(';');
    pill.addEventListener('mouseenter', () => {
      pill.style.color = 'var(--ink-60)';
    });
    pill.addEventListener('mouseleave', () => {
      pill.style.color = 'var(--ink-40)';
    });
    pill.addEventListener('mousedown', (e) => e.preventDefault());
    pill.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openLangDropdown(view, pill, this.language, this.fenceLineFrom);
    });

    // Copy button — справа от pill.
    const copy = document.createElement('button');
    copy.type = 'button';
    copy.title = 'Copy code';
    copy.textContent = 'copy';
    copy.style.cssText = [
      'font-size:10px',
      'font-family:var(--font-mono, monospace)',
      'letter-spacing:0.08em',
      'color:var(--ink-40)',
      'background:transparent',
      'border:none',
      'padding:2px 4px',
      'cursor:pointer',
      'opacity:0.6',
      'transition:opacity var(--motion-dur-small) var(--motion-ease-standard)',
    ].join(';');
    copy.addEventListener('mouseenter', () => {
      copy.style.opacity = '1';
      copy.style.color = 'var(--ink-60)';
    });
    copy.addEventListener('mouseleave', () => {
      copy.style.opacity = '0.6';
      copy.style.color = 'var(--ink-40)';
    });
    copy.addEventListener('mousedown', (e) => e.preventDefault());
    copy.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const body = view.state.sliceDoc(this.contentFrom, this.contentTo);
      void navigator.clipboard.writeText(body).then(() => {
        copy.textContent = '✓';
        window.setTimeout(() => {
          copy.textContent = 'copy';
        }, 1200);
      });
    });

    wrap.appendChild(pill);
    wrap.appendChild(copy);
    return wrap;
  }
  ignoreEvent(): boolean {
    return false;
  }
}

function openLangDropdown(
  view: EditorView,
  anchor: HTMLElement,
  current: string,
  fenceLineFrom: number,
): void {
  // Закрываем существующий dropdown если есть.
  document.querySelectorAll('[data-cm-lang-dropdown]').forEach((n) => n.remove());

  const rect = anchor.getBoundingClientRect();
  const menu = document.createElement('div');
  menu.setAttribute('data-cm-lang-dropdown', '1');
  menu.style.cssText = [
    'position:fixed',
    `left:${rect.left}px`,
    `top:${rect.bottom + 4}px`,
    'z-index:60',
    'background:rgba(20,20,22,0.96)',
    'backdrop-filter:blur(18px)',
    '-webkit-backdrop-filter:blur(18px)',
    'border:1px solid var(--hair)',
    'box-shadow:0 8px 32px rgba(0,0,0,0.5)',
    'border-radius:10px',
    'padding:6px',
    'min-width:160px',
    'max-height:280px',
    'overflow-y:auto',
  ].join(';');

  for (const lang of CODE_LANGUAGES) {
    const item = document.createElement('button');
    item.type = 'button';
    item.textContent = lang;
    item.style.cssText = [
      'display:block',
      'width:100%',
      'padding:6px 10px',
      'border:none',
      'border-radius:6px',
      'background:transparent',
      `color:${lang === current ? 'var(--ink)' : 'var(--ink-90)'}`,
      'font-size:12px',
      'font-family:var(--font-mono, monospace)',
      'letter-spacing:0.08em',
      'text-align:left',
      'cursor:pointer',
      'transition:background-color var(--motion-dur-small) var(--motion-ease-standard)',
    ].join(';');
    item.addEventListener('mouseenter', () => {
      item.style.background = 'var(--hair)';
      item.style.color = 'var(--ink)';
    });
    item.addEventListener('mouseleave', () => {
      item.style.background = 'transparent';
      item.style.color = lang === current ? 'var(--ink)' : 'var(--ink-90)';
    });
    item.addEventListener('mousedown', (e) => e.preventDefault());
    item.addEventListener('click', () => {
      // Заменяем lang в fence-строке: position fenceLineFrom + 3 (после ```)
      // .. до следующего \n или конца строки.
      const line = view.state.doc.lineAt(fenceLineFrom);
      const fenceText = line.text;
      const fenceM = /^```(\S*)/.exec(fenceText);
      if (fenceM) {
        const langStart = line.from + 3;
        const langEnd = line.from + 3 + fenceM[1]!.length;
        view.dispatch({
          changes: { from: langStart, to: langEnd, insert: lang },
        });
      }
      menu.remove();
    });
    menu.appendChild(item);
  }

  document.body.appendChild(menu);

  // Click-outside / Esc → close.
  const onDoc = (e: MouseEvent) => {
    if (!menu.contains(e.target as Node)) {
      menu.remove();
      window.removeEventListener('mousedown', onDoc);
      window.removeEventListener('keydown', onKey);
    }
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      menu.remove();
      window.removeEventListener('mousedown', onDoc);
      window.removeEventListener('keydown', onKey);
    }
  };
  window.setTimeout(() => {
    window.addEventListener('mousedown', onDoc);
    window.addEventListener('keydown', onKey);
  }, 0);
}

const FENCE_RE = /^```(\S*)/;

export function fenceDecorations() {
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
        const builder: Array<{ from: number; deco: Decoration }> = [];
        // Сканируем все строки (не только viewportRanges) чтобы корректно
        // парить open/close fence pairs, в которых одна из строк может быть
        // вне viewport'а. Доc небольшой (note size cap'ится бэкендом),
        // фуллскан дешёвый.
        const doc = view.state.doc;
        let openLine: { from: number; lang: string } | null = null;
        for (let i = 1; i <= doc.lines; i++) {
          const line = doc.line(i);
          const m = FENCE_RE.exec(line.text);
          if (m) {
            if (!openLine) {
              openLine = { from: line.from, lang: m[1] || '' };
              const closeLine = findCloseFence(doc, i);
              if (closeLine !== null) {
                const close = doc.line(closeLine);
                const contentFrom = line.to + 1;
                const contentTo = close.from > contentFrom ? close.from - 1 : contentFrom;
                builder.push({
                  from: line.to,
                  deco: Decoration.widget({
                    widget: new FenceWidget(
                      openLine.lang,
                      line.from,
                      line.to,
                      contentFrom,
                      contentTo,
                    ),
                    side: 1,
                  }),
                });
              }
              openLine = null;
            } else {
              openLine = null;
            }
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

function findCloseFence(
  doc: Text,
  openLineNumber: number,
): number | null {
  for (let i = openLineNumber + 1; i <= doc.lines; i++) {
    const line = doc.line(i);
    if (line.text.startsWith('```')) return i;
  }
  return null;
}

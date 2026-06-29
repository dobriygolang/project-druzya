// MarkdownSourceEditor — Obsidian source-mode editor на CodeMirror 6.
//
// Зачем не Milkdown/Crepe: Crepe съедает markdown-маркеры (`# `, `**…**`)
// сразу при вводе и работает в WYSIWYG-режиме. Это конфликтует с тем как
// юзер хочет редактировать heading levels (добавить `#` к существующему
// `# Title` чтобы получить `## Title`). В CodeMirror 6 текст хранится как
// есть — все маркеры видимы, плюс decoration'ы стилизуют heading-строки
// крупным шрифтом, как в Obsidian Live Preview.
//
// Yjs collab: y-codemirror.next bind'ит Y.Text к CM6 state. Тот же sync-
// engine что в EditorRooms (api/yjs.ts) перерелится автоматически —
// XmlFragment был для ProseMirror, для CM6 используем Y.Text 'body'.
//
// localOnly: пропускаем Y.Doc, держим content в state и onChange обратно.
import { useEffect, useRef } from 'react';
import { EditorState, RangeSetBuilder, type Extension } from '@codemirror/state';
import { EditorView, keymap, highlightActiveLine, Decoration, ViewPlugin, type DecorationSet, type ViewUpdate } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { syntaxHighlighting, HighlightStyle, syntaxTree } from '@codemirror/language';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages as lezerLanguages } from '@codemirror/language-data';
import { tags as t } from '@lezer/highlight';
import { yCollab } from 'y-codemirror.next';
import * as Y from 'yjs';

import { attachNoteYjs, type NoteYjsHandle } from '../api/yjs';

interface MarkdownSourceEditorProps {
  noteId: string;
  seedBodyMD: string;
  placeholder?: string;
  onTextChange?: (text: string) => void;
  /** Local-only mode — пропускает Yjs collab + backend sync. Для free-tier
   * notes которые живут только в IndexedDB. */
  localOnly?: boolean;
}

// Hone-tuned highlight: heading'и крупные, маркеры приглушены, КОД получает
// богатую палитру (Tokyo-Night-ish) для подсветки внутри fenced блоков.
const honeMarkdownHighlight = HighlightStyle.define([
  // ── Headings ─────────────────────────────────────────────────────────────
  { tag: t.heading1, fontSize: '28px', fontWeight: '700', lineHeight: '1.25', color: 'var(--ink)' },
  { tag: t.heading2, fontSize: '22px', fontWeight: '700', lineHeight: '1.3', color: 'var(--ink)' },
  { tag: t.heading3, fontSize: '18px', fontWeight: '600', lineHeight: '1.35', color: 'var(--ink)' },
  { tag: t.heading4, fontSize: '16px', fontWeight: '600', color: 'var(--ink)' },
  { tag: t.heading5, fontSize: '14.5px', fontWeight: '600', color: 'var(--ink)' },
  { tag: t.heading6, fontSize: '14px', fontWeight: '600', color: 'var(--ink-90)' },
  // ── Inline emphasis ─────────────────────────────────────────────────────
  { tag: t.strong, fontWeight: '700' },
  { tag: t.emphasis, fontStyle: 'italic' },
  { tag: t.strikethrough, textDecoration: 'line-through' },
  // ── Markdown markers (# / ``` / > / **) ─────────────────────────────────
  // Ink-ramp opacity per b/w rule — markers are de-emphasized via opacity,
  // not hue. CodeMirror requires literal color strings (no CSS-var support
  // in HighlightStyle), so we keep raw rgba() but tune them to the same
  // ramp as globals.css var(--ink-NN). See feedback_color_rule.md.
  { tag: t.processingInstruction, color: 'rgb(var(--ink-rgb) / 0.32)' },
  { tag: t.contentSeparator, color: 'rgb(var(--ink-rgb) / 0.32)' },
  // ── Links ───────────────────────────────────────────────────────────────
  // No hue — underline is the affordance, full ink keeps it legible. URLs
  // in source-mode drop to ink-40 (matches --ink-40 ramp).
  { tag: t.link, color: 'rgb(var(--ink-rgb) / 0.9)', textDecoration: 'underline' },
  { tag: t.url, color: 'rgb(var(--ink-rgb) / 0.4)' },
  // ── Inline + fenced monospace по умолчанию ──────────────────────────────
  {
    tag: t.monospace,
    fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
    fontSize: '13.5px',
    color: 'rgb(var(--ink-rgb) / 0.9)',
  },
  { tag: t.quote, color: 'rgb(var(--ink-rgb) / 0.6)', fontStyle: 'italic' },
  { tag: t.list, color: 'var(--ink)' },

  // ── Code syntax (для языков внутри fenced ```) ──────────────────────────
  // Tokyo-Night-вдохновлённая палитра — pink keywords, cyan funcs,
  // green strings, orange numbers. Хорошо читается на чёрном фоне Hone.
  { tag: t.keyword, color: '#ff7b9c' },
  { tag: t.controlKeyword, color: '#ff7b9c' },
  { tag: t.operatorKeyword, color: '#ff7b9c' },
  { tag: t.modifier, color: '#ff7b9c' },
  { tag: [t.string, t.special(t.string)], color: '#9ece6a' },
  { tag: t.character, color: '#9ece6a' },
  { tag: [t.number, t.bool, t.null], color: '#ff9e64' },
  { tag: [t.atom, t.special(t.variableName)], color: '#ff9e64' },
  { tag: t.comment, color: '#5c6370', fontStyle: 'italic' },
  { tag: t.lineComment, color: '#5c6370', fontStyle: 'italic' },
  { tag: t.blockComment, color: '#5c6370', fontStyle: 'italic' },
  { tag: t.docComment, color: '#5c6370', fontStyle: 'italic' },
  { tag: t.function(t.variableName), color: '#7aa2f7' },
  { tag: t.function(t.propertyName), color: '#7aa2f7' },
  { tag: t.variableName, color: '#c0caf5' },
  { tag: t.propertyName, color: '#7dcfff' },
  { tag: t.typeName, color: '#bb9af7' },
  { tag: t.className, color: '#bb9af7' },
  { tag: t.namespace, color: '#bb9af7' },
  { tag: t.operator, color: '#89ddff' },
  { tag: t.punctuation, color: '#89ddff' },
  { tag: t.bracket, color: '#89ddff' },
  { tag: t.regexp, color: '#9ece6a' },
  { tag: t.escape, color: '#ff9e64' },
  { tag: t.tagName, color: '#f7768e' },
  { tag: t.attributeName, color: '#7dcfff' },
  { tag: t.attributeValue, color: '#9ece6a' },
  { tag: t.invalid, color: '#f7768e', textDecoration: 'underline wavy' },
]);

// fencedCodeBlockBackdrop — ViewPlugin что обходит syntaxTree, находит
// FencedCode nodes и вешает line-class «cm-fenced-code» на каждую строку
// внутри. CSS даёт серый фон + rounded углы первой/последней строке.
//
// Использует RangeSetBuilder — добавляем декорации в порядке возрастания
// from/to. Visible-range ограничение чтобы не сканировать весь документ
// на больших заметках.
const fencedCodeBackdrop: Extension = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = this.build(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = this.build(update.view);
      }
    }

    private build(view: EditorView): DecorationSet {
      const builder = new RangeSetBuilder<Decoration>();
      // Маркируем линии в FencedCode разными декорациями: первая (с ```lang)
      // получает «top» класс, средние — «mid», последняя — «bottom». Это
      // даёт CSS возможность скруглить только внешние углы.
      for (const { from, to } of view.visibleRanges) {
        syntaxTree(view.state).iterate({
          from,
          to,
          enter: (node) => {
            if (node.name !== 'FencedCode') return;
            const startLine = view.state.doc.lineAt(node.from);
            const endLine = view.state.doc.lineAt(node.to);
            for (let n = startLine.number; n <= endLine.number; n++) {
              const line = view.state.doc.line(n);
              let cls = 'cm-fenced-mid';
              if (n === startLine.number) cls = 'cm-fenced-top';
              else if (n === endLine.number) cls = 'cm-fenced-bottom';
              builder.add(line.from, line.from, Decoration.line({ class: cls }));
            }
          },
        });
      }
      return builder.finish();
    }
  },
  {
    decorations: (v) => v.decorations,
  },
);

// liveMarkupReveal — Obsidian Live Preview style. Прячет markdown-маркеры
// (#, **, ``, ~~, >, -/+/*-list, code-fence ```) на всех строках кроме
// той где сейчас курсор. Эффект: при чтении заметка выглядит как готовый
// рендер, при редактировании активная строка показывает raw-маркеры.
//
// Реализация:
//   - Идём по syntaxTree visible-ranges.
//   - На каждый «mark» node (HeaderMark, EmphasisMark, etc) проверяем
//     попадает ли его линия в активную (cursor-line) или вложен ли он в
//     fenced-block чьи строки содержат курсор.
//   - Если non-active — вешаем декорацию `cm-hidden-markup` (CSS:
//     display:none).
//
// Tradeoff: декорации перерасчитываются на selectionSet (чтобы курсор
// движение мгновенно показывало/скрывало маркеры). На больших заметках
// это noticable; ограничиваем visibleRanges'ом — невидимые строки не
// сканируются.
// MARK_NODE_NAMES — какие markdown-маркеры скрываем на нон-курсорной
// строке. Намеренно НЕ включаем:
//   - ListMark (`*`, `-`, `+`) — без виджета-замены строка теряет
//     визуальный bullet, юзер видит просто отступ. Live Preview в
//     Obsidian заменяет литерал на нативный «•», но это требует
//     отдельного widget-flow; пока safer оставлять `*` видимым.
//   - LinkMark / URL — `[text](https://…)` коллапсировал бы в пустоту,
//     ломая ссылки. Ссылочный sugar — задача отдельного link-decoration
//     плагина, не текущего scope.
const MARK_NODE_NAMES = new Set([
  'HeaderMark',
  'EmphasisMark',
  'StrikethroughMark',
  'CodeMark',
  'QuoteMark',
]);

const liveMarkupReveal: Extension = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = this.build(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged || update.selectionSet) {
        this.decorations = this.build(update.view);
      }
    }

    private build(view: EditorView): DecorationSet {
      const builder = new RangeSetBuilder<Decoration>();
      const sel = view.state.selection.main;
      const cursorLine = view.state.doc.lineAt(sel.head).number;
      // Дополнительно — если курсор внутри FencedCode, то ВЕСЬ блок
      // считается «активным» (fence-маркеры не прячем). Запоминаем
      // диапазоны fenced-блоков, содержащих курсор.
      const activeFencedRanges: Array<[number, number]> = [];
      for (const { from, to } of view.visibleRanges) {
        syntaxTree(view.state).iterate({
          from,
          to,
          enter: (node) => {
            if (node.name !== 'FencedCode') return;
            if (sel.head >= node.from && sel.head <= node.to) {
              activeFencedRanges.push([node.from, node.to]);
            }
          },
        });
      }
      const headInActiveFence = (pos: number) =>
        activeFencedRanges.some(([a, b]) => pos >= a && pos <= b);

      for (const { from, to } of view.visibleRanges) {
        syntaxTree(view.state).iterate({
          from,
          to,
          enter: (node) => {
            if (!MARK_NODE_NAMES.has(node.name)) return;
            const lineNum = view.state.doc.lineAt(node.from).number;
            // Не прячем маркеры на курсорной строке.
            if (lineNum === cursorLine) return;
            // Не прячем fence-маркеры если курсор внутри блока.
            if (headInActiveFence(node.from)) return;
            builder.add(node.from, node.to, Decoration.mark({ class: 'cm-hidden-markup' }));
          },
        });
      }
      return builder.finish();
    }
  },
  {
    decorations: (v) => v.decorations,
  },
);

const baseTheme = EditorView.theme(
  {
    '&': {
      height: '100%',
      minHeight: '280px',
      fontSize: '15px',
      color: 'var(--ink)',
      backgroundColor: 'transparent',
    },
    '.cm-scroller': {
      fontFamily: "'Inter', -apple-system, system-ui, sans-serif",
      lineHeight: '1.7',
      letterSpacing: '-0.005em',
      caretColor: 'var(--ink)',
    },
    '.cm-content': {
      padding: '4px 0',
      caretColor: 'var(--ink)',
    },
    '.cm-line': {
      padding: '2px 0',
    },
    '.cm-cursor': {
      borderLeftColor: 'var(--ink)',
      borderLeftWidth: '2px',
    },
    '.cm-selectionBackground, ::selection': {
      backgroundColor: 'rgb(var(--ink-rgb) / 0.18) !important',
    },
    '.cm-activeLine': {
      backgroundColor: 'transparent',
    },
    '&.cm-focused .cm-selectionBackground, &.cm-focused ::selection': {
      backgroundColor: 'rgb(var(--ink-rgb) / 0.22) !important',
    },
    // ── Fenced code block backdrop ─────────────────────────────────────────
    // Каждая строка внутри ```...``` получает класс через ViewPlugin'е
    // выше. Все три класса (top/mid/bottom) — общий бекграунд + mono font;
    // top/bottom добавляют скруглённые внешние углы.
    '.cm-fenced-top, .cm-fenced-mid, .cm-fenced-bottom': {
      backgroundColor: 'rgb(var(--ink-rgb) / 0.04)',
      paddingLeft: '14px',
      paddingRight: '14px',
      fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
    },
    '.cm-fenced-top': {
      paddingTop: '8px',
      borderTopLeftRadius: '8px',
      borderTopRightRadius: '8px',
      marginTop: '6px',
    },
    '.cm-fenced-bottom': {
      paddingBottom: '8px',
      borderBottomLeftRadius: '8px',
      borderBottomRightRadius: '8px',
      marginBottom: '6px',
    },
    // Inline code пилюлей.
    '.cm-line .ͼ1, .cm-line .tok-monospace': {
      // Inline code mb работает кашно — таргетим напрямую <span>'ы которые
      // получают monospace-tag styling. Не переопределяем bg для строк
      // внутри fenced (они уже c bg от .cm-fenced-*).
    },
    // ── Live Preview reveal ────────────────────────────────────────────────
    // liveMarkupReveal ViewPlugin вешает этот класс на ranges с markdown-
    // маркерами (#, **, etc) которые НЕ на курсорной строке. Скрываем
    // полностью — Obsidian-style. Курсор обратно на строку → класс
    // снимается (плагин пересобирает декорации на selectionSet).
    '.cm-hidden-markup': {
      display: 'none',
    },
    // Visual-only nudge для list rows: bold-ить ListMark (`*`/`-`/`+`)
    // чтобы он явнее читался как bullet даже в source-mode. Хороший
    // компромисс между «строгий source» и «нативный bullet glyph» —
    // курсор-движение не дёргает layout.
    '.tok-list': {
      color: 'var(--ink-60)',
      fontWeight: 500,
    },
  },
  { dark: true },
);

export function MarkdownSourceEditor({
  noteId,
  seedBodyMD,
  placeholder = 'Write your thoughts…',
  onTextChange,
  localOnly = false,
}: MarkdownSourceEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const handleRef = useRef<NoteYjsHandle | null>(null);
  const onTextChangeRef = useRef(onTextChange);
  onTextChangeRef.current = onTextChange;

  useEffect(() => {
    if (!containerRef.current) return;
    let destroyed = false;

    const sharedExtensions = (collab: Extension | null): Extension[] => [
      baseTheme,
      history(),
      highlightActiveLine(),
      markdown({ base: markdownLanguage, codeLanguages: lezerLanguages, addKeymap: true }),
      syntaxHighlighting(honeMarkdownHighlight),
      fencedCodeBackdrop,
      liveMarkupReveal,
      keymap.of([...defaultKeymap, ...historyKeymap]),
      ...(collab ? [collab] : []),
      EditorView.lineWrapping,
      EditorView.updateListener.of((upd) => {
        if (!upd.docChanged || destroyed) return;
        onTextChangeRef.current?.(upd.state.doc.toString());
      }),
    ];

    if (localOnly) {
      const state = EditorState.create({
        doc: seedBodyMD,
        extensions: sharedExtensions(null),
      });
      const view = new EditorView({ state, parent: containerRef.current });
      viewRef.current = view;
      const disposePlaceholder = togglePlaceholder(containerRef.current, view, placeholder);
      return () => {
        destroyed = true;
        disposePlaceholder();
        view.destroy();
        viewRef.current = null;
      };
    }

    // Yjs path: bind Y.Text 'body' к CM6.
    //
    // КРИТИЧНО: НЕ seed'им ytext синхронно здесь. Раньше тут стоял
    // `if (ytext.length === 0) ytext.insert(0, seedBodyMD)` — который
    // фишился ДО того как attach()'s initial fetchUpdates отрезолвилась
    // и applyUpdate'нула серверные updates. Результат: текст вставлялся
    // дважды, сервер мерджил CRDT'шно → "hello" + "hello" = "hellohello"
    // при следующем открытии заметки. Seeding теперь живёт ровно в одном
    // месте — в `attach()`'s opts.seed callback (см. api/yjs.ts), который
    // запускается ТОЛЬКО когда server-log пуст. yCollab сам подтянет
    // remote updates когда они приедут — CM6 обновится без перерисовки.
    const handle = attachNoteYjs(noteId, seedBodyMD);
    handleRef.current = handle;
    const ytext = handle.ydoc.getText('body');

    const state = EditorState.create({
      doc: ytext.toString(),
      extensions: sharedExtensions(yCollab(ytext, null)),
    });
    const view = new EditorView({ state, parent: containerRef.current });
    viewRef.current = view;
    const disposePlaceholder = togglePlaceholder(containerRef.current, view, placeholder);

    return () => {
      destroyed = true;
      disposePlaceholder();
      view.destroy();
      viewRef.current = null;
      handle.close();
      handleRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId, localOnly]);

  return (
    <div
      ref={containerRef}
      className="hone-md-source-mount"
      style={{ minHeight: 280 }}
    />
  );
}

function togglePlaceholder(root: HTMLElement, view: EditorView, placeholder: string): () => void {
  const setEmpty = () => {
    const empty = view.state.doc.length === 0;
    root.dataset.empty = String(empty);
    root.dataset.placeholder = placeholder;
  };
  setEmpty();
  const id = window.setInterval(setEmpty, 250);
  const onBlur = () => window.clearInterval(id);
  view.dom.addEventListener('input', setEmpty);
  view.dom.addEventListener('blur', onBlur);
  return () => {
    window.clearInterval(id);
    view.dom.removeEventListener('input', setEmpty);
    view.dom.removeEventListener('blur', onBlur);
  };
}

export { Y };

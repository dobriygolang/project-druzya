// MarkdownEditor — CodeMirror 6 + yCollab + Notion-style live preview.
//
// Stack:
//   - CodeMirror 6 (state/view/commands)
//   - @codemirror/lang-markdown — Lezer-based parser, syntaxTree
//   - @codemirror/language — HighlightStyle, syntaxHighlighting
//   - y-codemirror.next — bidirectional Y.Text ↔ CM6 binding
//   - api/yjs.ts attachNoteYjs — REST sync engine для Y.Doc'а
//
// Что даёт Notion-like ощущение:
//   1. Heading sizes — H1 36px, H2 26px, H3 21px (через HighlightStyle).
//      Markers `# `, `## ` остаются видимыми, но цвет ink-40 — не
//      бросается в глаза (Notion полностью прячет, но это complex
//      decoration-toggling по cursor-line; делаем faded для MVP).
//   2. Bold / italic / inline code — token-based styling, markers
//      faded. **bold** рисуется bold-weight'ом, маркеры `**` приглушённые.
//   3. Blockquote — left-border + indent через ViewPlugin line-decoration.
//   4. Fenced code block — bg + monospace через line-decoration.
//   5. Bullet/ordered list — hanging indent чтобы wrap'нутые строки
//      выравнивались под текстом, не под маркером.
//   6. Auto-continuation — Enter в `- `, `1. `, `> ` continues prefix.
//      Empty prefix → cursor exits structure (Notion behaviour).
//   7. Toolbar — H1/H2/Bold/Italic/Code/Quote/List/Link, всегда видим
//     над editor pane; click меняет document через keymap helpers.
//
// CRDT (через yCollab): два девайса печатают одновременно — оба
// keystroke сохраняются character-level через Yjs.
import { useEffect, useMemo, useRef, useState } from 'react';

import { EditorState, type EditorStateConfig } from '@codemirror/state';
import {
  EditorView,
  keymap,
  placeholder as placeholderExt,
  drawSelection,
} from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { syntaxHighlighting } from '@codemirror/language';
import { markdown } from '@codemirror/lang-markdown';
import { yCollab } from 'y-codemirror.next';

import { attachNoteYjs, type NoteYjsHandle } from '../../api/yjs';
import { SlashMenu, type EditorAPI } from '../SlashMenu';
import { FloatingToolbar, type ToolbarOp } from '../FloatingToolbar';

import { notionLikeHighlight } from './lib/highlight';
import { notionTheme } from './lib/theme';
import {
  wrapSelection,
  insertLink,
  togglePrefix,
  continueLinePrefix,
} from './lib/editing-commands';
import {
  recomputeSlash,
  recomputeBubble,
  runCMBubbleOp,
} from './lib/slash-bubble';
import { checkboxDecorations } from './decorations/checkbox';
import { fenceDecorations } from './decorations/fence';
import { toggleDecorations } from './decorations/toggle';

interface MarkdownEditorProps {
  noteId: string;
  seedBodyMD: string;
  placeholder?: string;
  onTextChange?: (text: string) => void;
}

export function MarkdownEditor({ noteId, seedBodyMD, placeholder = 'Write your thoughts…', onTextChange }: MarkdownEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const handleRef = useRef<NoteYjsHandle | null>(null);
  const onTextChangeRef = useRef(onTextChange);
  onTextChangeRef.current = onTextChange;
  // Slash menu — viewport coords + query (после `/`) + slashStart (doc-pos
  // самого `/`). При выборе command'ы integrator стирает [slashStart..cursor)
  // и вставляет block prefix.
  const [slash, setSlash] = useState<{ x: number; y: number; query: string; slashStart: number } | null>(null);
  // Floating bubble toolbar — DOMRect выделения. Null = hidden.
  const [bubbleRect, setBubbleRect] = useState<DOMRect | null>(null);
  // Active ops set — обновляется тем же updateListener'ом что и bubbleRect.
  const [activeOpsSet, setActiveOpsSet] = useState<Set<ToolbarOp>>(() => new Set());
  // seedBodyMD / placeholder читаем через refs — иначе их обновления
  // (которые случаются при каждом setDraftBody parent'ом) попали бы в
  // useEffect deps и вызвали destroy+recreate editor'а на каждый
  // keystroke. Это убивало курсор и сбрасывало ввод.
  // Effect должен mount'ить editor РОВНО ОДИН РАЗ per noteId.
  const seedBodyMDRef = useRef(seedBodyMD);
  const placeholderRef = useRef(placeholder);
  // Update refs on every render — БЕЗ deps в useEffect, чтобы не
  // re-mount'ить editor. Refs use'аются только на effect mount (один раз
  // per noteId), последующие changes prop'ов отображаются в ref для
  // следующего mount'а (когда сменится noteId).
  seedBodyMDRef.current = seedBodyMD;
  placeholderRef.current = placeholder;

  useEffect(() => {
    if (!containerRef.current) return;

    // ВНИМАНИЕ: читаем через refs — НЕ напрямую props. Деps этого useEffect
    // [noteId] only. Если бы seedBodyMD был в deps, parent'ов setDraftBody
    // (на каждый keystroke) re-mount'ил бы editor. См. ref defs выше.
    const handle = attachNoteYjs(noteId, seedBodyMDRef.current);
    handleRef.current = handle;

    const config: EditorStateConfig = {
      doc: handle.ytext.toString(),
      extensions: [
        history(),
        drawSelection(),
        EditorView.lineWrapping,
        markdown({ addKeymap: false }), // мы прописываем свои keymap'ы вручную
        syntaxHighlighting(notionLikeHighlight),
        // markdownLineDecorations + wysiwygDecorations УДАЛЕНЫ — их line-class
        // декорации (`cm-md-h*`, `cm-heading-*`) конфликтовали с
        // notionLikeHighlight token-based fontSize → CM6 measure inconsistencies
        // → arrow nav пропускала heading levels. Token-based sizing через
        // syntaxHighlighting(notionLikeHighlight) выше — единственный источник
        // heading typography. Caret nav теперь работает по дефолтным CM6
        // правилам без custom interference.
        checkboxDecorations(),
        fenceDecorations(),
        toggleDecorations(),
        keymap.of([
          ...defaultKeymap,
          ...historyKeymap,
          // Auto-continuation: Enter после list/quote prefix → продолжаем
          // prefix; пустой prefix → выходим из структуры.
          { key: 'Enter', run: continueLinePrefix },
          // Markdown wrappers — keymap-shortcuts.
          { key: 'Mod-b', run: wrapSelection('**', '**') },
          { key: 'Mod-i', run: wrapSelection('_', '_') },
          { key: 'Mod-k', run: insertLink },
          // Heading shortcuts — Notion compatibility (⌘⌥1/2/3).
          { key: 'Mod-Alt-1', run: (v) => togglePrefix(v, '# ') },
          { key: 'Mod-Alt-2', run: (v) => togglePrefix(v, '## ') },
          { key: 'Mod-Alt-3', run: (v) => togglePrefix(v, '### ') },
        ]),
        yCollab(handle.ytext, null),
        placeholderExt(placeholderRef.current),
        notionTheme(),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const text = update.state.doc.toString();
            onTextChangeRef.current?.(text);
          }
          // Slash-menu trigger detection. На каждое изменение selection или
          // doc'а пересчитываем — вкл/выкл/обновляем query.
          if (update.docChanged || update.selectionSet || update.focusChanged) {
            recomputeSlash(update.view, setSlash);
            recomputeBubble(update.view, setBubbleRect, setActiveOpsSet);
          }
        }),
        // Click-outside и blur тоже скрывают — focus changes покрывает
        // часть, но click без focus-change (e.g. выбор пункта в dropdown)
        // нужен отдельный handler. SlashMenu сам слушает window:mousedown.
      ],
    };

    const view = new EditorView({
      state: EditorState.create(config),
      parent: containerRef.current,
    });
    viewRef.current = view;

    void handle.ready;

    return () => {
      view.destroy();
      viewRef.current = null;
      handle.close();
      handleRef.current = null;
    };
    // ВАЖНО: deps ТОЛЬКО [noteId]. seedBodyMD/placeholder/onTextChange
    // читаются через refs внутри (см. seedBodyMDRef / placeholderRef /
    // onTextChangeRef). Любая re-evaluation effect'а = destroy+recreate
    // CM6 view = курсор теряется и input в полёте дропается. Editor
    // должен mount'иться РОВНО один раз на каждую открытую заметку.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId]);

  // EditorAPI for slash-menu — все операции выражены через CodeMirror
  // transactions. slash хранит slashStart (doc-pos `/`) — мы заменяем
  // [slashStart .. cursor] на нужный prefix.
  const slashEditorAPI: EditorAPI = useMemo(() => {
    const replaceRange = (insert: string, cursorOffset?: number) => {
      const view = viewRef.current;
      if (!view || !slash) return;
      const cursor = view.state.selection.main.head;
      const tr = view.state.update({
        changes: { from: slash.slashStart, to: cursor, insert },
        selection: {
          anchor:
            cursorOffset !== undefined
              ? slash.slashStart + cursorOffset
              : slash.slashStart + insert.length,
        },
      });
      view.dispatch(tr);
      view.focus();
    };
    return {
      insertBlock: (prefix) => replaceRange(prefix),
      insertCodeBlock: () => {
        const block = '```javascript\n\n```\n';
        replaceRange(block, '```javascript\n'.length);
      },
      insertToggle: () => {
        const block = '<details>\n<summary>Title</summary>\n\nContent\n</details>\n';
        replaceRange(block, '<details>\n<summary>'.length);
      },
      insertCallout: () => {
        replaceRange('> **Note:** ');
      },
    };
  }, [slash]);

  // Bubble-toolbar handlers. Reuse CM6 dispatch'ит — proper undo + Yjs sync.
  const onBubbleOp = (op: Exclude<ToolbarOp, 'link'>) => {
    const view = viewRef.current;
    if (!view) return;
    runCMBubbleOp(view, op, activeOpsSet);
  };
  const onBubbleLink = (url: string) => {
    const view = viewRef.current;
    if (!view) return;
    const { from, to } = view.state.selection.main;
    const sel = view.state.sliceDoc(from, to) || 'link';
    const insert = `[${sel}](${url})`;
    view.dispatch({
      changes: { from, to, insert },
      selection: { anchor: from + insert.length },
    });
    view.focus();
  };

  return (
    <div style={{ position: 'relative' }}>
      {/* Static Toolbar убран намеренно — форматирование только через
       *  slash-меню (`/`) и FloatingToolbar при выделении текста. См.
       *  spec Fix 1 в Notes-редактор-rewrite. Old Toolbar component +
       *  hone:md-toolbar event listener больше не используются;
       *  оставлены ниже как dead code чтобы не плодить refactor-noise. */}
      <div ref={containerRef} style={{ minHeight: 280 }} />
      <FloatingToolbar
        rect={bubbleRect}
        activeOps={activeOpsSet}
        onOp={onBubbleOp}
        onLink={onBubbleLink}
        onDismiss={() => setBubbleRect(null)}
      />
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

// LiveMarkdownEditor — Obsidian-style live preview on CodeMirror 6.
// Markdown source is stored as plain text; syntax markers hide when the
// cursor leaves the line and block styles apply immediately (headings, lists, …).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { markdownLanguage } from '@codemirror/lang-markdown';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';

import { livePreviewPlugin, notesEditorTheme } from '@shared/lib/codemirror/livePreview';
import { notesKeymap } from '@shared/lib/codemirror/notesKeymap';
import { SlashMenu, type EditorAPI } from './SlashMenu';

interface LiveMarkdownEditorProps {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
}

function findSlashTrigger(state: EditorState): { slashStart: number; query: string } | null {
  const range = state.selection.main;
  if (!range.empty) return null;

  const pos = range.from;
  const line = state.doc.lineAt(pos);
  const before = state.sliceDoc(line.from, pos);
  let i = before.length - 1;
  while (i >= 0) {
    const ch = before.charAt(i);
    if (ch === '/') break;
    if (ch === '\n' || ch === ' ' || ch === '\t') return null;
    i -= 1;
  }
  if (i < 0) return null;

  const slashStart = line.from + i;
  if (i > 0) {
    const prev = before.charAt(i - 1);
    if (prev !== '\n' && prev !== ' ' && prev !== '\t') return null;
  }

  return { slashStart, query: before.slice(i + 1) };
}

export function LiveMarkdownEditor({ value, onChange, placeholder }: LiveMarkdownEditorProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const syncingRef = useRef(false);
  onChangeRef.current = onChange;

  const [slash, setSlash] = useState<{ x: number; y: number; query: string; slashStart: number } | null>(
    null,
  );

  const updateSlash = useCallback((view: EditorView) => {
    if (document.activeElement !== view.contentDOM) {
      setSlash(null);
      return;
    }
    const trigger = findSlashTrigger(view.state);
    if (!trigger) {
      setSlash(null);
      return;
    }
    const coords = view.coordsAtPos(view.state.selection.main.head);
    if (!coords) {
      setSlash(null);
      return;
    }
    setSlash({
      x: coords.left,
      y: coords.bottom + 4,
      query: trigger.query,
      slashStart: trigger.slashStart,
    });
  }, []);

  useEffect(() => {
    const parent = mountRef.current;
    if (!parent) return;

    const view = new EditorView({
      parent,
      state: EditorState.create({
        doc: value,
        extensions: [
          history(),
          markdownLanguage,
          livePreviewPlugin,
          notesEditorTheme,
          EditorView.lineWrapping,
          keymap.of([...notesKeymap, ...defaultKeymap, ...historyKeymap]),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              syncingRef.current = true;
              onChangeRef.current(update.state.doc.toString());
              syncingRef.current = false;
            }
            if (update.docChanged || update.selectionSet) {
              updateSlash(update.view);
            }
          }),
        ],
      }),
    });
    viewRef.current = view;
    updateSlash(view);

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || syncingRef.current) return;
    const cur = view.state.doc.toString();
    if (cur === value) return;
    view.dispatch({
      changes: { from: 0, to: cur.length, insert: value },
    });
    updateSlash(view);
  }, [value, updateSlash]);

  const editorApi = useMemo((): EditorAPI => {
    const replaceSlashWith = (insert: string, cursorOffset?: number) => {
      const view = viewRef.current;
      if (!view || !slash) return;
      const pos = view.state.selection.main.from;
      view.dispatch({
        changes: { from: slash.slashStart, to: pos, insert },
        selection: {
          anchor: slash.slashStart + (cursorOffset ?? insert.length),
        },
      });
      setSlash(null);
      view.focus();
    };
    return {
      insertBlock: (prefix) => replaceSlashWith(prefix),
      insertCodeBlock: () => {
        const block = '```javascript\n\n```\n';
        replaceSlashWith(block, '```javascript\n'.length);
      },
    };
  }, [slash]);

  const removeSlashQuery = useCallback(() => {
    const view = viewRef.current;
    if (!view || !slash) return;
    const pos = view.state.selection.main.from;
    view.dispatch({
      changes: { from: slash.slashStart, to: pos, insert: '' },
      selection: { anchor: slash.slashStart },
    });
  }, [slash]);

  const empty = value.length === 0;

  return (
    <div className="hone-live-md" data-empty={empty ? 'true' : 'false'} data-placeholder={placeholder ?? ''}>
      <div
        ref={mountRef}
        className="hone-live-md__mount"
        data-hone-demo-target="note-editor"
      />
      {slash && (
        <SlashMenu
          x={slash.x}
          y={slash.y}
          query={slash.query}
          editor={editorApi}
          onClose={() => setSlash(null)}
          onBeforeAction={removeSlashQuery}
        />
      )}
    </div>
  );
}

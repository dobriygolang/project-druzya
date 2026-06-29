import { EditorView } from '@codemirror/view';

// ─── Theme ────────────────────────────────────────────────────────────────

export function notionTheme() {
  return EditorView.theme(
    {
      '&': {
        backgroundColor: 'transparent',
        color: 'var(--ink)',
      },
      '.cm-content': {
        fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", system-ui, sans-serif',
        fontSize: '16px',
        lineHeight: '1.65',
        padding: '0',
        caretColor: 'var(--ink)',
      },
      '.cm-cursor, .cm-dropCursor': {
        borderLeftColor: 'var(--ink)',
        borderLeftWidth: '1.5px',
      },
      '.cm-selectionBackground, ::selection': {
        backgroundColor: 'rgb(var(--ink-rgb) / 0.18)',
      },
      '&.cm-focused .cm-selectionBackground': {
        backgroundColor: 'rgb(var(--ink-rgb) / 0.22)',
      },
      '&.cm-focused': {
        outline: 'none',
      },
      '.cm-line': {
        padding: '0',
      },
      '.cm-placeholder': {
        color: 'var(--ink-40)',
        fontStyle: 'normal',
      },

      // Block-level decorations.
      '.cm-md-quote-line': {
        borderLeft: '3px solid var(--ink-20)',
        paddingLeft: '14px',
        color: 'var(--ink-60)',
      },
      '.cm-md-code-line': {
        background: 'var(--hair)',
        fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
        fontSize: '13.5px',
        paddingLeft: '14px',
        paddingRight: '14px',
      },
      '.cm-md-code-first': {
        paddingTop: '6px',
        borderTopLeftRadius: '6px',
        borderTopRightRadius: '6px',
        marginTop: '4px',
      },
      '.cm-md-code-last': {
        paddingBottom: '6px',
        borderBottomLeftRadius: '6px',
        borderBottomRightRadius: '6px',
        marginBottom: '4px',
      },
      // Heading line — chunk margin для воздуха над/под.
      '.cm-md-h': {
        marginTop: '0.6em',
        marginBottom: '0.2em',
      },
      '.cm-md-h1': { marginTop: '0.8em' },
      '.cm-md-h2': { marginTop: '0.7em' },

      // y-codemirror.next selection-info popup — hide для single-user
      // multi-device (awareness UI deferred per ADR).
      '.cm-ySelectionInfo': { display: 'none' },
    },
    { dark: true },
  );
}

import { HighlightStyle } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';

// ─── Highlight style (token-based) ────────────────────────────────────────
//
// HighlightStyle применяется к token'ам которые Lezer parser помечает
// тегами. Stronger типографическая иерархия на heading'ах + faded
// markup-маркеры (`#`, `**`, `_`, `>`, `-`).

export const notionLikeHighlight = HighlightStyle.define([
  // Headings — больший размер, semibold, чуть tight letter-spacing.
  {
    tag: t.heading1,
    fontSize: '32px',
    fontWeight: '700',
    letterSpacing: '-0.02em',
    lineHeight: '1.25',
  },
  {
    tag: t.heading2,
    fontSize: '24px',
    fontWeight: '600',
    letterSpacing: '-0.018em',
    lineHeight: '1.3',
  },
  {
    tag: t.heading3,
    fontSize: '19px',
    fontWeight: '600',
    letterSpacing: '-0.015em',
    lineHeight: '1.35',
  },
  { tag: t.heading4, fontSize: '17px', fontWeight: '600' },
  { tag: t.heading5, fontSize: '15px', fontWeight: '600' },
  { tag: t.heading6, fontSize: '14px', fontWeight: '600' },

  // Bold / italic.
  { tag: t.strong, fontWeight: '700' },
  { tag: t.emphasis, fontStyle: 'italic' },
  { tag: t.strikethrough, textDecoration: 'line-through', color: 'var(--ink-40)' },

  // Inline code: monospace + subtle bg.
  {
    tag: t.monospace,
    fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
    fontSize: '0.9em',
    background: 'var(--hair)',
    padding: '1px 5px',
    borderRadius: '4px',
  },

  // Links (text part).
  { tag: t.link, color: 'var(--ink)', textDecoration: 'underline' },
  { tag: t.url, color: 'var(--ink-40)' },

  // Lists.
  { tag: t.list, color: 'var(--ink)' },

  // Quotes — italic, ink-60 (border-left добавит ViewPlugin ниже).
  { tag: t.quote, fontStyle: 'italic', color: 'var(--ink-60)' },

  // Faded markup. Lezer-tag `processInstruction` / `meta` / `comment` —
  // нет на markdown'е. Используем tag.processingInstruction для marker'ов
  // (`#`, `**`, `_`, `\``, `-`, `>`). Если parser не маркирует их этим
  // тэгом (зависит от @lezer/markdown version) — fallback в decoration
  // mark внизу.
  {
    tag: [t.processingInstruction, t.punctuation, t.meta],
    color: 'var(--ink-40)',
    opacity: '0.6',
  },
]);

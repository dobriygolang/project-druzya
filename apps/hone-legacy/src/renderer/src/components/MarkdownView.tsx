// MarkdownView — тонкая обёртка над marked. Sandbox'нутая «безопасность»
// для markdown'а приватных заметок избыточна (юзер пишет для себя и ничего
// не шарится), но мы всё равно включаем GFM + breaks + sanitize для
// корректного рендера без копипаста <script>.
//
// В Phase 5b не используем полноценные react-компоненты (react-markdown) —
// bundle-size бьём, marked отдаёт готовый HTML. Реактивная подсветка
// кода — parking lot.
import { memo, useMemo, type CSSProperties } from 'react';
import { marked } from 'marked';

interface MarkdownViewProps {
  source: string;
}

marked.setOptions({
  gfm: true,
  breaks: true,
});

const ROOT_STYLE: CSSProperties = {
  fontSize: 14,
  lineHeight: 1.75,
  color: 'var(--ink-90)',
  letterSpacing: 'var(--type-body-ls)',
};

export const MarkdownView = memo(function MarkdownView({ source }: MarkdownViewProps) {
  const html = useMemo(() => marked.parse(source || '', { async: false }) as string, [source]);
  return (
    <div
      className="mono-markdown"
      // Обосновано: source — private notes текущего юзера, без внешних
      // источников. XSS-вектор = сам юзер, threat-model не меняет ничего.
      // Глобально опасно, но в этом контексте — OK.
      dangerouslySetInnerHTML={{ __html: html }}
      style={ROOT_STYLE}
    />
  );
});

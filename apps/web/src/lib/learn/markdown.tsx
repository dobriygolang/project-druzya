import type { ReactNode } from 'react'

type Block =
  | { kind: 'heading'; level: 2 | 3; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'code'; language: string; code: string }
  | { kind: 'ul'; items: string[] }
  | { kind: 'ol'; items: string[] }

function parseInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = []
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*)/g
  let last = 0
  let match: RegExpExecArray | null
  let index = 0

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) {
      nodes.push(text.slice(last, match.index))
    }
    const token = match[0]
    if (token.startsWith('`')) {
      nodes.push(
        <code
          key={`${keyPrefix}-c-${index}`}
          className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[12px] text-text-primary"
        >
          {token.slice(1, -1)}
        </code>,
      )
    } else {
      nodes.push(
        <strong key={`${keyPrefix}-b-${index}`} className="font-semibold text-text-primary">
          {token.slice(2, -2)}
        </strong>,
      )
    }
    last = match.index + token.length
    index++
  }

  if (last < text.length) {
    nodes.push(text.slice(last))
  }
  return nodes.length > 0 ? nodes : [text]
}

function parseBlocks(body: string): Block[] {
  const lines = body.replace(/\r\n/g, '\n').split('\n')
  const blocks: Block[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    if (!trimmed) {
      i++
      continue
    }

    if (trimmed.startsWith('```')) {
      const language = trimmed.slice(3).trim()
      i++
      const codeLines: string[] = []
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      if (i < lines.length) i++
      blocks.push({ kind: 'code', language, code: codeLines.join('\n') })
      continue
    }

    if (trimmed.startsWith('## ')) {
      blocks.push({ kind: 'heading', level: 2, text: trimmed.slice(3) })
      i++
      continue
    }

    if (trimmed.startsWith('### ')) {
      blocks.push({ kind: 'heading', level: 3, text: trimmed.slice(4) })
      i++
      continue
    }

    if (/^-\s+/.test(trimmed)) {
      const items: string[] = []
      while (i < lines.length && /^-\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^-\s+/, ''))
        i++
      }
      blocks.push({ kind: 'ul', items })
      continue
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = []
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ''))
        i++
      }
      blocks.push({ kind: 'ol', items })
      continue
    }

    const paraLines: string[] = [trimmed]
    i++
    while (i < lines.length) {
      const next = lines[i].trim()
      if (
        !next ||
        next.startsWith('```') ||
        next.startsWith('## ') ||
        next.startsWith('### ') ||
        /^-\s+/.test(next) ||
        /^\d+\.\s+/.test(next)
      ) {
        break
      }
      paraLines.push(next)
      i++
    }
    blocks.push({ kind: 'paragraph', text: paraLines.join(' ') })
  }

  return blocks
}

export function ArticleMarkdown({ body }: { body: string }) {
  const blocks = parseBlocks(body)

  return (
    <div className="space-y-3">
      {blocks.map((block, index) => {
        switch (block.kind) {
          case 'heading':
            if (block.level === 3) {
              return (
                <h3 key={index} className="mt-5 text-[15px] font-semibold first:mt-0">
                  {block.text}
                </h3>
              )
            }
            return (
              <h2 key={index} className="mt-6 text-[16px] font-semibold first:mt-0">
                {block.text}
              </h2>
            )
          case 'code':
            return (
              <pre
                key={index}
                className="overflow-x-auto rounded-xl border border-border bg-surface-2 p-4 font-mono text-[13px] leading-relaxed text-text-primary"
              >
                {block.language ? (
                  <div className="mb-2 font-sans text-[10px] uppercase tracking-[0.08em] text-text-muted">
                    {block.language}
                  </div>
                ) : null}
                <code>{block.code}</code>
              </pre>
            )
          case 'ul':
            return (
              <ul key={index} className="ml-4 list-disc space-y-1 text-[14px] leading-relaxed text-text-secondary">
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex}>{parseInline(item, `ul-${index}-${itemIndex}`)}</li>
                ))}
              </ul>
            )
          case 'ol':
            return (
              <ol key={index} className="ml-4 list-decimal space-y-1 text-[14px] leading-relaxed text-text-secondary">
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex}>{parseInline(item, `ol-${index}-${itemIndex}`)}</li>
                ))}
              </ol>
            )
          default:
            return (
              <p key={index} className="text-[14px] leading-relaxed text-text-secondary">
                {parseInline(block.text, `p-${index}`)}
              </p>
            )
        }
      })}
    </div>
  )
}

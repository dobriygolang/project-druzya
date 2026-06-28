import type { Completion, CompletionContext, CompletionResult } from '@codemirror/autocomplete'

export function completion(label: string, type: string, detail?: string, info?: string): Completion {
  return { label, type, detail, info }
}

/** Suggest members after `pkg.method` for known stdlib / builtin maps. */
export function dotMemberSource(members: Record<string, Completion[]>) {
  return (context: CompletionContext): CompletionResult | null => {
    const word = context.matchBefore(/[\w$]+(?:\.[\w$]*)?$/)
    if (!word) return null
    if (word.text === '' && !context.explicit) return null

    const dotAt = word.text.lastIndexOf('.')
    if (dotAt < 0) return null

    const receiver = word.text.slice(0, dotAt)
    const prefix = word.text.slice(dotAt + 1)
    const options = members[receiver]
    if (!options?.length) return null

    const filtered = prefix
      ? options.filter((o) => o.label.startsWith(prefix))
      : options
    if (!filtered.length && !context.explicit) return null

    return {
      from: word.from + dotAt + 1,
      options: filtered.length ? filtered : options,
      validFor: /^[\w$]*$/,
    }
  }
}

/** Top-level package / module names (Go import paths, Python modules). */
export function identifierPrefixSource(
  items: Completion[],
  opts?: { minPrefix?: number },
) {
  const minPrefix = opts?.minPrefix ?? 1
  return (context: CompletionContext): CompletionResult | null => {
    const word = context.matchBefore(/[\w$]+$/)
    if (!word) return null
    if (word.text.includes('.')) return null
    if (word.text.length < minPrefix && !context.explicit) return null

    const filtered = word.text
      ? items.filter((o) => o.label.startsWith(word.text))
      : items
    if (!filtered.length && !context.explicit) return null

    return {
      from: word.from,
      options: filtered.length ? filtered : items,
      validFor: /^[\w$]*$/,
    }
  }
}

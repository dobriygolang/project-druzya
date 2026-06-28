export const LIVE_LANGS = [
  { id: 'go', label: 'Go' },
  { id: 'python', label: 'Python' },
  { id: 'javascript', label: 'JavaScript' },
  { id: 'typescript', label: 'TypeScript' },
] as const

export type LiveLanguageId = (typeof LIVE_LANGS)[number]['id']

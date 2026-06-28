/** Catalog task/section types — matches Postgres CHECK in content migrations. */
export const TASK_TYPES = [
  'algorithm',
  'live_coding',
  'system_design',
  'behavioral',
  'sql',
  'debugging',
  'architecture',
] as const

export type TaskType = (typeof TASK_TYPES)[number]

export const TASK_DIFFICULTIES = ['easy', 'medium', 'hard'] as const
export type TaskDifficulty = (typeof TASK_DIFFICULTIES)[number]

export const TASK_STATUSES = ['draft', 'published', 'archived'] as const
export type TaskStatus = (typeof TASK_STATUSES)[number]

/** LLM chain providers — matches services/ai llmchain registry. */
export const LLM_PROVIDERS = [
  'groq',
  'cerebras',
  'mistral',
  'openrouter',
  'google',
  'cloudflare',
  'zai',
  'deepseek',
  'ollama',
] as const

export type LLMProvider = (typeof LLM_PROVIDERS)[number]

/** Common code languages for reference solutions. */
export const CODE_LANGUAGES = [
  { value: '', label: '— (prose / no language)' },
  { value: 'go', label: 'Go' },
  { value: 'python', label: 'Python' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'java', label: 'Java' },
  { value: 'cpp', label: 'C++' },
  { value: 'sql', label: 'SQL' },
] as const

/** Known skill keys for article taxonomy (convention; custom keys still allowed). */
export const SKILL_KEY_OPTIONS = [
  'algorithm.overall',
  'algorithm.correctness',
  'algorithm.arrays',
  'algorithm.strings',
  'algorithm.trees',
  'algorithm.graphs',
  'algorithm.dynamic_programming',
  'behavioral.overall',
  'live_coding.overall',
  'system_design.overall',
  'sql.overall',
] as const

export const inputClassName =
  'mt-1 w-full rounded border border-border bg-surface-1 px-3 py-2 text-sm'

export const labelClassName = 'block text-sm'

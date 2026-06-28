import { inputClassName, labelClassName } from '@/lib/admin/options'
import { enumsEn } from '@/lib/labels/enums.en'

type Option = { value: string; label: string }

export function AdminSelect({
  label,
  value,
  onChange,
  options,
  disabled,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: Option[]
  disabled?: boolean
}) {
  return (
    <label className={labelClassName}>
      {label}
      <select
        className={inputClassName}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export function TaskTypeSelect({
  label = 'Type',
  value,
  onChange,
}: {
  label?: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <AdminSelect
      label={label}
      value={value}
      onChange={onChange}
      options={[
        { value: 'algorithm', label: enumsEn.taskType.algorithm },
        { value: 'live_coding', label: enumsEn.taskType.live_coding },
        { value: 'system_design', label: enumsEn.taskType.system_design },
        { value: 'behavioral', label: enumsEn.taskType.behavioral },
        { value: 'sql', label: enumsEn.taskType.sql },
        { value: 'debugging', label: enumsEn.taskType.debugging },
        { value: 'architecture', label: enumsEn.taskType.architecture },
      ]}
    />
  )
}

export function DifficultySelect({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  return (
    <AdminSelect
      label="Difficulty"
      value={value}
      onChange={onChange}
      options={[
        { value: 'easy', label: enumsEn.difficulty.easy },
        { value: 'medium', label: enumsEn.difficulty.medium },
        { value: 'hard', label: enumsEn.difficulty.hard },
      ]}
    />
  )
}

export function TaskStatusSelect({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  return (
    <AdminSelect
      label="Status"
      value={value}
      onChange={onChange}
      options={[
        { value: 'draft', label: 'Draft' },
        { value: 'published', label: 'Published' },
        { value: 'archived', label: 'Archived' },
      ]}
    />
  )
}

/** Checkbox list for picking multiple values from a fixed set. */
export function CheckboxMultiSelect({
  label,
  options,
  selected,
  onChange,
  emptyHint,
}: {
  label: string
  options: Option[]
  selected: string[]
  onChange: (values: string[]) => void
  emptyHint?: string
}) {
  function toggle(value: string) {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value))
    } else {
      onChange([...selected, value])
    }
  }

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{label}</legend>
      {options.length === 0 && emptyHint ? (
        <p className="text-xs text-text-muted">{emptyHint}</p>
      ) : null}
      <div className="max-h-48 space-y-1 overflow-y-auto rounded border border-border p-2">
        {options.map((opt) => (
          <label key={opt.value} className="flex cursor-pointer items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={selected.includes(opt.value)}
              onChange={() => toggle(opt.value)}
            />
            <span>
              <span className="font-medium">{opt.label}</span>
              {opt.value !== opt.label ? (
                <span className="ml-1 font-mono text-xs text-text-muted">({opt.value})</span>
              ) : null}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

/** Ordered provider picker: available pool + ordered chain with move/remove. */
export function OrderedProviderPicker({
  label,
  available,
  selected,
  onChange,
}: {
  label: string
  available: readonly string[]
  selected: string[]
  onChange: (providers: string[]) => void
}) {
  const pool = available.filter((p) => !selected.includes(p))

  function add(provider: string) {
    onChange([...selected, provider])
  }

  function remove(provider: string) {
    onChange(selected.filter((p) => p !== provider))
  }

  function move(index: number, delta: number) {
    const next = [...selected]
    const target = index + delta
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">{label}</p>
      <p className="text-xs text-text-muted">
        First provider is tried first. Add from the pool below; reorder with arrows.
      </p>

      {selected.length > 0 ? (
        <ol className="space-y-1">
          {selected.map((provider, index) => (
            <li
              key={provider}
              className="flex items-center justify-between gap-2 rounded border border-border px-3 py-2 text-sm"
            >
              <span>
                <span className="mr-2 text-xs text-text-muted">{index + 1}.</span>
                <span className="font-medium capitalize">{provider}</span>
              </span>
              <span className="flex gap-1">
                <button
                  type="button"
                  className="rounded px-2 py-0.5 text-xs text-text-muted hover:bg-surface-2"
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="rounded px-2 py-0.5 text-xs text-text-muted hover:bg-surface-2"
                  disabled={index === selected.length - 1}
                  onClick={() => move(index, 1)}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="rounded px-2 py-0.5 text-xs text-red-500 hover:bg-surface-2"
                  onClick={() => remove(provider)}
                >
                  Remove
                </button>
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-text-muted">No providers selected — env LLM_CHAIN_ORDER is used.</p>
      )}

      {pool.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {pool.map((provider) => (
            <button
              key={provider}
              type="button"
              className="rounded border border-border px-3 py-1 text-sm capitalize hover:bg-surface-2"
              onClick={() => add(provider)}
            >
              + {provider}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

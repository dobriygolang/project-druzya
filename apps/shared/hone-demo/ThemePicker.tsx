import type { CanvasThemeId, HoneDemoLabels } from './types'
import { PICKER_THEMES, THEME_LABEL_KEYS } from './types'

interface ThemePickerProps {
  value: CanvasThemeId
  onChange: (theme: CanvasThemeId) => void
  labels: HoneDemoLabels
  compact?: boolean
}

export function ThemePicker({ value, onChange, labels, compact }: ThemePickerProps) {
  return (
    <div className={`hone-demo-theme-picker${compact ? ' hone-demo-theme-picker--compact' : ''}`}>
      {PICKER_THEMES.map((id) => (
        <button
          key={id}
          type="button"
          className={`hone-demo-theme-picker__btn${value === id ? ' hone-demo-theme-picker__btn--active' : ''}`}
          onClick={() => onChange(id)}
          aria-pressed={value === id}
        >
          {labels[THEME_LABEL_KEYS[id]]}
        </button>
      ))}
    </div>
  )
}

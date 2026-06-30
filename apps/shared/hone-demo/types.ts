export type CanvasThemeId = 'winter' | 'particles' | 'drift' | 'debris' | 'launch' | 'visor'

export type DemoPanel = 'home' | 'notes' | 'today'

export type DemoMode = 'interactive' | 'showcase'

export interface HoneDemoLabels {
  ariaLabel: string
  hint: string
  menu: string
  play: string
  pause: string
  reset: string
  dockHome: string
  dockToday: string
  dockNotes: string
  themeWinter: string
  themeParticles: string
  themeDrift: string
  themeDebris: string
  themeLaunch: string
  themeVisor: string
  noteTitle: string
  noteBody: string
  todayHeading: string
  task1: string
  task2: string
  task3: string
}

export interface HoneWorkspaceDemoProps {
  siteTheme: 'dark' | 'light'
  labels: HoneDemoLabels
  mode?: DemoMode
  compact?: boolean
  className?: string
  assetBase?: string
  showThemePicker?: boolean
}

export const PICKER_THEMES: CanvasThemeId[] = [
  'winter',
  'particles',
  'drift',
  'debris',
  'launch',
]

export const THEME_LABEL_KEYS: Record<
  CanvasThemeId,
  keyof Pick<
    HoneDemoLabels,
    | 'themeWinter'
    | 'themeParticles'
    | 'themeDrift'
    | 'themeDebris'
    | 'themeLaunch'
    | 'themeVisor'
  >
> = {
  winter: 'themeWinter',
  particles: 'themeParticles',
  drift: 'themeDrift',
  debris: 'themeDebris',
  launch: 'themeLaunch',
  visor: 'themeVisor',
}

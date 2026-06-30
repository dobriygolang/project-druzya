import { HoneWorkspaceDemo, type DemoMode, type HoneDemoLabels } from '@d9-hone-demo'
import { useI18n } from '@/lib/i18n'
import { useSiteTheme } from '@/lib/site/useSiteTheme'

interface LandingHoneDemoProps {
  mode?: DemoMode
  compact?: boolean
  showThemePicker?: boolean
}

export function LandingHoneDemo({
  mode = 'interactive',
  compact = false,
  showThemePicker,
}: LandingHoneDemoProps) {
  const { t } = useI18n()
  const { theme } = useSiteTheme()

  const labels: HoneDemoLabels = {
    ariaLabel: t('welcome.demoAriaLabel'),
    hint: t('welcome.demoHint'),
    menu: t('welcome.demoMenu'),
    play: t('welcome.demoPlay'),
    pause: t('welcome.demoPause'),
    reset: t('welcome.demoReset'),
    dockHome: t('welcome.demoDockHome'),
    dockToday: t('welcome.demoDockToday'),
    dockNotes: t('welcome.demoDockNotes'),
    themeWinter: t('welcome.demoThemeWinter'),
    themeParticles: t('welcome.demoThemeParticles'),
    themeDrift: t('welcome.demoThemeDrift'),
    themeDebris: t('welcome.demoThemeDebris'),
    themeLaunch: t('welcome.demoThemeLaunch'),
    themeVisor: t('welcome.demoThemeVisor'),
    noteTitle: t('welcome.demoNoteTitle'),
    noteBody: t('welcome.demoNoteBody'),
    todayHeading: t('welcome.demoTodayHeading'),
    task1: t('welcome.demoTask1'),
    task2: t('welcome.demoTask2'),
    task3: t('welcome.demoTask3'),
  }

  return (
    <HoneWorkspaceDemo
      siteTheme={theme}
      labels={labels}
      mode={mode}
      compact={compact}
      showThemePicker={showThemePicker}
    />
  )
}

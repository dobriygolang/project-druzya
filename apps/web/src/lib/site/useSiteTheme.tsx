import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { readSiteTheme, writeSiteTheme, type SiteTheme } from '@/lib/site/theme'

type SiteThemeContextValue = {
  theme: SiteTheme
  setTheme: (theme: SiteTheme) => void
  toggleTheme: () => void
}

const SiteThemeContext = createContext<SiteThemeContextValue | null>(null)

export function SiteThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<SiteTheme>(() => readSiteTheme())

  useEffect(() => {
    document.documentElement.dataset.siteTheme = theme
  }, [theme])

  const setTheme = useCallback((next: SiteTheme) => {
    writeSiteTheme(next)
    setThemeState(next)
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }, [setTheme, theme])

  const value = useMemo(() => ({ theme, setTheme, toggleTheme }), [theme, setTheme, toggleTheme])

  return <SiteThemeContext.Provider value={value}>{children}</SiteThemeContext.Provider>
}

export function useSiteTheme(): SiteThemeContextValue {
  const ctx = useContext(SiteThemeContext)
  if (!ctx) throw new Error('useSiteTheme must be used within SiteThemeProvider')
  return ctx
}

type SiteThemeShellProps = {
  theme: SiteTheme
  children: ReactNode
  className?: string
}

export function SiteThemeShell({ theme, children, className }: SiteThemeShellProps) {
  useEffect(() => {
    const html = document.documentElement
    html.style.scrollBehavior = 'smooth'
    html.classList.remove('light', 'dark')
    html.classList.add(theme === 'dark' ? 'dark' : 'light')
    document.body.classList.add('site-public')
    return () => {
      document.body.classList.remove('site-public')
    }
  }, [theme])

  return (
    <div data-site-theme={theme} className={className}>
      {children}
    </div>
  )
}

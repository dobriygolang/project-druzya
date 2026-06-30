import type { Config } from 'tailwindcss'

/** druz9 v2 — ported from /Users/sedorofeevd/Desktop/druzya/frontend/tailwind.config.ts */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        winter: {
          bg: '#050505',
          card: '#0f0f0f',
          border: '#27272a',
          text: '#e4e4e7',
          muted: '#a1a1aa',
          accent: '#ffffff',
        },
        site: {
          bg: 'rgb(var(--site-bg) / <alpha-value>)',
          surface: 'rgb(var(--site-surface) / <alpha-value>)',
          card: 'rgb(var(--site-card) / <alpha-value>)',
          border: 'rgb(var(--site-border) / <alpha-value>)',
          text: 'rgb(var(--site-text) / <alpha-value>)',
          muted: 'rgb(var(--site-muted) / <alpha-value>)',
          accent: 'rgb(var(--site-accent) / <alpha-value>)',
          'accent-fg': 'rgb(var(--site-accent-fg) / <alpha-value>)',
        },
        bg: 'rgb(var(--color-bg) / <alpha-value>)',
        surface: {
          1: 'rgb(var(--color-surface-1) / <alpha-value>)',
          2: 'rgb(var(--color-surface-2) / <alpha-value>)',
          3: 'rgb(var(--color-surface-3) / <alpha-value>)',
        },
        border: {
          DEFAULT: 'rgb(var(--color-border) / <alpha-value>)',
          strong: 'rgb(var(--color-border-strong) / <alpha-value>)',
        },
        text: {
          primary: 'rgb(var(--color-text-primary) / <alpha-value>)',
          secondary: 'rgb(var(--color-text-secondary) / <alpha-value>)',
          muted: 'rgb(var(--color-text-muted) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'rgb(var(--color-accent) / <alpha-value>)',
          hover: 'rgb(var(--color-accent-hover) / <alpha-value>)',
        },
        success: 'rgb(var(--color-success) / <alpha-value>)',
        danger: 'rgb(var(--color-danger) / <alpha-value>)',
        warn: 'rgb(var(--color-warn) / <alpha-value>)',
      },
      borderRadius: { sm: '6px', md: '8px', lg: '12px', xl: '16px', '2xl': '20px' },
      boxShadow: {
        glow: '0 6px 24px rgba(0,0,0,0.06)',
        card: '0 1px 3px rgba(15, 15, 15, 0.06)',
        'glow-red': '0 6px 24px rgba(255,59,48,0.25)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SF Mono', 'Menlo', 'monospace'],
      },
      keyframes: {
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        fadeInUp: 'fadeInUp 0.8s ease-out forwards',
      },
      fontSize: {
        h1: ['48px', { lineHeight: '1.1', letterSpacing: '-0.02em', fontWeight: '800' }],
        h2: ['32px', { lineHeight: '1.2', letterSpacing: '-0.01em', fontWeight: '700' }],
        h3: ['24px', { lineHeight: '1.3', fontWeight: '700' }],
        h4: ['18px', { lineHeight: '1.4', fontWeight: '700' }],
      },
    },
  },
  plugins: [],
} satisfies Config

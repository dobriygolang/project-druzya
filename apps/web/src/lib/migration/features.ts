import type { FeatureEntry, FeatureStatus } from './types'

/**
 * Single source of truth for migration progress.
 * Update status + MIGRATION.md when porting a page.
 */
export const FEATURES: FeatureEntry[] = [
  // ── Phase 1: Auth ─────────────────────────────────────────────────────
  {
    path: '/welcome',
    label: 'Welcome',
    area: 'auth',
    status: 'ready',
    backend: [],
    legacySource: 'src/pages/WelcomePage.tsx',
  },
  {
    path: '/login',
    label: 'Login',
    area: 'auth',
    status: 'ready',
    backend: [
      'POST /v1/auth/telegram',
      'GET /v1/auth/yandex/url',
      'POST /v1/auth/refresh',
    ],
    note: 'Legacy poll/start flows replaced by identity service contract',
    legacySource: 'src/pages/LoginPage.tsx',
  },
  {
    path: '/auth/callback',
    label: 'Yandex callback (exchange)',
    area: 'auth',
    status: 'ready',
    backend: ['POST /v1/auth/yandex/exchange'],
    note: 'Legacy route was /auth/callback/yandex with direct code POST',
    legacySource: 'src/pages/AuthCallbackYandexPage.tsx',
  },
  {
    path: '/legal/terms',
    label: 'Terms of service',
    area: 'auth',
    status: 'ready',
    backend: [],
    legacySource: 'src/pages/LegalTermsPage.tsx',
  },
  {
    path: '/legal/privacy',
    label: 'Privacy policy',
    area: 'auth',
    status: 'ready',
    backend: [],
    legacySource: 'src/pages/LegalPrivacyPage.tsx',
  },

  // ── Phase 2: Profile ──────────────────────────────────────────────────
  {
    path: '/profile',
    label: 'Profile (self)',
    area: 'profile',
    status: 'ready',
    backend: ['GET /v1/me', 'POST /v1/auth/logout'],
    legacySource: 'src/pages/ProfilePage.tsx',
  },
  {
    path: '/profile/:username',
    label: 'Public profile',
    area: 'profile',
    status: 'absent',
    backend: [],
    note: 'No public profile RPC in identity yet',
  },
  {
    path: '/profile/settings',
    label: 'Settings',
    area: 'profile',
    status: 'absent',
    backend: [],
    legacySource: 'src/pages/SettingsPage.tsx',
  },
  {
    path: '/profile/weekly',
    label: 'Weekly report',
    area: 'profile',
    status: 'absent',
    backend: [],
    legacySource: 'src/pages/weekly/WeeklyReportPage.tsx',
  },
  {
    path: '/profile/memory',
    label: 'AI memory audit',
    area: 'profile',
    status: 'absent',
    backend: [],
    legacySource: 'src/pages/MemoryPage.tsx',
  },

  // ── Phase 3: Mock / Interview ─────────────────────────────────────────
  {
    path: '/mock',
    label: 'Mock hub (company picker)',
    area: 'mock',
    status: 'ready',
    backend: [
      'GET /v1/companies',
      'GET /v1/interview-templates',
      'POST /v1/interview/sessions',
    ],
    legacySource: 'src/pages/mock/MockCompanyPicker.tsx',
  },
  {
    path: '/interview/session/:sessionId',
    label: 'Interview session',
    area: 'mock',
    status: 'ready',
    backend: [
      'GET /v1/interview/sessions/{id}/current',
      'POST /v1/interview/session-tasks/{id}/attempts',
      'POST /v1/sandbox/runs',
    ],
    legacySource: 'src/pages/MockSessionPage.tsx',
  },
  {
    path: '/interview/session/:sessionId/results',
    label: 'Session results',
    area: 'mock',
    status: 'ready',
    backend: ['GET /v1/interview/sessions/{id}/results'],
    legacySource: 'src/pages/MockResultPage.tsx',
  },
  {
    path: '/mock/pipeline/:pipelineId',
    label: 'Multi-stage mock pipeline',
    area: 'mock',
    status: 'stub',
    backend: [],
    note: 'Legacy multi-stage flow — backend not migrated',
    legacySource: 'src/pages/mock/MockPipelinePage.tsx',
  },
  {
    path: '/mock/replay/:attemptId',
    label: 'Attempt replay',
    area: 'mock',
    status: 'absent',
    backend: [],
    legacySource: 'src/pages/mock/MockReplayPage.tsx',
  },
  {
    path: '/mock/:sessionId',
    label: 'Legacy mock session URL',
    area: 'mock',
    status: 'ready',
    backend: [],
    note: 'Redirects to /interview/session/:sessionId',
  },

  // ── Phase 4: Rooms ────────────────────────────────────────────────────
  {
    path: '/live/:roomId',
    label: 'Live collab room',
    area: 'rooms',
    status: 'ready',
    backend: [
      'GET /v1/rooms/{id}',
      'POST /v1/rooms/{id}/join',
      'WS /ws/editor/{id}',
    ],
    legacySource: 'src/pages/editor/EditorPage.tsx',
  },
  {
    path: '/editor/:id',
    label: 'Solo editor (legacy)',
    area: 'rooms',
    status: 'stub',
    backend: [],
    note: 'Different persistence model — use /live when rooms API ready',
  },
  {
    path: '/whiteboard/:id',
    label: 'Whiteboard (legacy)',
    area: 'rooms',
    status: 'stub',
    backend: [],
  },

  // ── Phase 5: Billing ──────────────────────────────────────────────────
  {
    path: '/pricing',
    label: 'Pricing',
    area: 'billing',
    status: 'ready',
    backend: ['GET /v1/billing/me', 'GET /v1/billing/plans', 'POST /v1/billing/trial/start'],
    note: 'Plan catalog + trial + Tribute/Telegram checkout URLs',
    legacySource: 'src/pages/pricing/PricingPage.tsx',
  },
  {
    path: '/checkout',
    label: 'Checkout',
    area: 'billing',
    status: 'ready',
    backend: ['GET /v1/billing/plans'],
    note: 'Redirect to Tribute / Telegram checkout from plan catalog',
    legacySource: 'src/pages/checkout/CheckoutPage.tsx',
  },
  {
    path: '/billing/welcome',
    label: 'Post-checkout welcome',
    area: 'billing',
    status: 'ready',
    backend: ['GET /v1/billing/me'],
    note: 'Landing after external payment',
  },

  // ── Phase 6: Today ────────────────────────────────────────────────────
  {
    path: '/today',
    label: 'Today dashboard',
    area: 'today',
    status: 'ready',
    backend: [
      'GET /v1/me',
      'GET /v1/recommendations/dashboard',
      'POST /v1/recommendations/articles/{slug}/read',
      'GET /v1/interview/retry-items',
      'GET /v1/tracker/board',
    ],
    note: 'Structured daily_brief; weak skills link to /learn; read_article has Practice secondary action',
    legacySource: 'src/pages/TodayPage.tsx',
  },
  {
    path: '/learn',
    label: 'Knowledge-base catalog',
    area: 'today',
    status: 'ready',
    backend: ['GET /v1/articles?query=', 'GET /v1/recommendations/dashboard'],
    note: 'Search + domain filters; read badges from dashboard',
  },
  {
    path: '/learn/:slug',
    label: 'Knowledge-base article',
    area: 'today',
    status: 'ready',
    backend: ['GET /v1/articles/by-slug/{slug}', 'POST /v1/recommendations/articles/{slug}/read'],
    note: 'Markdown + videos + linked tasks + related articles + practice CTA',
    legacySource: 'src/pages/codex/CodexPage.tsx',
  },

  // ── Phase 7+: No backend yet ──────────────────────────────────────────
  {
    path: '/atlas',
    label: 'Atlas tracks',
    area: 'atlas',
    status: 'stub',
    backend: [],
    legacySource: 'src/pages/AtlasPage.tsx',
  },
  {
    path: '/atlas/explore',
    label: 'Atlas skill graph',
    area: 'atlas',
    status: 'stub',
    backend: [],
  },
  {
    path: '/insights',
    label: 'Insights',
    area: 'other',
    status: 'stub',
    backend: [],
    legacySource: 'src/pages/InsightsPage.tsx',
  },
  {
    path: '/tasks',
    label: 'Task board',
    area: 'other',
    status: 'ready',
    backend: [
      'GET /v1/tracker/board',
      'POST /v1/tracker/projects',
      'POST /v1/tracker/tasks',
    ],
  },
  {
    path: '/codex',
    label: 'Codex',
    area: 'other',
    status: 'stub',
    backend: [],
    legacySource: 'src/pages/CodexPage.tsx',
  },
  {
    path: '/lingua/*',
    label: 'Lingua vertical',
    area: 'lingua',
    status: 'stub',
    backend: [],
    legacySource: 'src/pages/LinguaShell.tsx',
  },
  {
    path: '/tutor/:tab',
    label: 'Tutor dashboard',
    area: 'tutor',
    status: 'stub',
    backend: [],
  },
  {
    path: '/circles',
    label: 'Circles',
    area: 'other',
    status: 'stub',
    backend: [],
  },
  {
    path: '/notifications',
    label: 'Notifications',
    area: 'other',
    status: 'stub',
    backend: [],
  },
  {
    path: '/admin',
    label: 'Admin',
    area: 'admin',
    status: 'ready',
    backend: [
      'GET /v1/admin/session',
      'GET /v1/admin/dashboard',
      'GET /v1/admin/content/companies',
      'POST /v1/admin/content/companies',
      'GET /v1/admin/content/tasks',
      'POST /v1/admin/content/tasks',
      'GET /v1/admin/content/interview-templates',
      'GET /v1/admin/content/interview-templates/{id}/detail',
      'POST /v1/admin/content/interview-templates',
      'POST /v1/admin/content/interview-templates/{template_id}/structure',
      'GET /v1/admin/billing/plans',
      'GET /v1/admin/billing/users/{user_id}/entitlements',
      'POST /v1/admin/billing/subscriptions/grant',
      'POST /v1/admin/billing/subscriptions/revoke',
      'GET /v1/admin/ai/evaluation-jobs',
      'GET /v1/admin/ai/llm/config',
      'PUT /v1/admin/ai/llm/config',
      'POST /v1/admin/ai/llm/probe',
    ],
    note: 'Operator allowlist via ADMIN_USER_IDS on admin BFF',
    legacySource: 'src/pages/AdminPage.tsx',
  },
  {
    path: '/onboarding',
    label: 'Onboarding',
    area: 'other',
    status: 'stub',
    backend: [],
    legacySource: 'src/pages/OnboardingPage.tsx',
  },
  {
    path: '/podcasts',
    label: 'Podcasts',
    area: 'other',
    status: 'stub',
    backend: [],
  },
  {
    path: '/status',
    label: 'Service status',
    area: 'other',
    status: 'stub',
    backend: [],
    legacySource: 'src/pages/StatusPage.tsx',
  },
]

export function getFeatureByPath(pathname: string): FeatureEntry | undefined {
  return FEATURES.find((f) => matchPath(f.path, pathname))
}

export function featuresByArea(): Map<string, FeatureEntry[]> {
  const map = new Map<string, FeatureEntry[]>()
  for (const f of FEATURES) {
    const list = map.get(f.area) ?? []
    list.push(f)
    map.set(f.area, list)
  }
  return map
}

export function featuresByStatus(status: FeatureStatus): FeatureEntry[] {
  return FEATURES.filter((f) => f.status === status)
}

export function isNavVisible(status: FeatureStatus): boolean {
  return status === 'ready' || status === 'partial'
}

/** Match react-router path patterns including :params and trailing * */
function matchPath(pattern: string, pathname: string): boolean {
  if (pattern.endsWith('/*')) {
    const base = pattern.slice(0, -2)
    return pathname === base || pathname.startsWith(`${base}/`)
  }
  const patternParts = pattern.split('/').filter(Boolean)
  const pathParts = pathname.split('/').filter(Boolean)
  if (patternParts.length !== pathParts.length) return false
  return patternParts.every((part, i) => part.startsWith(':') || part === pathParts[i])
}

export function migrationStats(): {
  total: number
  ready: number
  partial: number
  stub: number
  absent: number
  inProgress: number
} {
  const counts = { ready: 0, partial: 0, stub: 0, absent: 0, inProgress: 0 }
  for (const f of FEATURES) {
    if (f.status === 'ready') counts.ready++
    else if (f.status === 'partial') counts.partial++
    else if (f.status === 'stub') counts.stub++
    else if (f.status === 'absent') counts.absent++
    else if (f.status === 'in_progress') counts.inProgress++
  }
  return { total: FEATURES.length, ...counts }
}

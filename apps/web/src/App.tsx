import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { readAccessToken } from '@/lib/apiClient'
import { AppShell } from '@/components/AppShell'
import { RequireAuth } from '@/components/RequireAuth'
import { RouteLoader } from '@/components/RouteLoader'

const WelcomePage = lazy(() => import('@/pages/WelcomePage'))
const LoginPage = lazy(() => import('@/pages/LoginPage'))
const AuthCallbackPage = lazy(() => import('@/pages/AuthCallbackPage'))
const DashboardPage = lazy(() => import('@/pages/DashboardPage'))
const MockHubPage = lazy(() => import('@/pages/MockHubPage'))
const SessionPage = lazy(() => import('@/pages/SessionPage'))
const SessionResultsPage = lazy(() => import('@/pages/SessionResultsPage'))
const CollabRoomPage = lazy(() => import('@/pages/CollabRoomPage'))
const ProfilePage = lazy(() => import('@/pages/ProfilePage'))
const FeatureStubPage = lazy(() => import('@/pages/FeatureStubPage'))
const MigrationStatusPage = lazy(() => import('@/pages/MigrationStatusPage'))
const PricingPage = lazy(() => import('@/pages/PricingPage'))
const LegalTermsPage = lazy(() => import('@/pages/LegalTermsPage'))
const LegalPrivacyPage = lazy(() => import('@/pages/LegalPrivacyPage'))
const LegacyMockSessionRedirect = lazy(() =>
  import('@/pages/LegacyMockRedirects').then((m) => ({ default: m.LegacyMockSessionRedirect })),
)
const LegacyMockResultRedirect = lazy(() =>
  import('@/pages/LegacyMockRedirects').then((m) => ({ default: m.LegacyMockResultRedirect })),
)

function RootRedirect() {
  return <Navigate to={readAccessToken() ? '/today' : '/welcome'} replace />
}

function AuthedLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>
}

/** Legacy URLs → honest stub until backend + UI port (see MIGRATION.md) */
function AuthedStub() {
  return (
    <AuthedLayout>
      <FeatureStubPage />
    </AuthedLayout>
  )
}

export default function App() {
  return (
    <Suspense fallback={<RouteLoader />}>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/welcome" element={<WelcomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/live/:roomId" element={<CollabRoomPage />} />
        <Route path="/migration" element={<MigrationStatusPage />} />

        <Route path="/dashboard" element={<Navigate to="/today" replace />} />
        <Route path="/practice" element={<Navigate to="/mock" replace />} />
        <Route path="/interview" element={<Navigate to="/mock" replace />} />
        <Route path="/settings" element={<Navigate to="/profile" replace />} />
        <Route path="/weekly" element={<Navigate to="/profile" replace />} />

        <Route element={<RequireAuth />}>
          <Route
            path="/today"
            element={
              <AuthedLayout>
                <DashboardPage />
              </AuthedLayout>
            }
          />
          <Route
            path="/mock"
            element={
              <AuthedLayout>
                <MockHubPage />
              </AuthedLayout>
            }
          />
          <Route
            path="/interview/session/:sessionId"
            element={
              <AuthedLayout>
                <SessionPage />
              </AuthedLayout>
            }
          />
          <Route
            path="/interview/session/:sessionId/results"
            element={
              <AuthedLayout>
                <SessionResultsPage />
              </AuthedLayout>
            }
          />
          <Route
            path="/profile"
            element={
              <AuthedLayout>
                <ProfilePage />
              </AuthedLayout>
            }
          />

          {/* Stubs — registered so legacy bookmarks get FeatureUnavailable, not silent redirect */}
          <Route path="/mock/pipeline/:pipelineId" element={<AuthedStub />} />
          <Route path="/mock/pipeline/:pipelineId/debrief" element={<AuthedStub />} />
          <Route path="/mock/:sessionId/result" element={<LegacyMockResultRedirect />} />
          <Route path="/mock/:sessionId" element={<LegacyMockSessionRedirect />} />
          <Route path="/atlas" element={<AuthedStub />} />
          <Route path="/atlas/explore" element={<AuthedStub />} />
          <Route path="/insights" element={<AuthedStub />} />
          <Route path="/tasks" element={<AuthedStub />} />
          <Route path="/codex" element={<AuthedStub />} />
          <Route path="/lingua/*" element={<AuthedStub />} />
          <Route path="/tutor/:tab" element={<AuthedStub />} />
          <Route path="/circles" element={<AuthedStub />} />
          <Route path="/notifications" element={<AuthedStub />} />
          <Route path="/admin" element={<AuthedStub />} />
          <Route path="/onboarding" element={<AuthedStub />} />
          <Route path="/podcasts" element={<AuthedStub />} />
          <Route path="/editor/:id" element={<AuthedStub />} />
          <Route path="/whiteboard/:id" element={<AuthedStub />} />
        </Route>

        {/* Public pricing — plan catalog + billing/me when authed */}
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/legal/terms" element={<LegalTermsPage />} />
        <Route path="/legal/privacy" element={<LegalPrivacyPage />} />
        <Route path="/status" element={<FeatureStubPage />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}

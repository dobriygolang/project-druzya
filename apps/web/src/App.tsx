import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { readAccessToken } from '@/lib/apiClient'
import { AppShell } from '@/components/AppShell'
import { RequireAuth } from '@/components/RequireAuth'
import { RequireAdmin } from '@/components/RequireAdmin'
import { RouteLoader } from '@/components/RouteLoader'

const WelcomePage = lazy(() => import('@/pages/WelcomePage'))
const LoginPage = lazy(() => import('@/pages/LoginPage'))
const AuthCallbackPage = lazy(() => import('@/pages/AuthCallbackPage'))
const DashboardPage = lazy(() => import('@/pages/DashboardPage'))
const LearnIndexPage = lazy(() => import('@/pages/LearnIndexPage'))
const LearnArticlePage = lazy(() => import('@/pages/LearnArticlePage'))
const MockHubPage = lazy(() => import('@/pages/MockHubPage'))
const SessionPage = lazy(() => import('@/pages/SessionPage'))
const SessionResultsPage = lazy(() => import('@/pages/SessionResultsPage'))
const CollabRoomPage = lazy(() => import('@/pages/CollabRoomPage'))
const ProfilePage = lazy(() => import('@/pages/ProfilePage'))
const FeatureStubPage = lazy(() => import('@/pages/FeatureStubPage'))
const MigrationStatusPage = lazy(() => import('@/pages/MigrationStatusPage'))
const PricingPage = lazy(() => import('@/pages/PricingPage'))
const CheckoutPage = lazy(() => import('@/pages/CheckoutPage'))
const BillingWelcomePage = lazy(() => import('@/pages/BillingWelcomePage'))
const AdminLayout = lazy(() => import('@/pages/admin/AdminLayout'))
const AdminHomePage = lazy(() => import('@/pages/admin/AdminHomePage'))
const AdminCompaniesPage = lazy(() => import('@/pages/admin/AdminCompaniesPage'))
const AdminTasksPage = lazy(() => import('@/pages/admin/AdminTasksPage'))
const AdminTaskEditPage = lazy(() => import('@/pages/admin/AdminTaskEditPage'))
const AdminArticlesPage = lazy(() => import('@/pages/admin/AdminArticlesPage'))
const AdminArticleEditPage = lazy(() => import('@/pages/admin/AdminArticleEditPage'))
const AdminTemplatesPage = lazy(() => import('@/pages/admin/AdminTemplatesPage'))
const AdminTemplateDetailPage = lazy(() => import('@/pages/admin/AdminTemplateDetailPage'))
const AdminBillingPage = lazy(() => import('@/pages/admin/AdminBillingPage'))
const AdminAIPage = lazy(() => import('@/pages/admin/AdminAIPage'))
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
            path="/learn"
            element={
              <AuthedLayout>
                <LearnIndexPage />
              </AuthedLayout>
            }
          />
          <Route
            path="/learn/:slug"
            element={
              <AuthedLayout>
                <LearnArticlePage />
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
          <Route element={<RequireAdmin />}>
            <Route
              path="/admin"
              element={
                <AuthedLayout>
                  <AdminLayout />
                </AuthedLayout>
              }
            >
              <Route index element={<AdminHomePage />} />
              <Route path="companies" element={<AdminCompaniesPage />} />
              <Route path="tasks" element={<AdminTasksPage />} />
              <Route path="tasks/new/edit" element={<AdminTaskEditPage />} />
              <Route path="tasks/:slug/edit" element={<AdminTaskEditPage />} />
              <Route path="articles" element={<AdminArticlesPage />} />
              <Route path="articles/new" element={<AdminArticleEditPage />} />
              <Route path="articles/:slug/edit" element={<AdminArticleEditPage />} />
              <Route path="templates" element={<AdminTemplatesPage />} />
              <Route path="templates/:templateId" element={<AdminTemplateDetailPage />} />
              <Route path="billing" element={<AdminBillingPage />} />
              <Route path="ai" element={<AdminAIPage />} />
            </Route>
          </Route>
          <Route path="/onboarding" element={<AuthedStub />} />
          <Route path="/podcasts" element={<AuthedStub />} />
          <Route path="/editor/:id" element={<AuthedStub />} />
          <Route path="/whiteboard/:id" element={<AuthedStub />} />
        </Route>

        {/* Public pricing — plan catalog + billing/me when authed */}
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/checkout/:planSlug" element={<CheckoutPage />} />
        <Route path="/billing/welcome" element={<BillingWelcomePage />} />
        <Route path="/legal/terms" element={<LegalTermsPage />} />
        <Route path="/legal/privacy" element={<LegalPrivacyPage />} />
        <Route path="/status" element={<FeatureStubPage />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}

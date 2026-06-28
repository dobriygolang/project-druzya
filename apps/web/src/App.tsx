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
const InterviewStartPage = lazy(() => import('@/pages/InterviewStartPage'))
const SessionPage = lazy(() => import('@/pages/SessionPage'))
const SessionResultsPage = lazy(() => import('@/pages/SessionResultsPage'))
const CollabRoomPage = lazy(() => import('@/pages/CollabRoomPage'))
const ProfilePage = lazy(() => import('@/pages/ProfilePage'))

function RootRedirect() {
  return <Navigate to={readAccessToken() ? '/dashboard' : '/welcome'} replace />
}

function AuthedLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>
}

export default function App() {
  return (
    <Suspense fallback={<RouteLoader />}>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/welcome" element={<WelcomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />

        <Route element={<RequireAuth />}>
          <Route
            path="/dashboard"
            element={
              <AuthedLayout>
                <DashboardPage />
              </AuthedLayout>
            }
          />
          <Route
            path="/interview"
            element={
              <AuthedLayout>
                <InterviewStartPage />
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
            path="/live/:roomId"
            element={
              <AuthedLayout>
                <CollabRoomPage />
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
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}

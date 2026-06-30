import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { readAccessToken } from '@/lib/apiClient'
import { PublicPageShell } from '@/components/brand/PublicNav'
import { RequireAuth } from '@/components/RequireAuth'
import { RouteLoader } from '@/components/RouteLoader'

const WelcomePage = lazy(() => import('@/pages/WelcomePage'))
const LoginPage = lazy(() => import('@/pages/LoginPage'))
const AuthCallbackPage = lazy(() => import('@/pages/AuthCallbackPage'))
const CollabRoomPage = lazy(() => import('@/pages/CollabRoomPage'))
const ProfilePage = lazy(() => import('@/pages/ProfilePage'))
const PricingPage = lazy(() => import('@/pages/PricingPage'))
const CheckoutPage = lazy(() => import('@/pages/CheckoutPage'))
const BillingWelcomePage = lazy(() => import('@/pages/BillingWelcomePage'))
const LegalTermsPage = lazy(() => import('@/pages/LegalTermsPage'))
const LegalPrivacyPage = lazy(() => import('@/pages/LegalPrivacyPage'))

function RootRedirect() {
  return <Navigate to={readAccessToken() ? '/profile' : '/welcome'} replace />
}

function AuthedLayout({ children }: { children: React.ReactNode }) {
  return <PublicPageShell>{children}</PublicPageShell>
}

function RetiredRedirect() {
  return <Navigate to="/welcome" replace />
}

export default function App() {
  return (
    <Suspense fallback={<RouteLoader />}>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/welcome" element={<WelcomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/live/new" element={<CollabRoomPage />} />
        <Route path="/live/:roomId" element={<CollabRoomPage />} />

        <Route path="/today" element={<RetiredRedirect />} />
        <Route path="/dashboard" element={<RetiredRedirect />} />
        <Route path="/learn/*" element={<RetiredRedirect />} />
        <Route path="/mock/*" element={<RetiredRedirect />} />
        <Route path="/interview/*" element={<RetiredRedirect />} />
        <Route path="/tasks" element={<RetiredRedirect />} />
        <Route path="/admin/*" element={<RetiredRedirect />} />

        <Route element={<RequireAuth />}>
          <Route
            path="/profile"
            element={
              <AuthedLayout>
                <ProfilePage />
              </AuthedLayout>
            }
          />
          <Route path="/settings" element={<Navigate to="/profile" replace />} />
        </Route>

        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/checkout/:planSlug" element={<CheckoutPage />} />
        <Route path="/billing/welcome" element={<BillingWelcomePage />} />
        <Route path="/legal/terms" element={<LegalTermsPage />} />
        <Route path="/legal/privacy" element={<LegalPrivacyPage />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}

import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes, useParams } from 'react-router-dom'
import { RouteLoader } from '@/components/RouteLoader'

const WelcomePage = lazy(() => import('@/pages/WelcomePage'))
const PublishedNotePage = lazy(() => import('@/pages/PublishedNotePage'))
const PublishedBoardPage = lazy(() => import('@/pages/PublishedBoardPage'))
const CollabRoomPage = lazy(() => import('@/pages/CollabRoomPage'))
const LiveNewPage = lazy(() => import('@/components/live/LiveNewPage').then((m) => ({ default: m.LiveNewPage })))
const PricingPage = lazy(() => import('@/pages/PricingPage'))
const LegalTermsPage = lazy(() => import('@/pages/LegalTermsPage'))
const LegalPrivacyPage = lazy(() => import('@/pages/LegalPrivacyPage'))
const HoneDownloadPage = lazy(() => import('@/pages/HoneDownloadPage'))

function RetiredRedirect() {
  return <Navigate to="/welcome" replace />
}

function LegacyNoteSlugRedirect() {
  const { slug } = useParams<{ slug: string }>()
  return <Navigate to={`/notes/${slug ?? ''}`} replace />
}

export default function App() {
  return (
    <Suspense fallback={<RouteLoader />}>
      <Routes>
        <Route path="/" element={<Navigate to="/welcome" replace />} />
        <Route path="/welcome" element={<WelcomePage />} />
        <Route path="/download" element={<HoneDownloadPage />} />
        <Route path="/notes/:slug" element={<PublishedNotePage />} />
        <Route path="/board/:slug" element={<PublishedBoardPage />} />
        <Route path="/n/:slug" element={<LegacyNoteSlugRedirect />} />
        <Route path="/live/new" element={<LiveNewPage />} />
        <Route path="/live/:roomId" element={<CollabRoomPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/legal/terms" element={<LegalTermsPage />} />
        <Route path="/legal/privacy" element={<LegalPrivacyPage />} />

        <Route path="/login" element={<RetiredRedirect />} />
        <Route path="/auth/callback" element={<RetiredRedirect />} />
        <Route path="/profile" element={<RetiredRedirect />} />
        <Route path="/settings" element={<RetiredRedirect />} />
        <Route path="/checkout" element={<Navigate to="/pricing" replace />} />
        <Route path="/checkout/:planSlug" element={<Navigate to="/pricing" replace />} />
        <Route path="/billing/welcome" element={<Navigate to="/pricing" replace />} />

        <Route path="/today" element={<RetiredRedirect />} />
        <Route path="/dashboard" element={<RetiredRedirect />} />
        <Route path="/learn/*" element={<RetiredRedirect />} />
        <Route path="/mock/*" element={<RetiredRedirect />} />
        <Route path="/interview/*" element={<RetiredRedirect />} />
        <Route path="/tasks" element={<RetiredRedirect />} />
        <Route path="/admin/*" element={<RetiredRedirect />} />

        <Route path="*" element={<Navigate to="/welcome" replace />} />
      </Routes>
    </Suspense>
  )
}

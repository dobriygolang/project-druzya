import { Navigate, useParams } from 'react-router-dom'

/** Legacy bookmark: /mock/:sessionId → /interview/session/:sessionId */
export function LegacyMockSessionRedirect() {
  const { sessionId = '' } = useParams()
  return <Navigate to={`/interview/session/${sessionId}`} replace />
}

/** Legacy bookmark: /mock/:sessionId/result → results */
export function LegacyMockResultRedirect() {
  const { sessionId = '' } = useParams()
  return <Navigate to={`/interview/session/${sessionId}/results`} replace />
}

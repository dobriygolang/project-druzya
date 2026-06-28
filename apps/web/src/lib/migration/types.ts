/** Route/feature readiness for legacy → microservices migration. */
export type FeatureStatus =
  | 'ready' /** Fully wired to backend, no fake data */
  | 'partial' /** Some sections live, others stubbed/hidden */
  | 'in_progress' /** Active migration — do not ship to prod nav */
  | 'stub' /** Route registered, FeatureUnavailable shown */
  | 'absent' /** Not in router yet */
  | 'deprecated' /** Intentionally removed */

export type FeatureArea =
  | 'auth'
  | 'profile'
  | 'mock'
  | 'rooms'
  | 'billing'
  | 'today'
  | 'atlas'
  | 'lingua'
  | 'tutor'
  | 'admin'
  | 'other'

export type FeatureEntry = {
  /** URL pattern as registered in react-router (may include :params) */
  path: string
  label: string
  area: FeatureArea
  status: FeatureStatus
  /** gRPC-gateway / custom HTTP paths this page needs (empty = static) */
  backend: string[]
  /** Human note for migration dashboard */
  note?: string
  /** Legacy source file under druzya/frontend (copy UI from here) */
  legacySource?: string
}

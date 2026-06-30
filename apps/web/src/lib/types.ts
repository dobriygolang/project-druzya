export interface User {
  id: string
  username: string
  avatar_url?: string
  created_at?: string
  telegram_id?: string
  timezone?: string
}

export interface AuthResponse {
  access_token: string
  refresh_token: string
  user: User
}

export interface BillingMe {
  user_id: string
  plan_slug: string
  plan_name: string
  features: Record<string, boolean>
  limits: Record<
    string,
    {
      used: number
      limit?: number
      remaining?: number
      unlimited?: boolean
    }
  >
  is_trialing?: boolean
  trial_end?: string
  trial_available?: boolean
  trial_days?: number
}

export interface PlanEntitlementSpec {
  type: string
  limit?: number
  unlimited?: boolean
  period?: string
  value?: boolean
}

export interface PlanCatalogEntry {
  slug: string
  name: string
  tagline: string
  highlight?: boolean
  highlights: string[]
  features?: Record<string, boolean>
  limits?: Record<string, PlanEntitlementSpec>
  checkout_url?: string
  telegram_checkout_url?: string
  trial_days?: number
}

export interface TestResult {
  name: string
  status: string
  stdout?: string
  stderr?: string
  expected_output?: string
  actual_output?: string
  time_ms?: number
  error?: string
}

export interface CodeRun {
  id: string
  user_id: string
  language: string
  status: string
  run_type: string
  stdout?: string
  stderr?: string
  compile_output?: string
  error?: string
  exit_code?: number
  time_ms?: number
  memory_kb?: number
  tests_total: number
  tests_passed: number
  test_results: TestResult[]
  runner?: string
  created_at?: string
  updated_at?: string
}

export interface User {
  id: string
  username: string
  avatar_url?: string
  created_at?: string
  telegram_id?: string
}

export interface AuthResponse {
  access_token: string
  refresh_token: string
  user: User
}

export interface Company {
  id: string
  slug: string
  name: string
  description?: string
  is_active: boolean
}

export interface InterviewTemplate {
  id: string
  company_id?: string
  slug: string
  title: string
  description?: string
  target_role?: string
  target_level?: string
  passing_score: number
  is_active: boolean
}

export interface TemplateSection {
  id: string
  section_type: string
  title: string
  description?: string
  position: number
  passing_score?: number
  tasks_count: number
}

export interface Task {
  id: string
  slug: string
  type: string
  title: string
  description: string
  difficulty: string
  estimated_minutes?: number
  metadata?: Record<string, unknown>
  status: string
}

export type SessionMode =
  | 'SESSION_MODE_UNSPECIFIED'
  | 'SESSION_MODE_COMPANY_INTERVIEW'
  | 'SESSION_MODE_ALGORITHMS_TRAINING'
  | 'SESSION_MODE_LIVE_CODING_TRAINING'
  | 'SESSION_MODE_SYSTEM_DESIGN_TRAINING'
  | 'SESSION_MODE_BEHAVIORAL_TRAINING'
  | 'SESSION_MODE_SQL_TRAINING'
  | 'SESSION_MODE_RETRY_MISTAKES'

export type SessionStatus =
  | 'SESSION_STATUS_UNSPECIFIED'
  | 'SESSION_STATUS_ACTIVE'
  | 'SESSION_STATUS_COMPLETED'
  | 'SESSION_STATUS_CANCELLED'
  | 'SESSION_STATUS_EXPIRED'

export type AttemptStatus =
  | 'ATTEMPT_STATUS_UNSPECIFIED'
  | 'ATTEMPT_STATUS_SUBMITTED'
  | 'ATTEMPT_STATUS_EVALUATING'
  | 'ATTEMPT_STATUS_EVALUATED'
  | 'ATTEMPT_STATUS_FAILED'
  | 'ATTEMPT_STATUS_CANCELLED'

export interface Session {
  id: string
  user_id: string
  template_id?: string
  mode: SessionMode
  status: SessionStatus
  started_at?: string
  completed_at?: string
  passing_score: number
  total_score?: string
}

export interface SessionSection {
  id: string
  session_id: string
  section_type: string
  title: string
  position: number
  status: string
  passing_score?: number
  score?: string
}

export interface SessionTask {
  id: string
  session_id: string
  section_id: string
  task_id: string
  task_title?: string
  task_type?: string
  position: number
  status: string
}

export interface Progress {
  total_tasks: number
  evaluated_tasks: number
  skipped_tasks: number
  total_sections: number
  done_sections: number
}

export interface Attempt {
  id: string
  user_id: string
  session_task_id: string
  task_id: string
  answer_text?: string
  code?: string
  language?: string
  status: AttemptStatus
  submitted_at?: string
}

export interface EvaluationSummary {
  id: string
  attempt_id: string
  score: string
  passed: boolean
  summary?: string
  feedback?: Record<string, unknown>
}

export interface EvaluationResult {
  summary: EvaluationSummary
  attempt: Attempt
  task_id: string
}

export interface RetryItem {
  id: string
  task_id: string
  source_attempt_id: string
  session_id?: string
  reason?: string
  status: string
}

export interface SkillInsight {
  skill_key: string
  score: number
  confidence: number
}

export type RecommendationType =
  | 'RECOMMENDATION_TYPE_UNSPECIFIED'
  | 'RECOMMENDATION_TYPE_IMPROVE_SKILL'
  | 'RECOMMENDATION_TYPE_REWRITE_ANSWER'
  | 'RECOMMENDATION_TYPE_PRACTICE_SECTION'
  | 'RECOMMENDATION_TYPE_TAKE_MOCK_INTERVIEW'

export type RecommendationPriority =
  | 'RECOMMENDATION_PRIORITY_UNSPECIFIED'
  | 'RECOMMENDATION_PRIORITY_HIGH'
  | 'RECOMMENDATION_PRIORITY_MEDIUM'
  | 'RECOMMENDATION_PRIORITY_LOW'

export type RecommendationStatus =
  | 'RECOMMENDATION_STATUS_UNSPECIFIED'
  | 'RECOMMENDATION_STATUS_ACTIVE'
  | 'RECOMMENDATION_STATUS_DISMISSED'
  | 'RECOMMENDATION_STATUS_COMPLETED'

export type LearningPlanItemType =
  | 'LEARNING_PLAN_ITEM_TYPE_UNSPECIFIED'
  | 'LEARNING_PLAN_ITEM_TYPE_RETRY_TASK'

export type LearningPlanItemStatus =
  | 'LEARNING_PLAN_ITEM_STATUS_UNSPECIFIED'
  | 'LEARNING_PLAN_ITEM_STATUS_PENDING'
  | 'LEARNING_PLAN_ITEM_STATUS_IN_PROGRESS'
  | 'LEARNING_PLAN_ITEM_STATUS_COMPLETED'
  | 'LEARNING_PLAN_ITEM_STATUS_DISMISSED'

export type DailyBriefItemType =
  | 'DAILY_BRIEF_ITEM_TYPE_UNSPECIFIED'
  | 'DAILY_BRIEF_ITEM_TYPE_RETRY_TASK'
  | 'DAILY_BRIEF_ITEM_TYPE_WEAK_SKILL'
  | 'DAILY_BRIEF_ITEM_TYPE_RECOMMENDATION'
  | 'DAILY_BRIEF_ITEM_TYPE_TAKE_MOCK'
  | 'DAILY_BRIEF_ITEM_TYPE_START_MOCK'
  | 'DAILY_BRIEF_ITEM_TYPE_READ_ARTICLE'

export type ArticleStatus =
  | 'ARTICLE_STATUS_UNSPECIFIED'
  | 'ARTICLE_STATUS_DRAFT'
  | 'ARTICLE_STATUS_PUBLISHED'
  | 'ARTICLE_STATUS_ARCHIVED'

export type ArticleVideoProvider =
  | 'ARTICLE_VIDEO_PROVIDER_UNSPECIFIED'
  | 'ARTICLE_VIDEO_PROVIDER_YOUTUBE'
  | 'ARTICLE_VIDEO_PROVIDER_VIMEO'
  | 'ARTICLE_VIDEO_PROVIDER_OTHER'

export interface ArticleVideo {
  title: string
  url: string
  provider: ArticleVideoProvider
  position: number
  duration_seconds?: number
}

export interface ArticleTaskLink {
  task_id: string
  slug: string
  title: string
  type: string
  difficulty: string
  position: number
}

export interface Article {
  id: string
  slug: string
  title: string
  summary: string
  body: string
  status: ArticleStatus
  reading_minutes?: number
  skill_keys?: string[]
  videos?: ArticleVideo[]
  linked_tasks?: ArticleTaskLink[]
}

export interface ArticleSummary {
  id: string
  slug: string
  title: string
  summary: string
  status: ArticleStatus
  reading_minutes?: number
  skill_keys?: string[]
}

export interface Recommendation {
  id: string
  type: RecommendationType
  priority: RecommendationPriority
  skill_key?: string
  title: string
  description: string
  status: RecommendationStatus
  created_at?: string
}

export interface LearningPlanItem {
  id: string
  type: LearningPlanItemType
  task_id?: string
  skill_key?: string
  title: string
  description?: string
  status: LearningPlanItemStatus
}

export interface DailyBriefItem {
  type: DailyBriefItemType
  title: string
  description?: string
  action_label?: string
  action_path?: string
  retry_item_id?: string
  skill_key?: string
  secondary_action_label?: string
  secondary_action_path?: string
}

export interface DailyBrief {
  readiness_score: number
  items: DailyBriefItem[]
}

export interface Dashboard {
  readiness_score: number
  strengths: SkillInsight[]
  weaknesses: SkillInsight[]
  recommendations: Recommendation[]
  learning_plan: LearningPlanItem[]
  pending_retry_count: number
  daily_brief?: DailyBrief
  read_article_slugs?: string[]
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
  task_id?: string
  session_task_id?: string
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

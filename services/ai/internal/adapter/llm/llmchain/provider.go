// Package llmchain — provider-agnostic LLM routing with automatic fallback.
//
// Motivation: running everything through OpenRouter's :free lane ate 50 req/day
// and 30 RPM, which is too tight for more than one active user. Groq's free
// tier is 14.4k/day on the same OpenAI-compatible wire format, Cerebras is
// similar, and we already have OpenRouter for edge cases. Rather than pick
// one, we chain them: primary → secondary → tertiary with per-(provider,model)
// circuit-breakers and proactive rate-limit tracking via the providers' own
// response headers (x-ratelimit-remaining-*).
//
// Design decisions and the failure modes they target (see also
// ../../../../README_LLMCHAIN.md or the PR description):
//
//   - Task-based model selection, not provider-based. Callers pass a Task
//     (InsightProse / CopilotStream / Reasoning); the chain picks the
//     optimal model for that task on each provider — one less config
//     error per integration.
//
//   - Per-(provider,model) circuit state. If Groq's 70B is rate-limited but
//     the 8B is free, we only cool the 70B. Cross-user; the rate limit lives
//     on our API key, not the user's.
//
//   - Proactive cooling from response headers. Groq/Cerebras emit
//     x-ratelimit-remaining-requests + x-ratelimit-reset-requests on every
//     response. When remaining drops ≤ 2, we pre-emptively cool that
//     (provider,model) until the reset timestamp — saves one rejected
//     request on every failure boundary.
//
//   - No mid-stream fallback. Once the first SSE chunk arrives the response
//     is committed: a provider dying mid-stream propagates an error to the
//     caller rather than appending Cerebras's continuation to Groq's prefix.
//     The alternative (buffer-and-commit) adds latency we can't afford for
//     a streaming UI.
//
//   - Error-class-aware retry. 429/5xx → next provider. 401 → alert +
//     cooldown 1h (config issue, retry won't help). 400/403 → return
//     immediately (same input will fail identically everywhere). This is
//     cheaper than a flat "3 retries any error".
//
// Wire format: every provider we integrate (Groq, Cerebras, Mistral,
// OpenRouter) speaks OpenAI-compatible chat-completions, so the Driver
// interface matches that shape 1:1. If we ever add a non-OpenAI provider
// (Anthropic direct, Bedrock) we'll add a translation layer INSIDE the
// driver — Driver's public signature should not grow a second dialect.
package llmchain

import (
	"context"
	"time"
)

// Provider is the stable id of one upstream. Used as a label in metrics,
// logs, and the llm_models.provider_id column. Adding a new provider
// means: add the constant, write a Driver, register it in the wirer.
type Provider string

const (
	ProviderGroq       Provider = "groq"
	ProviderCerebras   Provider = "cerebras"
	ProviderMistral    Provider = "mistral"
	ProviderOpenRouter Provider = "openrouter"
	ProviderGoogle     Provider = "google"
	ProviderCloudflare Provider = "cloudflare"
	ProviderZAI        Provider = "zai"
	// ProviderDeepSeek — paid: api.deepseek.com. Используется в virtual-chain'ах
	// druz9/pro (см. tier.go). В DefaultTaskModelMap
	// отсутствует — это exclusive для paid-tier'ов.
	ProviderDeepSeek Provider = "deepseek"
	// ProviderOllama — self-hosted floor-fallback (Qwen 2.5 3B на CPU).
	// Активируется только если оператор задал OLLAMA_HOST и положил
	// "ollama" в LLM_CHAIN_ORDER. Медленно, но без квот.
	ProviderOllama Provider = "ollama"
)

// Task identifies a semantic workload class. Each task has its own
// per-provider optimal model in TaskModelMap (see task_map.go). The
// motivation is that "pick Groq" is the wrong abstraction: for
// strict-JSON extraction Groq's llama-3.1-8b-instant is the right call
// (fastest, reliable JSON), but for coaching prose we want the 70B.
// Callers think in tasks; only the chain knows models.
type Task string

const (
	// TaskInsightProse — long-form Russian coaching text from aggregated
	// weekly stats. Quality-sensitive; prefers 70B-class models.
	TaskInsightProse Task = "insight_prose"
	// TaskCopilotStream — interactive SSE chat for the macOS copilot.
	// Quality + streaming; prefers 70B-class models.
	TaskCopilotStream Task = "copilot_stream"
	// TaskReasoning — session analyzer + any other "give me a structured
	// analysis" caller. Quality-heavy; mirrors copilot for now.
	TaskReasoning Task = "reasoning"
	// TaskCodingHint — короткий намёк юзеру который молчит >2 мин в
	// mock-интервью. Small model, low latency: первый байт должен
	// прилететь за ~секунду, иначе намёк опоздал и ломает флоу.
	TaskCodingHint Task = "coding_hint"
	// TaskCodeReview — разбор пользовательского сабмита после mock.
	// Reasoning-heavy; длинный вывод с цитированием кода. Предпочитаем
	// DeepSeek-R1 / llama-70b — скорость не критична, глубина важна.
	TaskCodeReview Task = "code_review"
	// TaskSysDesignCritique — критика архитектурной диаграммы в system-
	// design треке. Quality > speed; требует длинного контекста (чтобы
	// уместить диаграмму + требования), Qwen2.5-72B sweet spot.
	TaskSysDesignCritique Task = "sysdesign_critique"
	// TaskSummarize — суммаризация для background-summarizer.
	// Самая дешёвая модель из доступных: стоимость токенов важнее
	// качества, summary потом может быть перечитан моделью посильнее.
	TaskSummarize Task = "summarize"
	// TaskDailyPlanSynthesis — синтез плана дня для Hone desktop-кокпита.
	// Вход: Skill Atlas gaps + сегодняшний календарь + последние PR/сессии.
	// Выход: 3-4 PlanItem'а с заголовком, subtitle-причиной, deep-link'ом.
	// Reasoning-heavy (нужно взвесить приоритеты), но НЕ streaming — клиент
	// ждёт целого JSON-ответа и рендерит карточки атомарно. 70B-класс.
	TaskDailyPlanSynthesis Task = "daily_plan_synthesis"
	// TaskDailyBrief — синтез утреннего брифа AI-coach слоя. Вход:
	// focus-stats 7d + skipped/completed plan-item'ы + последние reflection'ы
	// + top-5 нот по recency. Выход: strict JSON {headline, narrative,
	// recommendations[3]}. Reasoning + JSON — 70B-класс. Кэшируется на 6h
	// в hone_daily_briefs, force=true — rate-limited 1/h.
	TaskDailyBrief Task = "daily_brief"
	// TaskNoteQA — RAG над корпусом нот. Вход: вопрос юзера + top-8
	// embedded-нот (title + body). Выход: markdown ответ с [N]-цитациями.
	// Text mode (не JSON). 70B для глубины reasoning'а.
	TaskNoteQA Task = "note_qa"
	// TaskVision — multimodal требует vision-capable модели. Используется
	// mock-interview sysdesign-judge'ем для оценки excalidraw-диаграмм.
	// Free-tier: qwen/qwen-2.5-vl-72b-instruct:free через OpenRouter — лучшая
	// open-source vision-модель в :free-каталоге сейчас (2026-Q2). Turbo-chain
	// (Groq/Cerebras/Mistral llama-3.x) text-only на драйверном уровне.
	// Drivers без supportsVision возвращают ErrModelNotSupported и chain
	// переходит дальше. Premium-уровни — claude-sonnet-4.5 / gpt-4o через
	// druz9/pro ModelOverride. См task_map.go::TaskVision для актуального
	// списка alternatives.
	TaskVision Task = "vision"
	// TaskEnglishMockHR — AI-собеседующий проводит HR-этап на английском,
	// оценивает clarity / accuracy / range / fluency. Reasoning +
	// streaming, 70B-class — качество прозы важно (плохая модель плодит
	// canned ESL phrases вместо real HR pushback). Rubric и system-prompt
	// живут в services/ai_mock/infra/llm.go рядом с уже существующими
	// mock-prompt'ами.
	TaskEnglishMockHR Task = "english_mock_hr"
	// TaskSystemDesignSeniorMock — free-form senior/staff-level SD
	// interview: AI pushes back on
	// architectural choices, probes failure modes, demands tradeoff
	// articulation. NOT the same as TaskSysDesignCritique — that one
	// grades a specific diagram; this one runs a multi-turn dialogue.
	// Reasoning-heavy + long context (multi-turn architectural drift),
	// 70B-class minimum.
	TaskSystemDesignSeniorMock Task = "system_design_senior_mock"
	// TaskTechLeadMock — behavioral STAR-style mock at Tech Lead / EM
	// level. AI plays a hiring panel,
	// adapts questions to answers, scores STAR structure + ownership +
	// impact + learning. 70B-class — narrative quality of the prompt
	// matters; small models bleed into "good for you!" affirmation
	// instead of probing for accountability.
	TaskTechLeadMock Task = "tech_lead_mock"
	// TaskTutorPreSessionBrief — tutor requests a 1-page summary of a
	// student's last week of activity
	// before a tutoring session. Reasoning + concise prose, 70B-class.
	// Output is markdown text (NOT JSON) — the tutor reads it directly,
	// no downstream parser. Brief MUST avoid revealing AI-coach private
	// content (note bodies, exact mock answers); only aggregates and
	// labels are safe to surface.
	TaskTutorPreSessionBrief Task = "tutor_pre_session_brief"
	// TaskHoneSummaryGrade — after the user finishes a Reading-chapter
	// and submits their summary,
	// the grader compares it to the chapter body and returns a single
	// integer 0..100 measuring coverage + accuracy + non-fabrication.
	// Output is strict JSON (`{"score":N,"feedback":"..."}`) — small
	// surface, latency matters (user is staring at a "scoring..." spinner),
	// so we run a 7B-class model. The 70B fallback only kicks in when
	// the small model fails twice in a row.
	TaskHoneSummaryGrade Task = "hone_summary_grade"
	// TaskHoneWritingFeedback — user wrote a paragraph / short essay in
	// English; we want a list of
	// concrete issues with category (grammar / vocab / style), the exact
	// excerpt, and a suggested fix. Strict JSON envelope so the frontend
	// can render structured annotations rather than a free-form blob.
	// Same latency tier as summary grader — user is waiting in front of
	// a textarea — so 8B-class with 70B fallback.
	TaskHoneWritingFeedback Task = "hone_writing_feedback"
	// TaskSysanalystMock — free-form interview round для системного
	// аналитика. Same in-session-prompt → on-end-grader split as TaskTechLeadMock /
	// TaskEnglishMockHR. AI plays a senior interviewer, picks 4-5 scenarios
	// across requirements engineering / modeling / integration / data /
	// process axes, adapts follow-ups. Reasoning-heavy round (data design,
	// API contract critique) — 70B-class.
	TaskSysanalystMock Task = "sysanalyst_mock"
	// TaskProductAnalystMock — product analyst track interview.
	// Metrics-heavy thinking (DAU/retention/funnel/A/B/CUPED) + SQL-on-the-board
	// + prioritisation framework reasoning. Same 70B-class as Sysanalyst.
	TaskProductAnalystMock Task = "product_analyst_mock"
	// TaskQAMock — QA / тестировщик free-form interview round.
	// Reasoning-heavy on edge cases (boundary / equivalence / decision-table),
	// API contracts, root-cause analysis. 70B-class same as other free-form
	// tracks.
	TaskQAMock Task = "qa_mock"
	// TaskDevOpsMock — DevOps / SRE free-form round. Reasoning
	// on infra tradeoffs (k8s vs ECS, push vs pull metrics, CI/CD topology),
	// incident response runbooks. 70B-class.
	TaskDevOpsMock Task = "devops_mock"
	// TaskMLEngMock — ML engineering free-form round.
	// Reasoning-heavy on math (loss/regularisation/architecture choice),
	// distinguishing memorised от understood, plus production awareness
	// (latency budgets, retraining, observability). 70B-class.
	TaskMLEngMock Task = "ml_eng_mock"
	// TaskHoneCodeReviewGrade — code-review-coaching. User pastes a
	// unified diff + writes
	// their PR-style review; we grade the review against the diff and
	// surface concrete issues across correctness / completeness /
	// clarity / tone. The diff itself goes into the prompt — we don't
	// extract per-hunk metadata, the LLM reads the patch directly.
	// Larger context window than other tasks (a 500-line diff is
	// already ~15KB), so we lean on 70B-class providers for deeper
	// reasoning rather than the 8B tier used by writing feedback.
	TaskHoneCodeReviewGrade Task = "hone_code_review_grade"
	// TaskHoneSpeakingGrade — shadowing-exercise pronunciation grading.
	// Compare Whisper STT transcript to reference
	// prompt, return pronunciation + fluency scores + word-level diff +
	// 1-line coach feedback. Mostly token alignment + heuristics — 8B-class
	// is sufficient; same model tier as writing feedback. Latency-sensitive
	// (UI пользователя ждёт после Stop recording).
	TaskHoneSpeakingGrade Task = "hone_speaking_grade"
	// TaskHoneNoteActionExtract — Coach reads matched
	// excerpts from notes (regex pre-filter) и формулирует короткий
	// actionable title для каждого реального action item. Skips: voprosy
	// к себе, упоминания без action, завершённые чекбоксы. Output: strict
	// JSON {suggestions: [{title, source_note_id, source_excerpt}]}.
	// 8B-class: classification + 5-word title formulation, не reasoning.
	// Latency-sensitive (юзер открывает suggestions panel и ждёт).
	TaskHoneNoteActionExtract Task = "hone_note_action_extract"
	// TaskAITutorChat — main chat-call для AI-тутора (см
	// docs/feature/ai-tutor.md). 4-layer memory собирается на каждый ход,
	// LLM возвращает свободный текст. 70B-class для качества рассуждений
	// на русском (Groq Llama 3 70B → Cerebras Llama 3.1 → Mistral Large
	// fallback chain).
	TaskAITutorChat Task = "ai_tutor_chat"
	// TaskAITutorCompact — periodic compaction (см entity.go
	// CompactionMessageThreshold/TokenThreshold). Берёт N recent episodes
	// + старый summary, возвращает (1) новый summary 3-5 bullets,
	// (2) до 3 fact-кандидатов в JSON. Можно меньшую модель — 8B
	// достаточно, summarisation дешёвая.
	TaskAITutorCompact Task = "ai_tutor_compact"
	// TaskAITutorAssignment — cron-driven daily assignment generation.
	// Reads snapshot + facts, авторит 1 assignment в structured JSON.
	TaskAITutorAssignment Task = "ai_tutor_assignment"

	// TaskCustomPathGenerate — onboarding wizard «Свой путь». Юзер
	// описал goal в свободной форме («Senior Go в финтех»); LLM
	// генерит initial карту тем (8-15 nodes) с group-classification.
	// Strict JSON output. См services/profile/app/generate_custom_path.go.
	TaskCustomPathGenerate Task = "custom_path_generate"

	// TaskAtlasClassify — user-driven atlas. Юзер пишет TODO
	// («изучить транзакции в Postgres»); LLM classifies в один из
	// existing curated nodes ИЛИ предлагает новый node (section + cluster
	// + suggested title). Strict JSON output, 8B-class достаточно.
	TaskAtlasClassify Task = "atlas_classify"

	// TaskCurateResource — learning-companion curation.
	// Per-atlas-node генерация 3-5 best free external ресурсов
	// (Strang/mlcourse/DDIA/Kaggle/etc.) с why-обоснованием. Output:
	// strict JSON-массив curation.Resource. Background-задача (CLI run,
	// не user-blocking), но 70B чтобы порядок и why были осмысленные.
	// Кэшируется per-(node_id, kind) — Sergey ревьюит результат, повтор
	// зовётся редко.
	TaskCurateResource Task = "curate_resource"

	// TaskAssistantNextAction — Coach hero «one daily action».
	// Input: learning_state + recent mocks + recent resource log + atlas
	// progress. Output: structured JSON {action_kind, target, rationale,
	// estimated_minutes}. User-blocking (coach hero), но 1/day per user
	// cached till midnight — quality > latency.
	TaskAssistantNextAction Task = "assistant_next_action"

	// TaskAssistantForkAnalysis — weekly cron + on-demand override.
	// Input: branch scores (MLE vs DE mocks), voluntary deep-dives count,
	// time spent. Output: {lean_branch, confidence 0..1, severity, signals[]}.
	// Background-задача, 70B для качества.
	TaskAssistantForkAnalysis Task = "assistant_fork_analysis"

	// TaskAssistantRereroll — dismiss-flow. Когда юзер dismiss'ит
	// "next action", LLM генерит alternative action из тех же signals.
	// Latency-sensitive (UI ждёт), 8B-class достаточно.
	TaskAssistantRereroll Task = "assistant_rereroll"

	// TaskNotesLinkSuggest — AI-link suggestions для Notes UI.
	// Embed-based candidate retrieval + LLM rerank. Output: massif
	// {target_note_id, score, reason}. Cached per (note_id, candidate-hash).
	TaskNotesLinkSuggest Task = "notes_link_suggest"

	// TaskTaskboardCategorise — TaskBoard auto-place. New task
	// → AI выбирает column (today/week/backlog) + tag по deadline + kind.
	// Latency-sensitive, 8B-class.
	TaskTaskboardCategorise Task = "taskboard_categorise"

	// TaskTrackerClassify — tracker smart-parse: classify free-text task title
	// into kind + metadata + optional epic hint. Strict JSON, 8B-class.
	TaskTrackerClassify Task = "tracker_classify"

	// TaskAITutorML — chat с ml-coach persona. 4-layer memory
	// injection (snapshot/facts/summary/user_message). 70B для качества
	// рассуждений на ML-математике.
	TaskAITutorML Task = "ai_tutor_ml"

	// TaskAITutorDE — chat с de-mentor persona. Аналогично
	// TaskAITutorML, но для data-engineering reasoning (SQL plans /
	// streaming / distributed compute).
	TaskAITutorDE Task = "ai_tutor_de"

	// TaskCheckpointGrade — step checkpoint quiz grading.
	// Input: 5 questions из mock_pool по track_steps.checkpoint_skill_keys
	// + user answers. Output: {score 0..100, attempts[]: per-question results}.
	// 70B для качества rubric'а — ≥70% unlock'ает следующий step.
	TaskCheckpointGrade Task = "checkpoint_grade"

	// TaskReflectionExtract — reflection auto-link extraction.
	// Input: reflection_text + Resource.topics_covered (expected concepts).
	// Output: {mentioned: [atlas_node_id], missed: [atlas_node_id]}.
	// Cached per text-hash; 8B достаточно (classification, не reasoning).
	TaskReflectionExtract Task = "reflection_extract"

	// TaskExtractResourceContent — add-resource flow. Input:
	// {url, fetched_text}. Output: full curation.Resource shape (title,
	// topics_covered, summary, depth, minutes, level). Cached per URL
	// hash 7d — ресурс не меняется быстро. 70B-class для accurate topic
	// extraction.
	TaskExtractResourceContent Task = "extract_resource_content"

	// TaskReflectionGrade — multi-takeaway reflection grading.
	// Input: {takeaways[], confusion_text, resource.topics_covered}.
	// Output: {quality_score 0..1, extracted_topics[], confusion_flag}.
	// User-context — caching не имеет смысла. Latency-sensitive (modal
	// blocks user); cerebras 8B-fast preferred.
	TaskReflectionGrade Task = "reflection_grade"

	// TaskValidateResource — auto-promote check. Input: {url,
	// atlas_node.description}. Output: {alive, reputable, on_topic, score}.
	// Cached per URL daily — promote-cron'у достаточно.
	TaskValidateResource Task = "validate_resource"
)

// Role mirrors OpenAI chat roles. Kept as a string (not an enum) because
// every provider we speak to also uses strings.
type Role string

const (
	RoleSystem    Role = "system"
	RoleUser      Role = "user"
	RoleAssistant Role = "assistant"
)

// Message is one chat turn.
type Message struct {
	Role    Role
	Content string
	// Images is optional; nil = text-only (the common case). Today only
	// OpenRouter BYOK with a vision model supports images — the other
	// providers' llama models do not. Drivers that can't handle images
	// return a typed error so the chain knows to try the next provider.
	Images []Image
}

// Image carries raw bytes with a mime type. Kept as bytes (not
// base64-encoded) so the encoding happens at most once in the HTTP
// layer.
type Image struct {
	MimeType string
	Data     []byte
}

// Request is the provider-agnostic call shape. Exactly one of Task /
// ModelOverride is the source of truth for model selection.
type Request struct {
	// Task picks the model via TaskModelMap. Ignored when ModelOverride
	// is set. At least one of Task / ModelOverride must be non-zero.
	Task Task

	// ModelOverride pins a specific model id ("groq/llama-3.3-70b-versatile"
	// or "qwen/qwen3-coder:free"). When set, we route to the provider
	// derived from the prefix; if the prefix doesn't match a registered
	// provider, OpenRouter is used as the fallback (legacy model ids
	// without a provider prefix).
	ModelOverride string

	Messages    []Message
	Temperature float64
	MaxTokens   int

	// JSONMode asks the provider to force a valid-JSON response. Groq,
	// OpenRouter and Mistral support this natively via "response_format".
	// Cerebras ignores the hint — we fall back to prompt-level "return
	// only JSON" instruction (already in our system prompts).
	//
	// When JSONMode=true, chain.candidates() пропускает
	// драйверы у которых Capabilities().JSONMode=false, чтобы failover
	// не ушёл на провайдер который тихо вернёт plain text.
	JSONMode bool

	// RequiresTools — задача нуждается в OpenAI-style function calling.
	// chain.candidates() отрежет драйверы без Capabilities().Tools.
	// Зарезервировано на будущее (сейчас ни одна задача не использует).
	RequiresTools bool

	// AttemptTimeout caps the per-provider wall clock. Zero = use the
	// chain's per-provider default (groq 10s, cerebras 20s, others 45s).
	// Individual caller overrides are mostly for tests.
	AttemptTimeout time.Duration

	// UserTier — billing plan (free / pro). Пустая строка → free.
	// Tier-gate для paid ModelOverride и druz9/pro.
	// Caller заполняет из billing (pro_monthly → "pro").
	UserTier SubscriptionPlan

	// UserID — admin audit context. Optional; empty means «system /
	// no user attribution» (probe, scheduled job). Used by the invocation
	// audit log to attribute cost to a user.
	UserID string
}

// Response is the non-streaming result.
type Response struct {
	Content   string
	TokensIn  int
	TokensOut int
	// Provider / Model echo back the actually-used upstream so the
	// caller can surface it in observability and UI ("served by:
	// Groq/llama-3.3-70b · 2.3s" badge in chat/mock surfaces).
	Provider Provider
	Model    string
	Latency  time.Duration
	// FromCache is true when Chat returned a prior response without an upstream LLM call.
	FromCache bool
}

// StreamEvent is one frame of a streaming response. Exactly one of
// Delta / Done / Err is set. Channel closes after the terminal frame
// (matching copilot/domain.StreamEvent semantics).
type StreamEvent struct {
	Delta string
	Done  *DoneInfo
	Err   error
}

// DoneInfo carries the terminal frame's token accounting.
type DoneInfo struct {
	TokensIn  int
	TokensOut int
	Provider  Provider
	Model     string
}

// Driver is one upstream's HTTP client. Exactly one Driver instance per
// Provider. Drivers are stateless apart from the HTTP client and API
// key; all retry / fallback / circuit-breaker logic lives on Chain.
type Driver interface {
	// Provider returns the id this driver handles. Used by the chain
	// to build its registry.
	Provider() Provider

	// Chat is a non-streaming request. Errors are typed (see errors.go)
	// so the chain can decide whether to fall through.
	Chat(ctx context.Context, model string, req Request) (Response, error)

	// ChatStream returns a channel that closes after the terminal frame.
	// An error BEFORE the first chunk (connection / 429 / 5xx / auth)
	// is returned as the function's error value — the chain may then
	// retry with the next provider. Errors AFTER the first chunk arrive
	// as StreamEvent{Err} and the chain propagates them to the caller;
	// it does NOT attempt mid-stream fallback.
	ChatStream(ctx context.Context, model string, req Request) (<-chan StreamEvent, error)

	// Capabilities — что провайдер реально умеет на wire-уровне.
	// chain.candidates() фильтрует кандидатов по требованиям Request
	// (JSONMode, Tools) — проводник без нужной capability отрезается ДО
	// HTTP-вызова, чтобы не получить silent text-ответ на JSON-задачу.
	Capabilities() Capabilities
}

// Capabilities декларирует фичи драйвера. Wire-уровень: что понимает
// upstream API, не что эмулирует prompt-инструкциями.
type Capabilities struct {
	// JSONMode: умеет ли драйвер enforce'ить JSON через
	// response_format={"type":"json_object"} (или эквивалент).
	// Драйверы без поддержки могут попасть в task-routing для текстовых
	// задач, но для JSON-strict (Request.JSONMode=true) их отрезаем.
	JSONMode bool
	// Tools: умеет ли драйвер OpenAI-style function/tool calling.
	// Сейчас в кодбазе ни одна задача не использует tools, но поле
	// заведено для будущего и для симметрии. Filter активируется
	// только когда Request.RequiresTools=true.
	Tools bool
}

// Clock is a test seam — the chain injects a clock so rate-limit
// cooldowns are deterministic under test. Production uses time.Now.
type Clock func() time.Time

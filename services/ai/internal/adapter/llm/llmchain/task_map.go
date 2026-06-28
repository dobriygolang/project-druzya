package llmchain

import "maps"

// TaskModelMap is the per-task → per-provider model catalogue. The chain
// reads it to pick the right model on whichever provider is healthy at
// call time. Keeping this in code (not the DB) because:
//
//   - It changes with model availability on each provider, not with
//     operator choice. A deploy is the right cadence.
//   - The chain needs it synchronously; a DB lookup per call would add
//     latency to the hot path.
//   - Admins still edit llm_models (user-facing list + per-model flags);
//     this map is the chain's opinion of "best technical pick per task".
//
// Criteria for picks (as of 2026-Q2):
//
//	InsightProse     — 70B-class, Russian prose quality matters.
//	CopilotStream    — 70B-class, reasoning + streaming. Same as insight
//	                   but accessed via ChatStream.
//	Reasoning        — reasoning-specialized на primary (gpt-oss-120b на
//	                   Groq c native chain-of-thought, deepseek-r1 fallback).
//	                   Llama 70B остаётся на Cerebras/Mistral как fast fallback.
//	CodingHint       — small + low latency. Для on-demand подсказок юзеру.
//	CodeReview       — reasoning-heavy submit review (см. Reasoning).
//	SysDesignCritique — long-context архитектурный судья (см. Reasoning).
//	CheckpointGrade  — quiz grading (false-pass дорог) (см. Reasoning).
//	MLEngMock        — ML system design + math (см. Reasoning).
//	Summarize        — самая дешёвая модель, фон для bg-summarizer.
//
// Reasoning-vs-chat split: 5 critical judging task'ов выше используют
// reasoning-специализированные модели на primary (Groq gpt-oss-120b) +
// strongest reasoning fallback (OpenRouter deepseek-r1:free). Все
// chat-style task'и (AITutorChat, CopilotStream, DailyBrief etc.)
// остаются на llama-3.3-70b — latency перевешивает marginal reasoning gain.
//
// Default-карта включает ТОЛЬКО free-tier модели на каждом провайдере:
// Groq (free RPM/RPD), Cerebras (zai-glm-4.7), Google (gemini-2.0-flash),
// Cloudflare Workers AI, Mistral La Plateforme (mistral-small-latest),
// OpenRouter (:free-lane). Paid-провайдеры (OpenAI direct, DeepSeek direct)
// и paid OpenRouter ids — только в virtual druz9/pro (tier.go).
//
// When a provider doesn't have a model for a task (e.g. Mistral-free
// lacks an 8B instant option), the chain skips that provider for the
// task. An empty string in this map means "not available here".
type TaskModelMap map[Task]map[Provider]string

// DefaultTaskModelMap is the baked-in catalogue. The chain copies from
// it at construction; overriding individual slots is an explicit
// operator action through the chain's options.
var DefaultTaskModelMap = TaskModelMap{
	TaskInsightProse: {
		ProviderGroq:       "llama-3.3-70b-versatile",
		ProviderCerebras:   "zai-glm-4.7",
		ProviderMistral:    "mistral-small-latest",
		ProviderOpenRouter: "openai/gpt-oss-120b:free",
	},
	TaskCopilotStream: {
		ProviderGroq:       "llama-3.3-70b-versatile",
		ProviderCerebras:   "zai-glm-4.7",
		ProviderMistral:    "mistral-small-latest",
		ProviderOpenRouter: "qwen/qwen3-coder:free",
	},
	TaskReasoning: {
		// Paid: DeepSeek R1 first when DEEPSEEK_API_KEY + chain order puts
		// deepseek ahead of groq. Free fallbacks unchanged below.
		ProviderDeepSeek:   "deepseek-reasoner",
		ProviderGroq:       "openai/gpt-oss-120b",
		ProviderCerebras:   "zai-glm-4.7",
		ProviderMistral:    "mistral-small-latest",
		ProviderOpenRouter: "deepseek/deepseek-r1:free",
	},
	// ────────────────────────────────────────────────────────────────
	// New (2026-Q2) tasks.
	// ────────────────────────────────────────────────────────────────
	TaskCodingHint: {
		// Small model, low latency is the whole point of the task —
		// the hint is obsolete the moment it's late. Groq 8B is fastest
		// first-byte, Cerebras second.
		ProviderGroq:     "llama-3.1-8b-instant",
		ProviderCerebras: "zai-glm-4.7",
		ProviderMistral:  "mistral-small-latest",
		// OpenRouter deliberately omitted: qwen3-coder:free has higher
		// p95 first-byte latency in our tests and this task is the one
		// where that matters most.
	},
	TaskCodeReview: {
		ProviderDeepSeek:   "deepseek-chat",
		ProviderGroq:       "llama-3.3-70b-versatile",
		ProviderCerebras:   "zai-glm-4.7",
		ProviderMistral:    "mistral-small-latest",
		ProviderOpenRouter: "deepseek/deepseek-r1:free",
	},
	TaskSysDesignCritique: {
		ProviderDeepSeek:   "deepseek-reasoner",
		ProviderGroq:       "openai/gpt-oss-120b",
		ProviderCerebras:   "zai-glm-4.7",
		ProviderMistral:    "mistral-small-latest",
		ProviderOpenRouter: "deepseek/deepseek-r1:free",
	},
	TaskSummarize: {
		// Cheapest-available on each provider — summarize runs in the
		// background, token cost trumps quality and the summary may be
		// re-read by a stronger model downstream.
		ProviderGroq:       "llama-3.1-8b-instant",
		ProviderCerebras:   "zai-glm-4.7",
		ProviderMistral:    "mistral-small-latest",
		ProviderOpenRouter: "openai/gpt-oss-120b:free",
	},
	TaskDailyPlanSynthesis: {
		// Hone Today-план: нужен reasoning + строгий JSON-выход (3-4
		// PlanItem'а). Качество приоритетно над latency — регенерация
		// случается раз в день, юзер готов подождать 2-3 сек.
		// 70B-класс на всех cloud-провайдерах.
		ProviderGroq:       "llama-3.3-70b-versatile",
		ProviderCerebras:   "zai-glm-4.7",
		ProviderMistral:    "mistral-small-latest",
		ProviderOpenRouter: "openai/gpt-oss-120b:free",
	},
	TaskDailyBrief: {
		// AI-coach утренний бриф: strict JSON + 1-3 sentences narrative
		// + 3 recommendation'а. Кеш 6h, регенерация редкая — quality-первая.
		// 70B на всех cloud-провайдерах.
		ProviderGroq:       "llama-3.3-70b-versatile",
		ProviderCerebras:   "zai-glm-4.7",
		ProviderMistral:    "mistral-small-latest",
		ProviderOpenRouter: "openai/gpt-oss-120b:free",
	},
	TaskVision: {
		// Vision — только free-tier multimodal модели.
		// Groq llama-4-scout — paid ($0.11/M input), не включаем.
		// Google gemini-2.0-flash — free tier + vision.
		// OpenRouter gemma-3-27b — :free lane, отдельный rate-limit pool.
		ProviderGoogle:     "gemini-2.0-flash",
		ProviderOpenRouter: "google/gemma-3-27b-it:free",
	},
	TaskNoteQA: {
		// RAG-ответ на вопрос по нотам: длинный context (title+body 8 нот)
		// + reasoning + markdown-вывод с [N]-цитациями. 70B-класс.
		// Latency не критична (юзер готов подождать 2-3s после Enter).
		ProviderGroq:       "llama-3.3-70b-versatile",
		ProviderCerebras:   "zai-glm-4.7",
		ProviderMistral:    "mistral-small-latest",
		ProviderOpenRouter: "openai/gpt-oss-120b:free",
	},
	TaskEnglishMockHR: {
		// English HR-mock — пользователь говорит / пишет на английском с
		// AI-собеседующим. Latency не критична (это диалог, не auto-suggest);
		// качество прозы и грамматического контроля — основной критерий.
		// 70B-class на всех cloud-провайдерах.
		ProviderGroq:       "llama-3.3-70b-versatile",
		ProviderCerebras:   "zai-glm-4.7",
		ProviderMistral:    "mistral-small-latest",
		ProviderOpenRouter: "openai/gpt-oss-120b:free",
	},
	TaskSystemDesignSeniorMock: {
		// Senior SD multi-turn dialogue — long context, deep reasoning.
		// Same model class as TaskSysDesignCritique (which grades a single
		// diagram), but distinct entry: critique is one-shot evaluation,
		// this is interactive multi-turn pushback. 70B на всех cloud
		// провайдерах.
		ProviderGroq:       "llama-3.3-70b-versatile",
		ProviderCerebras:   "zai-glm-4.7",
		ProviderMistral:    "mistral-small-latest",
		ProviderOpenRouter: "openai/gpt-oss-120b:free",
	},
	TaskTechLeadMock: {
		// Tech Lead / EM behavioral STAR-mock. Same 70B-class story —
		// quality of probing (refuses generic answers, demands specific
		// numbers / outcomes / lessons) requires reasoning depth.
		ProviderGroq:       "llama-3.3-70b-versatile",
		ProviderCerebras:   "zai-glm-4.7",
		ProviderMistral:    "mistral-small-latest",
		ProviderOpenRouter: "openai/gpt-oss-120b:free",
	},
	TaskSysanalystMock: {
		// Sysanalyst free-form mock. Reasoning over data design + API
		// contract critique + integration patterns — 70B-class.
		ProviderGroq:       "llama-3.3-70b-versatile",
		ProviderCerebras:   "zai-glm-4.7",
		ProviderMistral:    "mistral-small-latest",
		ProviderOpenRouter: "openai/gpt-oss-120b:free",
	},
	TaskProductAnalystMock: {
		// Product analyst free-form mock. Stats reasoning (sample size,
		// CUPED, MDE) + SQL critique on the conversation — 70B-class.
		ProviderGroq:       "llama-3.3-70b-versatile",
		ProviderCerebras:   "zai-glm-4.7",
		ProviderMistral:    "mistral-small-latest",
		ProviderOpenRouter: "openai/gpt-oss-120b:free",
	},
	TaskQAMock: {
		// QA free-form mock — edge-case reasoning + automation design.
		ProviderGroq:       "llama-3.3-70b-versatile",
		ProviderCerebras:   "zai-glm-4.7",
		ProviderMistral:    "mistral-small-latest",
		ProviderOpenRouter: "openai/gpt-oss-120b:free",
	},
	TaskDevOpsMock: {
		// DevOps / SRE mock — infra tradeoffs + incident response.
		ProviderGroq:       "llama-3.3-70b-versatile",
		ProviderCerebras:   "zai-glm-4.7",
		ProviderMistral:    "mistral-small-latest",
		ProviderOpenRouter: "openai/gpt-oss-120b:free",
	},
	TaskMLEngMock: {
		ProviderDeepSeek:   "deepseek-reasoner",
		ProviderGroq:       "openai/gpt-oss-120b",
		ProviderCerebras:   "zai-glm-4.7",
		ProviderMistral:    "mistral-small-latest",
		ProviderOpenRouter: "deepseek/deepseek-r1:free",
	},
	TaskTutorPreSessionBrief: {
		// Tutor pre-session brief — narrative prose over aggregated
		// numbers, ~250 words, Russian. Quality > latency (tutor reads
		// it once before a 1:1). 70B-class on cloud.
		ProviderGroq:       "llama-3.3-70b-versatile",
		ProviderCerebras:   "zai-glm-4.7",
		ProviderMistral:    "mistral-small-latest",
		ProviderOpenRouter: "openai/gpt-oss-120b:free",
	},
	TaskHoneSummaryGrade: {
		// Reading summary grader — strict JSON, small surface, fast
		// turnaround (user-blocking). 8B-class is enough; the work is
		// "compare two short pieces of text, return a number". 70B
		// would be overkill and burn the latency budget. Mistral
		// remains a fallback for when groq/cerebras free tiers throttle.
		ProviderGroq:       "llama-3.1-8b-instant",
		ProviderCerebras:   "zai-glm-4.7",
		ProviderMistral:    "mistral-small-latest",
		ProviderOpenRouter: "openai/gpt-oss-120b:free",
	},
	TaskHoneWritingFeedback: {
		// Writing-as-Focus inline feedback — user-blocking JSON list.
		// Same latency-vs-quality tradeoff as summary grading; the work
		// is "find the bad bits in this 200-word draft". 8B handles
		// surface grammar; the 120B free-tier OpenRouter route is the
		// quality fallback when the 8B misses subtler stylistic issues.
		ProviderGroq:       "llama-3.1-8b-instant",
		ProviderCerebras:   "zai-glm-4.7",
		ProviderMistral:    "mistral-small-latest",
		ProviderOpenRouter: "openai/gpt-oss-120b:free",
	},
	TaskHoneCodeReviewGrade: {
		// Code-review grading — comparing a user review to a diff
		// requires reasoning about what the patch actually does, what
		// it misses, and whether the reviewer's comments are technically
		// sound. 70B-class on cloud. Worth the extra latency vs the 8B
		// used in writing feedback.
		ProviderGroq:       "llama-3.3-70b-versatile",
		ProviderCerebras:   "zai-glm-4.7",
		ProviderMistral:    "mistral-small-latest",
		ProviderOpenRouter: "openai/gpt-oss-120b:free",
	},
	TaskHoneSpeakingGrade: {
		// Speaking-grade — word-level alignment between reference text and
		// Whisper transcript + 1-line coach feedback. Mostly classification,
		// no deep reasoning required. 8B is plenty + UI is latency-sensitive
		// (user stares at "Grading..." until response). Same model tier as
		// writing feedback.
		ProviderGroq:       "llama-3.1-8b-instant",
		ProviderCerebras:   "zai-glm-4.7",
		ProviderMistral:    "mistral-small-latest",
		ProviderOpenRouter: "openai/gpt-oss-120b:free",
	},
	TaskHoneNoteActionExtract: {
		// Note action item extraction — short JSON output (<=10 items),
		// classification + 5-10-word title formulation per excerpt.
		// Не reasoning-heavy, нужна скорость (юзер ждёт panel render).
		// 8B-class. Russian-first контент (Sergey пишет заметки по-русски),
		// llama-3.1-8b-instant + mistral-small справляются нативно.
		ProviderGroq:       "llama-3.1-8b-instant",
		ProviderCerebras:   "zai-glm-4.7",
		ProviderMistral:    "mistral-small-latest",
		ProviderOpenRouter: "openai/gpt-oss-120b:free",
	},
	TaskAITutorChat: {
		// AI-tutor chat — open-ended dialogue с 4-layer memory injection.
		// Quality > latency (студент готов подождать 2-3s на coach reply).
		// Russian-first контент → Groq Llama 3 70B верхний приоритет.
		ProviderGroq:       "llama-3.3-70b-versatile",
		ProviderCerebras:   "zai-glm-4.7",
		ProviderMistral:    "mistral-small-latest",
		ProviderOpenRouter: "openai/gpt-oss-120b:free",
	},
	TaskAITutorCompact: {
		// Compaction — small structured task, 8B хватает. Latency не
		// важна (background trigger, не user-blocking).
		ProviderGroq:       "llama-3.1-8b-instant",
		ProviderCerebras:   "zai-glm-4.7",
		ProviderMistral:    "mistral-small-latest",
		ProviderOpenRouter: "openai/gpt-oss-120b:free",
	},
	TaskAITutorAssignment: {
		// Daily assignment generation — structured JSON output. 70B
		// чтобы качественно подобрать задачу под текущую слабость
		// студента из snapshot.
		ProviderGroq:       "llama-3.3-70b-versatile",
		ProviderCerebras:   "zai-glm-4.7",
		ProviderMistral:    "mistral-small-latest",
		ProviderOpenRouter: "openai/gpt-oss-120b:free",
	},
	TaskCustomPathGenerate: {
		// Custom path generation — JSON list of 8-15 topics from
		// free-form goal. 70B для качественной categorization.
		ProviderGroq:       "llama-3.3-70b-versatile",
		ProviderCerebras:   "zai-glm-4.7",
		ProviderMistral:    "mistral-small-latest",
		ProviderOpenRouter: "openai/gpt-oss-120b:free",
	},
	TaskAtlasClassify: {
		// Atlas classification — single TODO → JSON {match | new node}.
		// Дешёвая classification, 8B хватит.
		ProviderGroq:       "llama-3.1-8b-instant",
		ProviderCerebras:   "zai-glm-4.7",
		ProviderMistral:    "mistral-small-latest",
		ProviderOpenRouter: "openai/gpt-oss-120b:free",
	},
	TaskCurateResource: {
		// External resource curation — 3-5 best free links per atlas node
		// со shape {url, title, author, kind, minutes, level, priority,
		// why}. Background, не user-blocking, но quality > speed: плохой
		// `why` или мусорный URL = ручная правка Sergey'ем. 70B-class.
		ProviderGroq:       "llama-3.3-70b-versatile",
		ProviderCerebras:   "zai-glm-4.7",
		ProviderMistral:    "mistral-small-latest",
		ProviderOpenRouter: "openai/gpt-oss-120b:free",
	},
	TaskAssistantNextAction: {
		// Coach hero «one daily action» — structured JSON под user's
		// state. User-blocking но cached 1/day, quality > latency. 70B.
		ProviderGroq:       "llama-3.3-70b-versatile",
		ProviderCerebras:   "zai-glm-4.7",
		ProviderMistral:    "mistral-small-latest",
		ProviderOpenRouter: "openai/gpt-oss-120b:free",
	},
	TaskAssistantForkAnalysis: {
		// Weekly fork-analysis (MLE vs DE lean) — confidence-bearing JSON.
		// Background cron, 70B для качества reasoning под branch scores.
		ProviderGroq:       "llama-3.3-70b-versatile",
		ProviderCerebras:   "zai-glm-4.7",
		ProviderMistral:    "mistral-small-latest",
		ProviderOpenRouter: "openai/gpt-oss-120b:free",
	},
	TaskAssistantRereroll: {
		// Dismiss-flow alternative action — light JSON gen, latency-bound.
		// 8B хватает: тот же signals input, нужна только variation.
		ProviderGroq:       "llama-3.1-8b-instant",
		ProviderCerebras:   "zai-glm-4.7",
		ProviderMistral:    "mistral-small-latest",
		ProviderOpenRouter: "openai/gpt-oss-120b:free",
	},
	TaskNotesLinkSuggest: {
		// Embed-based candidate retrieval + LLM rerank → JSON list. Quality
		// > latency (предложения накапливаются, не блокируют typing). 70B
		// для consistency rerank'а.
		ProviderGroq:       "llama-3.3-70b-versatile",
		ProviderCerebras:   "zai-glm-4.7",
		ProviderMistral:    "mistral-small-latest",
		ProviderOpenRouter: "openai/gpt-oss-120b:free",
	},
	TaskTaskboardCategorise: {
		// New task → column + tag (today/week/backlog). Light classification,
		// latency-sensitive (drag-drop UI ждёт), 8B-class.
		ProviderGroq:       "llama-3.1-8b-instant",
		ProviderCerebras:   "zai-glm-4.7",
		ProviderMistral:    "mistral-small-latest",
		ProviderOpenRouter: "openai/gpt-oss-120b:free",
	},
	TaskTrackerClassify: {
		ProviderGroq:       "llama-3.1-8b-instant",
		ProviderCerebras:   "zai-glm-4.7",
		ProviderMistral:    "mistral-small-latest",
		ProviderOpenRouter: "openai/gpt-oss-120b:free",
	},
	TaskAITutorML: {
		// ml-coach chat — 4-layer memory injection, ML reasoning depth.
		// 70B-class — те же модели что TaskAITutorChat.
		ProviderGroq:       "llama-3.3-70b-versatile",
		ProviderCerebras:   "zai-glm-4.7",
		ProviderMistral:    "mistral-small-latest",
		ProviderOpenRouter: "openai/gpt-oss-120b:free",
	},
	TaskAITutorDE: {
		// de-mentor chat — DE reasoning (SQL plans / streaming /
		// distributed compute). 70B-class.
		ProviderGroq:       "llama-3.3-70b-versatile",
		ProviderCerebras:   "zai-glm-4.7",
		ProviderMistral:    "mistral-small-latest",
		ProviderOpenRouter: "openai/gpt-oss-120b:free",
	},
	TaskCheckpointGrade: {
		ProviderDeepSeek:   "deepseek-reasoner",
		ProviderGroq:       "openai/gpt-oss-120b",
		ProviderCerebras:   "zai-glm-4.7",
		ProviderMistral:    "mistral-small-latest",
		ProviderOpenRouter: "deepseek/deepseek-r1:free",
	},
	TaskReflectionExtract: {
		// reflection_text + expected concepts → mentioned/missed atlas
		// node ids. Classification, 8B хватит. Cached per text-hash.
		ProviderGroq:       "llama-3.1-8b-instant",
		ProviderCerebras:   "zai-glm-4.7",
		ProviderMistral:    "mistral-small-latest",
		ProviderOpenRouter: "openai/gpt-oss-120b:free",
	},
	TaskExtractResourceContent: {
		// URL+text → full Resource shape (topics, summary, depth, level).
		// Quality важно — извлечение topics_covered определяет совпадение
		// с atlas-узлами. 70B-class. Cached per URL hash 7d.
		ProviderGroq:       "llama-3.3-70b-versatile",
		ProviderCerebras:   "zai-glm-4.7",
		ProviderMistral:    "mistral-small-latest",
		ProviderOpenRouter: "openai/gpt-oss-120b:free",
	},
	TaskReflectionGrade: {
		// takeaways[] + expected topics → quality_score + extracted_topics
		// + confusion_flag. Latency-sensitive (modal blocks user). Cerebras
		// 8B-fast preferred (~150 tok/s).
		ProviderCerebras:   "zai-glm-4.7",
		ProviderGroq:       "llama-3.1-8b-instant",
		ProviderMistral:    "mistral-small-latest",
		ProviderOpenRouter: "openai/gpt-oss-120b:free",
	},
	TaskValidateResource: {
		// URL + atlas_node desc → alive/reputable/on_topic/score.
		// Cron-driven, не latency-sensitive. 70B качества для on_topic
		// judgement.
		ProviderGroq:       "llama-3.3-70b-versatile",
		ProviderCerebras:   "zai-glm-4.7",
		ProviderMistral:    "mistral-small-latest",
		ProviderOpenRouter: "openai/gpt-oss-120b:free",
	},
}

func init() {
	for task, inner := range DefaultTaskModelMap {
		if inner == nil || task == TaskVision {
			continue
		}
		if inner[ProviderGroq] == "" {
			continue
		}
		if inner[ProviderGoogle] == "" {
			inner[ProviderGoogle] = googleModelForTask(task)
		}
		if inner[ProviderCloudflare] == "" {
			inner[ProviderCloudflare] = cloudflareModelForTask(task)
		}
		if inner[ProviderOpenRouter] == "" {
			inner[ProviderOpenRouter] = openrouterModelForTask(task)
		}
	}
}

func googleModelForTask(task Task) string {
	// Google AI Studio free tier via OpenAI-compatible endpoint
	// (generativelanguage.googleapis.com/v1beta/openai/...).
	// gemini-2.0-flash — рабочая free-модель; 429 = quota/RPM, не bad key.
	return "gemini-2.0-flash"
}

func openrouterModelForTask(task Task) string {
	switch task {
	case TaskCopilotStream:
		return "qwen/qwen3-coder:free"
	case TaskReasoning, TaskCodeReview, TaskSysDesignCritique, TaskCheckpointGrade, TaskMLEngMock:
		return "deepseek/deepseek-r1:free"
	default:
		return "openai/gpt-oss-120b:free"
	}
}

func cloudflareModelForTask(task Task) string {
	switch task {
	case TaskSummarize, TaskCodingHint, TaskHoneSummaryGrade, TaskHoneWritingFeedback:
		// @cf/meta/llama-3.1-8b-instruct deprecated 2026-05-30; -fast variant stays.
		return "@cf/meta/llama-3.1-8b-instruct-fast"
	default:
		return "@cf/meta/llama-3.3-70b-instruct-fp8-fast"
	}
}

// Clone returns a deep copy so callers can mutate without affecting
// other chain instances / tests.
func (m TaskModelMap) Clone() TaskModelMap {
	out := make(TaskModelMap, len(m))
	for t, inner := range m {
		out[t] = maps.Clone(inner)
	}
	return out
}

// ModelFor returns the model id for (task, provider), or "" when no
// mapping exists. Callers treat "" as "skip this provider for this task".
func (m TaskModelMap) ModelFor(task Task, p Provider) string {
	inner, ok := m[task]
	if !ok {
		return ""
	}
	return inner[p]
}

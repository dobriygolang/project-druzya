package llmchain

import "time"

// TaskParams — централизованные параметры (Temperature, MaxTokens, Timeout)
// для каждой Task. Сервисы тянут их через DefaultTaskParams[task] вместо
// хардкода в infra/llm_*.go. Зависимости меняются в одном месте.
type TaskParams struct {
	Temperature float64
	MaxTokens   int
	// Timeout — суммарный wall-clock на одну попытку LLM-вызова. 0 =
	// провайдер использует свой default (см. chain.go).
	Timeout time.Duration
}

// DefaultTaskParams — справочник параметров на сегодня. Значения подобраны
// под конкретные prompt'ы; их подкрутка может изменить качество ответа.
// Если задача не в списке, caller передаёт явные Temperature/MaxTokens сам.
var DefaultTaskParams = map[Task]TaskParams{
	TaskHoneNoteActionExtract: {Temperature: 0.2, MaxTokens: 900, Timeout: 8 * time.Second},
	TaskSysDesignCritique:     {Temperature: 0.4, MaxTokens: 1200, Timeout: 10 * time.Second},
	TaskHoneSpeakingGrade:     {Temperature: 0.2, MaxTokens: 900, Timeout: 8 * time.Second},
	TaskHoneSummaryGrade:      {Temperature: 0.2, MaxTokens: 180, Timeout: 8 * time.Second},
	TaskHoneWritingFeedback:   {Temperature: 0.2, MaxTokens: 1100, Timeout: 8 * time.Second},
	TaskHoneCodeReviewGrade:   {Temperature: 0.2, MaxTokens: 1500, Timeout: 10 * time.Second},
	TaskDailyPlanSynthesis:    {Temperature: 0.3, MaxTokens: 900, Timeout: 10 * time.Second},
}

// ParamsFor возвращает параметры таски или zero-value, если задача не
// перечислена. Caller проверяет MaxTokens != 0 чтобы понять, использовать
// значения по умолчанию или подставить свои.
func ParamsFor(t Task) TaskParams {
	return DefaultTaskParams[t]
}

package evaluator

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"regexp"
	"strings"
	"time"

	contentadapter "github.com/sedorofeevd/project-druzya/services/ai/internal/adapter/content"
	"github.com/sedorofeevd/project-druzya/services/ai/internal/adapter/llm/llmchain"
	evaluationmodel "github.com/sedorofeevd/project-druzya/services/ai/internal/evaluation/model"
)

const (
	defaultOffTopicPenalty = 0.30
	pass1SystemPrompt      = `Ты детектор off-topic ответов на техническом интервью.
Верни ТОЛЬКО JSON: {"water_score": <0..100>}
0 = полностью по теме, 100 = полностью off-topic / не отвечает на вопрос.`
	pass2SystemPrompt = `Ты строгий интервьюер. Оцени ответ кандидата по rubric criteria.
Верни ТОЛЬКО JSON:
{
  "score": <0..100>,
  "passed": <boolean>,
  "summary": "<2-3 предложения>",
  "strengths": ["..."],
  "improvements": ["..."],
  "criteria": [{"key": "<criterion key>", "score": <number>, "max_score": <number>}],
  "feedback": {}
}
criteria — оценка по каждому rubric criterion из промпта (key совпадает с rubric).
По умолчанию FAIL. PASS только при доказательно сильном ответе.`
)

var jsonBlockRE = regexp.MustCompile(`(?s)\{.*\}`)

// LLMJudge runs two-pass scoring via llmchain (water + correctness).
type LLMJudge struct {
	chain llmchain.ChatClient
	log   *slog.Logger
}

// NewLLMJudge constructs a production judge. Nil chain returns fake-like errors upstream.
func NewLLMJudge(chain llmchain.ChatClient, log *slog.Logger) Client {
	return &LLMJudge{chain: chain, log: log}
}

func (j *LLMJudge) Evaluate(ctx context.Context, in Input) (*Output, error) {
	if j.chain == nil {
		return NewFakeClient().Evaluate(ctx, in)
	}

	userAnswer := candidateAnswer(in)
	if strings.TrimSpace(userAnswer) == "" {
		return nil, fmt.Errorf("empty candidate answer")
	}

	var calls []CallRecord
	isCode := strings.TrimSpace(in.Code) != ""

	var waterScore float64
	if !isCode {
		call, score, err := j.pass1WaterScore(ctx, in, userAnswer)
		calls = append(calls, call)
		if err != nil {
			return nil, fmt.Errorf("pass1 water: %w", err)
		}
		waterScore = score
	}

	call2, corr, strengths, improvements, summary, criteria, err := j.pass2Correctness(ctx, in, userAnswer)
	calls = append(calls, call2)
	if err != nil {
		return nil, fmt.Errorf("pass2 correctness: %w", err)
	}
	if len(criteria) == 0 {
		criteria = fallbackCriterionScores(in, corr)
	}

	penalty := in.OffTopicPenalty
	if penalty <= 0 {
		penalty = defaultOffTopicPenalty
	}
	final := corr * (1.0 - (waterScore/100.0)*penalty)
	if final < 0 {
		final = 0
	}
	if final > 100 {
		final = 100
	}

	passed := final >= 70
	result := &evaluationmodel.EvaluationResult{
		Score:        final,
		Passed:       &passed,
		Summary:      summary,
		Strengths:    strengths,
		Improvements: improvements,
		Feedback:     map[string]any{"water_score": waterScore},
	}

	return &Output{Result: result, WaterScore: waterScore, Criteria: criteria, Calls: calls}, nil
}

func (j *LLMJudge) pass1WaterScore(ctx context.Context, in Input, userAnswer string) (CallRecord, float64, error) {
	user := fmt.Sprintf("Задача:\n%s\n\nОтвет кандидата:\n%s", taskBody(in), userAnswer)
	start := time.Now()
	resp, err := j.chain.Chat(ctx, llmchain.Request{
		Task:        llmchain.TaskReasoning,
		Temperature: 0,
		MaxTokens:   200,
		JSONMode:    true,
		Messages: []llmchain.Message{
			{Role: llmchain.RoleSystem, Content: pass1SystemPrompt},
			{Role: llmchain.RoleUser, Content: user},
		},
	})
	call := callRecordFromResponse("pass1_water", resp, start, err)
	if err != nil {
		return call, 0, err
	}

	var parsed struct {
		WaterScore float64 `json:"water_score"`
	}
	if err := parseLLMJSON(resp.Content, &parsed); err != nil {
		errMsg := err.Error()
		call.Error = &errMsg
		return call, 0, err
	}
	if parsed.WaterScore < 0 {
		parsed.WaterScore = 0
	}
	if parsed.WaterScore > 100 {
		parsed.WaterScore = 100
	}
	raw, _ := json.Marshal(parsed)
	call.ParsedResult = raw
	return call, parsed.WaterScore, nil
}

func (j *LLMJudge) pass2Correctness(ctx context.Context, in Input, userAnswer string) (CallRecord, float64, []string, []string, string, []CriterionScore, error) {
	criteriaJSON, _ := json.Marshal(in.Criteria)
	solutionsJSON, _ := json.Marshal(in.Solutions)
	user := fmt.Sprintf(
		"Task type: %s\nTitle: %s\nDescription:\n%s\n\nRubric criteria (JSON):\n%s\n\nReference solutions (JSON, context only):\n%s\n\nCandidate answer:\n%s",
		in.TaskType, in.TaskTitle, in.TaskDescription, string(criteriaJSON), string(solutionsJSON), userAnswer,
	)

	start := time.Now()
	resp, err := j.chain.Chat(ctx, llmchain.Request{
		Task:        llmchain.TaskCodeReview,
		Temperature: 0.2,
		MaxTokens:   800,
		JSONMode:    true,
		Messages: []llmchain.Message{
			{Role: llmchain.RoleSystem, Content: pass2SystemPrompt},
			{Role: llmchain.RoleUser, Content: user},
		},
	})
	call := callRecordFromResponse("pass2_score", resp, start, err)
	if err != nil {
		return call, 0, nil, nil, "", nil, err
	}

	var parsed struct {
		Score        float64 `json:"score"`
		Passed       *bool   `json:"passed"`
		Summary      string  `json:"summary"`
		Strengths    []string       `json:"strengths"`
		Improvements []string       `json:"improvements"`
		Criteria     []struct {
			Key      string  `json:"key"`
			Score    float64 `json:"score"`
			MaxScore float64 `json:"max_score"`
		} `json:"criteria"`
		Feedback map[string]any `json:"feedback"`
	}
	if err := parseLLMJSON(resp.Content, &parsed); err != nil {
		errMsg := err.Error()
		call.Error = &errMsg
		return call, 0, nil, nil, "", nil, err
	}
	if parsed.Score < 0 {
		parsed.Score = 0
	}
	if parsed.Score > 100 {
		parsed.Score = 100
	}
	raw, _ := json.Marshal(parsed)
	call.ParsedResult = raw
	if parsed.Strengths == nil {
		parsed.Strengths = []string{}
	}
	if parsed.Improvements == nil {
		parsed.Improvements = []string{}
	}
	summary := strings.TrimSpace(parsed.Summary)
	if summary == "" {
		summary = "Evaluation completed."
	}
	criteria := make([]CriterionScore, 0, len(parsed.Criteria))
	for _, c := range parsed.Criteria {
		if strings.TrimSpace(c.Key) == "" {
			continue
		}
		maxScore := c.MaxScore
		if maxScore <= 0 {
			maxScore = 100
		}
		score := c.Score
		if score < 0 {
			score = 0
		}
		if score > maxScore {
			score = maxScore
		}
		criteria = append(criteria, CriterionScore{Key: c.Key, Score: score, MaxScore: maxScore})
	}
	return call, parsed.Score, parsed.Strengths, parsed.Improvements, summary, criteria, nil
}

func fallbackCriterionScores(in Input, overall float64) []CriterionScore {
	if len(in.Criteria) == 0 {
		key := "overall"
		if strings.TrimSpace(in.TaskType) != "" {
			key = "overall"
		}
		return []CriterionScore{{Key: key, Score: overall, MaxScore: 100}}
	}
	out := make([]CriterionScore, 0, len(in.Criteria))
	for _, c := range in.Criteria {
		maxScore := float64(c.MaxScore)
		if maxScore <= 0 {
			maxScore = 100
		}
		out = append(out, CriterionScore{Key: c.Key, Score: overall, MaxScore: maxScore})
	}
	return out
}

func callRecordFromResponse(phase string, resp llmchain.Response, start time.Time, err error) CallRecord {
	reqPayload, _ := json.Marshal(map[string]string{"phase": phase})
	respPayload, _ := json.Marshal(map[string]any{
		"content":  resp.Content,
		"provider": resp.Provider,
		"model":    resp.Model,
	})
	call := CallRecord{
		Provider:     string(resp.Provider),
		Model:        resp.Model,
		RequestJSON:  reqPayload,
		ResponseJSON: respPayload,
		LatencyMS:    int(time.Since(start).Milliseconds()),
	}
	if resp.TokensIn > 0 {
		v := resp.TokensIn
		call.PromptTokens = &v
	}
	if resp.TokensOut > 0 {
		v := resp.TokensOut
		call.CompletionTokens = &v
	}
	if resp.TokensIn+resp.TokensOut > 0 {
		v := resp.TokensIn + resp.TokensOut
		call.TotalTokens = &v
	}
	if err != nil {
		msg := err.Error()
		call.Error = &msg
	}
	return call
}

func parseLLMJSON(raw string, dest any) error {
	raw = strings.TrimSpace(raw)
	if err := json.Unmarshal([]byte(raw), dest); err == nil {
		return nil
	}
	block := jsonBlockRE.FindString(raw)
	if block == "" {
		return fmt.Errorf("no json object in response")
	}
	return json.Unmarshal([]byte(block), dest)
}

func candidateAnswer(in Input) string {
	if strings.TrimSpace(in.Code) != "" {
		lang := in.Language
		if lang == "" {
			lang = "code"
		}
		return fmt.Sprintf("Code (%s):\n%s", lang, in.Code)
	}
	return in.AnswerText
}

func taskBody(in Input) string {
	var b strings.Builder
	fmt.Fprintf(&b, "%s\n%s", in.TaskTitle, in.TaskDescription)
	return b.String()
}

// InputFromBundle maps adapters into evaluator input.
func InputFromBundle(
	taskType, title, description string,
	criteria []contentadapter.RubricCriterion,
	solutions []contentadapter.Solution,
	answerText, code, language string,
) Input {
	in := Input{
		TaskType:        taskType,
		TaskTitle:       title,
		TaskDescription: description,
		AnswerText:      answerText,
		Code:            code,
		Language:        language,
	}
	for _, c := range criteria {
		desc := ""
		if c.Description != nil {
			desc = *c.Description
		}
		in.Criteria = append(in.Criteria, Criterion{
			Key: c.Key, Title: c.Title, Description: desc, Weight: c.Weight, MaxScore: c.MaxScore,
		})
	}
	for _, s := range solutions {
		lang := ""
		if s.Language != nil {
			lang = *s.Language
		}
		in.Solutions = append(in.Solutions, Solution{Language: lang, SolutionText: s.SolutionText})
	}
	return in
}

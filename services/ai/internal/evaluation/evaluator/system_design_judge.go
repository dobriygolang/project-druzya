package evaluator

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/sedorofeevd/project-druzya/services/ai/internal/adapter/llm/llmchain"
	evaluationmodel "github.com/sedorofeevd/project-druzya/services/ai/internal/evaluation/model"
)

const sdEvalSystemPrompt = `You are a strict system design interview grader.
Evaluate the full dossier (requirements, architecture, API, data model, infra, dialogue depth).
Return ONLY JSON:
{
  "score": <0..100>,
  "passed": <boolean>,
  "summary": "<2-4 sentences debrief>",
  "strengths": ["..."],
  "improvements": ["..."],
  "criteria": [{"key": "<rubric key>", "score": <number>, "max_score": <number>}],
  "feedback": {"phase_coverage": "<brief>"}
}
Default FAIL. PASS only for strong, coherent designs with explicit tradeoffs.`

func (j *LLMJudge) evaluateSystemDesign(ctx context.Context, in Input) (*Output, error) {
	dossier := formatSDDossier(in.AnswerText)
	criteriaJSON, _ := json.Marshal(in.Criteria)
	text := fmt.Sprintf(
		"Task: %s\nDescription:\n%s\n\nRubric criteria (JSON):\n%s\n\nSystem design dossier (JSON):\n%s",
		in.TaskTitle, in.TaskDescription, string(criteriaJSON), dossier,
	)
	userMsg := llmchain.Message{Role: llmchain.RoleUser, Content: text}
	if png := in.DiagramPNGURL; png != "" {
		if data := pngURLToBytes(png); len(data) > 0 {
			userMsg.Images = []llmchain.Image{{MimeType: "image/png", Data: data}}
			userMsg.Content += "\n\nArchitecture diagram PNG attached — grade diagram quality and consistency with the dossier."
		}
	}

	start := time.Now()
	resp, err := j.chain.Chat(ctx, llmchain.Request{
		Task:        llmchain.TaskSysDesignCritique,
		UserTier:    in.UserTier,
		Temperature: 0.3,
		MaxTokens:   1000,
		JSONMode:    true,
		Messages: []llmchain.Message{
			{Role: llmchain.RoleSystem, Content: sdEvalSystemPrompt},
			userMsg,
		},
	})
	call := callRecordFromResponse("sd_final_eval", resp, start, err)
	if err != nil {
		return nil, fmt.Errorf("sd evaluation: %w", err)
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
		return nil, err
	}
	if parsed.Score < 0 {
		parsed.Score = 0
	}
	if parsed.Score > 100 {
		parsed.Score = 100
	}
	raw, _ := json.Marshal(parsed)
	call.ParsedResult = raw

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
		if score > maxScore {
			score = maxScore
		}
		criteria = append(criteria, CriterionScore{Key: c.Key, Score: score, MaxScore: maxScore})
	}
	if len(criteria) == 0 {
		criteria = fallbackCriterionScores(in, parsed.Score)
	}

	passed := parsed.Score >= 70
	if parsed.Passed != nil {
		passed = *parsed.Passed
	}
	summary := strings.TrimSpace(parsed.Summary)
	if summary == "" {
		summary = "System design evaluation completed."
	}
	feedback := parsed.Feedback
	if feedback == nil {
		feedback = map[string]any{}
	}
	feedback["evaluation_mode"] = "system_design_dossier"
	if len(userMsg.Images) > 0 {
		feedback["vision_used"] = true
	}

	result := &evaluationmodel.EvaluationResult{
		Score:        parsed.Score,
		Passed:       &passed,
		Summary:      summary,
		Strengths:    parsed.Strengths,
		Improvements: parsed.Improvements,
		Feedback:     feedback,
	}

	return &Output{Result: result, Criteria: criteria, Calls: []CallRecord{call}}, nil
}

func formatSDDossier(answerText string) string {
	answerText = strings.TrimSpace(answerText)
	if answerText == "" {
		return "{}"
	}
	var m map[string]any
	if err := json.Unmarshal([]byte(answerText), &m); err != nil {
		return answerText
	}
	b, err := json.MarshalIndent(m, "", "  ")
	if err != nil {
		return answerText
	}
	return string(b)
}

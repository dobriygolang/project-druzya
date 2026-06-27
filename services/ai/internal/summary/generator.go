package summary

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/sedorofeevd/project-druzya/services/ai/internal/adapter/llm/llmchain"
)

// SkillScore is input for profile summary generation.
type SkillScore struct {
	SkillKey   string
	Score      int
	Confidence int
}

// Input holds dashboard context for summary generation.
type Input struct {
	UserID         string
	ReadinessScore int
	Skills         []SkillScore
}

const systemPrompt = `Ты карьерный коуч для технических интервью. Напиши 2-3 предложения на русском: сильные стороны, слабые зоны, следующий шаг. Без markdown.`

// Generator produces human-readable profile summaries.
type Generator struct {
	chain llmchain.ChatClient
}

// New creates a summary generator. Nil chain uses deterministic fallback.
func New(chain llmchain.ChatClient) *Generator {
	return &Generator{chain: chain}
}

// Generate returns a profile summary text.
func (g *Generator) Generate(ctx context.Context, in Input) (string, error) {
	if g.chain == nil {
		return fallback(in), nil
	}
	payload, _ := json.Marshal(in)
	resp, err := g.chain.Chat(ctx, llmchain.Request{
		Task: llmchain.TaskInsightProse,
		Messages: []llmchain.Message{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: string(payload)},
		},
	})
	if err != nil {
		return fallback(in), nil
	}
	text := strings.TrimSpace(resp.Content)
	if text == "" {
		return fallback(in), nil
	}
	return text, nil
}

func fallback(in Input) string {
	var weak, strong string
	for _, s := range in.Skills {
		if s.Confidence < 20 {
			continue
		}
		if s.Score >= 80 && strong == "" {
			strong = s.SkillKey
		}
		if s.Score < 65 && weak == "" {
			weak = s.SkillKey
		}
	}
	if strong != "" && weak != "" {
		return fmt.Sprintf("Readiness %d%%. Сильная зона: %s. Сфокусируйся на: %s.", in.ReadinessScore, strong, weak)
	}
	return fmt.Sprintf("Readiness %d%%. Продолжай практику по плану обучения.", in.ReadinessScore)
}

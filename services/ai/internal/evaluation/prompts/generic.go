package prompts

import (
	"fmt"
	"strings"

	contentadapter "github.com/sedorofeevd/project-druzya/services/ai/internal/adapter/content"
	interviewadapter "github.com/sedorofeevd/project-druzya/services/ai/internal/adapter/interview"
)

const evaluationJSONSchema = `{
  "score": number (0-100),
  "passed": boolean (optional),
  "summary": string,
  "strengths": string[],
  "improvements": string[],
  "feedback": object (optional criterion-level notes)
}`

// BuildPrompt assembles the LLM user prompt for an attempt evaluation.
func BuildPrompt(attempt *interviewadapter.Attempt, bundle *contentadapter.TaskBundle) (system string, user string) {
	system = strings.TrimSpace(genericSystemPrompt() + "\n\n" + typeSpecificInstructions(bundle.Task.Type))
	user = buildUserPrompt(attempt, bundle)
	return system, user
}

func genericSystemPrompt() string {
	return `You are an expert technical interviewer evaluating a candidate's answer.
Score the submission against the rubric criteria. Be fair, specific, and constructive.
Respond with JSON only, no markdown fences. Schema:
` + evaluationJSONSchema
}

func buildUserPrompt(attempt *interviewadapter.Attempt, bundle *contentadapter.TaskBundle) string {
	var b strings.Builder
	task := bundle.Task

	fmt.Fprintf(&b, "Task type: %s\n", task.Type)
	fmt.Fprintf(&b, "Title: %s\n", task.Title)
	if task.Description != "" {
		fmt.Fprintf(&b, "Description:\n%s\n\n", task.Description)
	}
	if task.Difficulty != "" {
		fmt.Fprintf(&b, "Difficulty: %s\n", task.Difficulty)
	}

	if bundle.Rubric != nil {
		fmt.Fprintf(&b, "\nRubric: %s (v%d)\n", bundle.Rubric.Title, bundle.Rubric.Version)
		for _, c := range bundle.Criteria {
			desc := ""
			if c.Description != nil {
				desc = *c.Description
			}
			fmt.Fprintf(&b, "- [%s] %s (weight=%d, max=%d)", c.Key, c.Title, c.Weight, c.MaxScore)
			if desc != "" {
				fmt.Fprintf(&b, ": %s", desc)
			}
			b.WriteByte('\n')
		}
	}

	if len(bundle.Solutions) > 0 {
		b.WriteString("\nReference solutions (for evaluator context only, not shown to candidate):\n")
		for i, sol := range bundle.Solutions {
			lang := "any"
			if sol.Language != nil && *sol.Language != "" {
				lang = *sol.Language
			}
			fmt.Fprintf(&b, "%d. [%s] %s\n", i+1, lang, sol.SolutionText)
		}
	}

	b.WriteString("\nCandidate submission:\n")
	if attempt.AnswerText != nil && *attempt.AnswerText != "" {
		fmt.Fprintf(&b, "Answer text:\n%s\n", *attempt.AnswerText)
	}
	if attempt.Code != nil && *attempt.Code != "" {
		lang := "code"
		if attempt.Language != nil && *attempt.Language != "" {
			lang = *attempt.Language
		}
		fmt.Fprintf(&b, "Code (%s):\n%s\n", lang, *attempt.Code)
	}
	if len(attempt.Attachments) > 0 {
		fmt.Fprintf(&b, "Attachments JSON: %s\n", string(attempt.Attachments))
	}

	return b.String()
}

package prompts

import "strings"

func typeSpecificInstructions(taskType string) string {
	switch strings.ToLower(strings.TrimSpace(taskType)) {
	case "algorithm", "live_coding":
		return `For coding tasks: assess correctness, edge cases, complexity analysis, code quality, and whether the approach matches the problem constraints.`
	case "system_design":
		return `For system design: assess requirements clarity, architecture, scalability, trade-offs, data modeling, and operational concerns.`
	case "behavioral":
		return `For behavioral answers: assess STAR structure, relevance, depth, and communication clarity.`
	case "sql":
		return `For SQL tasks: assess query correctness, performance considerations, readability, and handling of edge cases.`
	default:
		return `Evaluate the answer holistically against the rubric criteria and reference solutions where applicable.`
	}
}

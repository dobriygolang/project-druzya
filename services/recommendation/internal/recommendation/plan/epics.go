package plan

import "strings"

const (
	EpicRetries  = "Retries"
	EpicReview   = "Review"
	EpicLearning = "Learning"
	EpicSkills   = "Skills"
	EpicMock     = "Mock"
)

func IsEpicDeferred(epicName string, deferred []string) bool {
	name := strings.TrimSpace(epicName)
	if name == "" || len(deferred) == 0 {
		return false
	}
	for _, d := range deferred {
		if strings.EqualFold(strings.TrimSpace(d), name) {
			return true
		}
	}
	return false
}

package recommendation

import "context"

// ReviewCandidate is a task the user should revisit for spaced repetition.
type ReviewCandidate struct {
	TaskID    string
	TaskType  string
	BestScore int
}

// Client reads task-picker hints from recommendation-service.
//
//go:generate go run github.com/vektra/mockery/v2@v2.53.5 --case=underscore --with-expecter --name=Client --output=./mocks --outpkg=mocks --filename=client.go
type Client interface {
	GetTaskPickerHints(ctx context.Context, userID, taskType string) (passedTaskIDs []string, reviewCandidates []ReviewCandidate, err error)
}

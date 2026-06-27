package events

import "context"

// Name identifies interview domain events.
type Name string

const (
	SessionStarted      Name = "interview.session_started"
	AttemptSubmitted    Name = "interview.attempt_submitted"
	AttemptEvaluated    Name = "interview.attempt_evaluated"
	SessionCompleted    Name = "interview.session_completed"
	RetryItemCreated    Name = "interview.retry_item_created"
	TaskSkipped         Name = "interview.task_skipped"
)

// Event is a domain event payload.
type Event struct {
	Name    Name
	Payload map[string]any
}

// Publisher emits domain events (outbox/databus adapter later).
//
//go:generate go run github.com/vektra/mockery/v2@v2.53.5 --case=underscore --with-expecter --name=Publisher --output=./mocks --outpkg=mocks --filename=publisher.go
type Publisher interface {
	Publish(ctx context.Context, event Event) error
}

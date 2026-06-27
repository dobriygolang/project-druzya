package content

import "context"

// Task is catalog task metadata.
type Task struct {
	ID          string
	Slug        string
	Type        string
	Title       string
	Description string
	Difficulty  string
	Status      string
}

// Solution is a reference solution.
type Solution struct {
	Language     *string
	SolutionText string
	Explanation  *string
	Complexity   *string
	IsPrimary    bool
}

// Rubric is scoring rubric metadata.
type Rubric struct {
	ID       string
	TaskType string
	Title    string
	Version  int
}

// RubricCriterion is one rubric criterion.
type RubricCriterion struct {
	Key         string
	Title       string
	Description *string
	Weight      int
	MaxScore    int
	Position    int
}

// TaskBundle aggregates task data for evaluation.
type TaskBundle struct {
	Task      *Task
	Solutions []Solution
	Rubric    *Rubric
	Criteria  []RubricCriterion
}

// Client reads catalog data from content-service.
//
//go:generate go run github.com/vektra/mockery/v2@v2.53.5 --case=underscore --with-expecter --name=Client --output=./mocks --outpkg=mocks --filename=client.go
type Client interface {
	GetTaskBundle(ctx context.Context, taskID string) (*TaskBundle, error)
}

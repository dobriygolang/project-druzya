package evaluator_test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/sedorofeevd/project-druzya/services/ai/internal/evaluation/evaluator"
)

func TestFakeClient_Evaluate(t *testing.T) {
	t.Parallel()

	out, err := evaluator.NewFakeClient().Evaluate(context.Background(), evaluator.Input{
		TaskType:    "algorithm",
		TaskTitle:   "Two Sum",
		AnswerText:  "use hash map",
	})
	require.NoError(t, err)
	require.NotNil(t, out.Result)
	require.Equal(t, float64(75), out.Result.Score)
	require.Len(t, out.Calls, 1)
}

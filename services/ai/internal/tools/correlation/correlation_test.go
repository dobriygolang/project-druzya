package correlation_test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/sedorofeevd/project-druzya/services/ai/internal/tools/correlation"
	"google.golang.org/grpc/metadata"
)

func TestWithAttemptID_RoundTrip(t *testing.T) {
	t.Parallel()

	ctx := correlation.WithAttemptID(context.Background(), "attempt-1")
	require.Equal(t, "attempt-1", correlation.AttemptIDFromContext(ctx))
}

func TestAppendOutgoing_AttachesMetadata(t *testing.T) {
	t.Parallel()

	ctx := correlation.WithAttemptID(context.Background(), "attempt-2")
	out := correlation.AppendOutgoing(ctx)
	md, ok := metadata.FromOutgoingContext(out)
	require.True(t, ok)
	require.Equal(t, []string{"attempt-2"}, md.Get(correlation.MetadataKey))
}

func TestFromIncoming_ReadsMetadata(t *testing.T) {
	t.Parallel()

	in := metadata.NewIncomingContext(context.Background(), metadata.Pairs(correlation.MetadataKey, "attempt-3"))
	ctx := correlation.FromIncoming(in)
	require.Equal(t, "attempt-3", correlation.AttemptIDFromContext(ctx))
}

package correlation

import (
	"context"

	"google.golang.org/grpc/metadata"
)

// MetadataKey is propagated on internal gRPC for eval tracing.
const MetadataKey = "x-attempt-id"

type ctxKey struct{}

// WithAttemptID stores attempt_id in context for logs and outbound gRPC.
func WithAttemptID(ctx context.Context, attemptID string) context.Context {
	if attemptID == "" {
		return ctx
	}
	return context.WithValue(ctx, ctxKey{}, attemptID)
}

// AttemptIDFromContext returns the correlated attempt_id, if any.
func AttemptIDFromContext(ctx context.Context) string {
	if v, ok := ctx.Value(ctxKey{}).(string); ok {
		return v
	}
	return ""
}

// FromIncoming reads x-attempt-id from gRPC metadata into context.
func FromIncoming(ctx context.Context) context.Context {
	md, ok := metadata.FromIncomingContext(ctx)
	if !ok {
		return ctx
	}
	vals := md.Get(MetadataKey)
	if len(vals) == 0 || vals[0] == "" {
		return ctx
	}
	return WithAttemptID(ctx, vals[0])
}

// AppendOutgoing attaches x-attempt-id from context to outgoing gRPC metadata.
func AppendOutgoing(ctx context.Context) context.Context {
	if id := AttemptIDFromContext(ctx); id != "" {
		return metadata.AppendToOutgoingContext(ctx, MetadataKey, id)
	}
	return ctx
}

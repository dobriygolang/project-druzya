package billing

import (
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// MapGRPCError maps gRPC errors to domain errors.
func MapGRPCError(err error) error {
	if err == nil {
		return nil
	}
	st, ok := status.FromError(err)
	if !ok {
		return err
	}
	switch st.Code() {
	case codes.NotFound:
		return ErrNotFound
	default:
		return err
	}
}

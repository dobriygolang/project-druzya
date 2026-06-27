package interview

import (
	"errors"
	"fmt"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

var (
	// ErrNotFound is returned when interview entity is missing.
	ErrNotFound = errors.New("not found")
)

// MapGRPCError converts gRPC errors to domain adapter errors.
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
		return fmt.Errorf("%w: %s", ErrNotFound, st.Message())
	case codes.InvalidArgument:
		return fmt.Errorf("invalid argument: %s", st.Message())
	case codes.FailedPrecondition, codes.Aborted:
		return fmt.Errorf("conflict: %s", st.Message())
	default:
		return err
	}
}

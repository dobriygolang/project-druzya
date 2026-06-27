package interview

import (
	"errors"
	"fmt"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// ErrNotFound is returned when interview resource is missing.
var ErrNotFound = errors.New("not found")

// ErrUnavailable marks transient upstream failures.
var ErrUnavailable = errors.New("interview unavailable")

// MapGRPCError converts gRPC errors to adapter errors.
func MapGRPCError(err error) error {
	if err == nil {
		return nil
	}
	if st, ok := status.FromError(err); ok {
		switch st.Code() {
		case codes.NotFound:
			return ErrNotFound
		case codes.Unavailable, codes.DeadlineExceeded:
			return fmt.Errorf("%w: %s", ErrUnavailable, st.Message())
		case codes.InvalidArgument:
			return err
		case codes.Unauthenticated, codes.PermissionDenied:
			return err
		}
	}
	return err
}

package content

import (
	"errors"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// ErrNotFound is returned when content entity is missing.
var ErrNotFound = errors.New("not found")

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
	case codes.InvalidArgument:
		return err
	case codes.Unauthenticated, codes.PermissionDenied:
		return err
	default:
		return err
	}
}

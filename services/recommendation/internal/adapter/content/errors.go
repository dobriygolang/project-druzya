package content

import (
	"errors"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// ErrNotFound is returned when content resource is missing.
var ErrNotFound = errors.New("not found")

// MapGRPCError converts gRPC errors to adapter errors.
func MapGRPCError(err error) error {
	if err == nil {
		return nil
	}
	if st, ok := status.FromError(err); ok {
		switch st.Code() {
		case codes.NotFound:
			return ErrNotFound
		}
	}
	return err
}

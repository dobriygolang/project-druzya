package content

import (
	"errors"
	"fmt"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// ErrNotFound is returned when content-service has no matching entity.
var ErrNotFound = errors.New("content not found")

func mapGRPCError(err error) error {
	if err == nil {
		return nil
	}
	if st, ok := status.FromError(err); ok {
		switch st.Code() {
		case codes.NotFound:
			return fmt.Errorf("%w: %s", ErrNotFound, st.Message())
		case codes.InvalidArgument:
			return fmt.Errorf("content invalid argument: %s", st.Message())
		}
	}
	return err
}

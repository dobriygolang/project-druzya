package sandboxapi

import (
	"errors"

	sandboxservice "github.com/sedorofeevd/project-druzya/services/sandbox/internal/sandbox/service"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

func mapServiceError(err error) error {
	if err == nil {
		return nil
	}
	switch {
	case errors.Is(err, sandboxservice.ErrInvalidInput):
		return status.Error(codes.InvalidArgument, err.Error())
	case errors.Is(err, sandboxservice.ErrForbidden):
		return status.Error(codes.PermissionDenied, err.Error())
	case errors.Is(err, sandboxservice.ErrNotFound):
		return status.Error(codes.NotFound, err.Error())
	case errors.Is(err, sandboxservice.ErrQuotaExceeded):
		return status.Error(codes.FailedPrecondition, "quota exceeded")
	case errors.Is(err, sandboxservice.ErrFeatureDisabled):
		return status.Error(codes.FailedPrecondition, "feature not available on current plan")
	default:
		return status.Error(codes.Internal, err.Error())
	}
}

func unauthorized() error {
	return status.Error(codes.Unauthenticated, "unauthorized")
}

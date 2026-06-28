package adminapi

import (
	"errors"

	adminservice "github.com/sedorofeevd/project-druzya/services/admin/internal/admin/service"
	contentadapter "github.com/sedorofeevd/project-druzya/services/admin/internal/adapter/content"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

func invalidArgument(message string) error {
	return status.Error(codes.InvalidArgument, message)
}

func unauthorized() error {
	return status.Error(codes.Unauthenticated, "unauthorized")
}

func permissionDenied() error {
	return status.Error(codes.PermissionDenied, "admin access required")
}

func notFound(message string) error {
	return status.Error(codes.NotFound, message)
}

func mapServiceError(err error) error {
	if err == nil {
		return nil
	}
	switch {
	case errors.Is(err, adminservice.ErrInvalidInput):
		return invalidArgument(err.Error())
	case errors.Is(err, adminservice.ErrNotFound), errors.Is(err, contentadapter.ErrNotFound):
		return notFound("not found")
	case errors.Is(err, adminservice.ErrVersionConflict):
		return status.Error(codes.FailedPrecondition, "version conflict — reload and retry")
	default:
		return status.Error(codes.Internal, "internal error")
	}
}

package billingapi

import (
	"errors"

	billingservice "github.com/sedorofeevd/project-druzya/services/billing/internal/billing/service"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

func mapServiceError(err error) error {
	if err == nil {
		return nil
	}
	switch {
	case errors.Is(err, billingservice.ErrInvalidInput):
		return status.Error(codes.InvalidArgument, err.Error())
	case errors.Is(err, billingservice.ErrNotFound):
		return status.Error(codes.NotFound, err.Error())
	case errors.Is(err, billingservice.ErrUnknownUser):
		return status.Error(codes.NotFound, err.Error())
	case errors.Is(err, billingservice.ErrDuplicateEvent):
		return status.Error(codes.AlreadyExists, err.Error())
	default:
		return status.Error(codes.Internal, err.Error())
	}
}

func unauthorized() error {
	return status.Error(codes.Unauthenticated, "unauthorized")
}

func invalidArgument(msg string) error {
	return status.Error(codes.InvalidArgument, msg)
}

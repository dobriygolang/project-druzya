package recommendationapi

import (
	"errors"

	recommendationrepo "github.com/sedorofeevd/project-druzya/services/recommendation/internal/recommendation/repository"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

func invalidArgument(message string) error {
	return status.Error(codes.InvalidArgument, message)
}

func notFound(message string) error {
	return status.Error(codes.NotFound, message)
}

func unauthorized() error {
	return status.Error(codes.Unauthenticated, "unauthorized")
}

func mapServiceError(err error) error {
	if err == nil {
		return nil
	}
	if errors.Is(err, recommendationrepo.ErrNotFound) {
		return notFound("resource not found")
	}
	return status.Errorf(codes.Internal, "internal error: %v", err)
}

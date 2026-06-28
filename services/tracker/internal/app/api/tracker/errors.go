package trackerapi

import (
	"errors"
	"net/http"

	"github.com/sedorofeevd/project-druzya/services/tracker/internal/tracker/model"
	"github.com/sedorofeevd/project-druzya/services/tracker/internal/tools/humanerror"
	"github.com/sedorofeevd/project-druzya/services/tracker/internal/tracker/repository"
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
	if errors.Is(err, repository.ErrNotFound) {
		return notFound("resource not found")
	}
	if errors.Is(err, model.ErrInvalidArgument) {
		return invalidArgument(err.Error())
	}
	return status.Errorf(codes.Internal, "internal error: %v", err)
}

func writeHTTPError(w http.ResponseWriter, err error) {
	humanerror.WriteHTTP(w, err)
}

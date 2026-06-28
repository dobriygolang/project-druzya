package aiapi

import (
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

func failedPrecondition(message string) error {
	return status.Error(codes.FailedPrecondition, message)
}

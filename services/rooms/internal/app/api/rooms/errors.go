package roomsapi

import (
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

func notFound(message string) error {
	return status.Error(codes.NotFound, message)
}

func unauthorized() error {
	return status.Error(codes.Unauthenticated, "unauthorized")
}

func permissionDenied(message string) error {
	return status.Error(codes.PermissionDenied, message)
}

func failedPrecondition(message string) error {
	return status.Error(codes.FailedPrecondition, message)
}

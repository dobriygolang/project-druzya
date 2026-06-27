package humanerror

import (
	"encoding/json"
	"errors"
	"net/http"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type response struct {
	Error string `json:"error"`
}

// WriteHTTP maps an error to JSON and status code compatible with frontend clients.
func WriteHTTP(w http.ResponseWriter, err error) {
	st, message := toStatus(err)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(runtimeHTTPStatus(st.Code()))
	_ = json.NewEncoder(w).Encode(response{Error: message})
}

func toStatus(err error) (*status.Status, string) {
	if err == nil {
		return status.New(codes.Internal, "internal error"), "internal error"
	}

	if st, ok := status.FromError(err); ok {
		return st, st.Message()
	}

	return status.New(codes.Internal, "internal error"), "internal error"
}

func runtimeHTTPStatus(code codes.Code) int {
	switch code {
	case codes.InvalidArgument:
		return http.StatusBadRequest
	case codes.Unauthenticated:
		return http.StatusUnauthorized
	case codes.NotFound:
		return http.StatusNotFound
	case codes.FailedPrecondition:
		return http.StatusPreconditionFailed
	default:
		return http.StatusInternalServerError
	}
}

// SanitizeGRPC converts unknown errors into internal gRPC errors for clients.
func SanitizeGRPC(err error) error {
	if err == nil {
		return nil
	}
	if _, ok := status.FromError(err); ok {
		return err
	}
	return status.Error(codes.Internal, "internal error")
}

// IsGRPCCode reports whether err is a gRPC status with the given code.
func IsGRPCCode(err error, code codes.Code) bool {
	st, ok := status.FromError(err)
	return ok && st.Code() == code
}

// UnwrapForLog returns the root error for server-side logging.
func UnwrapForLog(err error) error {
	return errors.Unwrap(err)
}

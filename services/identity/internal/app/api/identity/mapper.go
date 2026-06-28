package identityapi

import (
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/sedorofeevd/project-druzya/services/identity/internal/adapter/telegram"
	"github.com/sedorofeevd/project-druzya/services/identity/internal/user/model"
	authservice "github.com/sedorofeevd/project-druzya/services/identity/internal/auth/service"
	"github.com/sedorofeevd/project-druzya/services/identity/internal/tools/humanerror"
	identityv1 "github.com/sedorofeevd/project-druzya/services/identity/pkg/api/identity/v1"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"
)

func toProtoUser(user *model.User) *identityv1.User {
	if user == nil {
		return nil
	}
	out := &identityv1.User{
		Id:        user.ID,
		Username:  user.Username,
		AvatarUrl: publicAvatarURL(user),
		CreatedAt: timestamppb.New(user.CreatedAt),
	}
	if user.TelegramID != nil {
		out.TelegramId = *user.TelegramID
	}
	return out
}

func publicAvatarURL(user *model.User) string {
	if user == nil {
		return ""
	}
	if user.AvatarURL == "" {
		return ""
	}
	if path, ok := telegram.ParseStoreRef(user.AvatarURL); ok && path != "" {
		return fmt.Sprintf("/v1/users/%s/avatar", user.ID)
	}
	if telegram.IsLegacyFakeURL(user.AvatarURL) && user.TelegramID != nil {
		return fmt.Sprintf("/v1/users/%s/avatar", user.ID)
	}
	if strings.HasPrefix(user.AvatarURL, "/v1/users/") {
		return user.AvatarURL
	}
	return user.AvatarURL
}

func toAuthResponse(result *authservice.AuthResult) *identityv1.AuthResponse {
	return &identityv1.AuthResponse{
		AccessToken:  result.AccessToken,
		RefreshToken: result.RefreshToken,
		User:         toProtoUser(result.User),
	}
}

func mapServiceError(err error) error {
	switch {
	case errors.Is(err, authservice.ErrNotFound):
		return notFound(err.Error())
	case errors.Is(err, authservice.ErrUnauthorized):
		return unauthorized()
	case errors.Is(err, authservice.ErrInvalidLoginCode),
		errors.Is(err, authservice.ErrInvalidRefreshToken),
		errors.Is(err, authservice.ErrInvalidOAuthState),
		errors.Is(err, authservice.ErrInvalidExchangeCode):
		return status.Error(codes.InvalidArgument, err.Error())
	case errors.Is(err, authservice.ErrProviderAlreadyLinked):
		return failedPrecondition(err.Error())
	default:
		return status.Error(codes.Internal, "internal error")
	}
}

func writeHTTPError(w http.ResponseWriter, err error) {
	humanerror.WriteHTTP(w, err)
}

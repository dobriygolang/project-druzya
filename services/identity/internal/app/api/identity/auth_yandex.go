package identityapi

import (
	"context"

	identityv1 "github.com/sedorofeevd/project-druzya/services/identity/pkg/api/identity/v1"
)

// GetYandexAuthURL returns the Yandex OAuth URL and state.
func (i *Implementation) GetYandexAuthURL(ctx context.Context, _ *identityv1.GetYandexAuthURLRequest) (*identityv1.GetYandexAuthURLResponse, error) {
	linkUserID := ""
	if token := BearerTokenFromContext(ctx); token != "" {
		userID, err := i.service.ValidateToken(ctx, token)
		if err != nil {
			return nil, unauthorized()
		}
		linkUserID = userID
	}

	url, state, err := i.service.GetYandexAuthURL(ctx, linkUserID)
	if err != nil {
		return nil, mapServiceError(err)
	}

	return &identityv1.GetYandexAuthURLResponse{
		Url:   url,
		State: state,
	}, nil
}

// YandexCallback handles the OAuth callback over gRPC (browser flow uses HTTP handler).
func (i *Implementation) YandexCallback(ctx context.Context, req *identityv1.YandexCallbackRequest) (*identityv1.YandexCallbackResponse, error) {
	if req.GetCode() == "" || req.GetState() == "" {
		return nil, invalidArgument("code and state are required")
	}

	redirectURL, err := i.service.HandleYandexCallback(ctx, req.GetCode(), req.GetState())
	if err != nil {
		return nil, mapServiceError(err)
	}

	return &identityv1.YandexCallbackResponse{RedirectUrl: redirectURL}, nil
}

// ExchangeYandexCode exchanges a one-time callback code for tokens.
func (i *Implementation) ExchangeYandexCode(ctx context.Context, req *identityv1.ExchangeYandexCodeRequest) (*identityv1.AuthResponse, error) {
	if req.GetExchangeCode() == "" {
		return nil, invalidArgument("exchange_code is required")
	}

	result, err := i.service.ExchangeYandexCode(ctx, req.GetExchangeCode())
	if err != nil {
		return nil, mapServiceError(err)
	}
	return toAuthResponse(result), nil
}

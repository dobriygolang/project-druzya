package service

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/sedorofeevd/project-druzya/services/identity/internal/adapter/yandex"
	authrepo "github.com/sedorofeevd/project-druzya/services/identity/internal/auth/repository"
	authmodel "github.com/sedorofeevd/project-druzya/services/identity/internal/auth/model"
	"github.com/sedorofeevd/project-druzya/services/identity/internal/user/model"
	userrepo "github.com/sedorofeevd/project-druzya/services/identity/internal/user/repository"
)

const (
	loginCodeTTLSeconds    = 300
	oauthStateTTLSeconds   = 600
	exchangeCodeTTLSeconds = 300
)

// AuthResult is returned after successful authentication.
type AuthResult struct {
	AccessToken  string
	RefreshToken string
	User         *model.User
}

// Service handles identity authentication and user operations.
type Service interface {
	AuthTelegram(ctx context.Context, code string) (*AuthResult, error)
	GetYandexAuthURL(ctx context.Context, linkUserID string) (url, state string, err error)
	HandleYandexCallback(ctx context.Context, code, state string) (redirectURL string, err error)
	ExchangeYandexCode(ctx context.Context, exchangeCode string) (*AuthResult, error)
	RefreshToken(ctx context.Context, refreshToken string) (*AuthResult, error)
	Logout(ctx context.Context, refreshToken string) error
	GetMe(ctx context.Context, userID string) (*model.User, error)
	UpdateMe(ctx context.Context, userID string, timezone *string) (*model.User, error)
	LinkYandex(ctx context.Context, userID, code string) (*model.User, error)
	GetUser(ctx context.Context, id string) (*model.User, error)
	GetUserByTelegramID(ctx context.Context, telegramID int64) (*model.User, error)
	ValidateToken(ctx context.Context, accessToken string) (string, error)
	MintScopedAccessToken(ctx context.Context, role, scope, displayName string, ttlSeconds int32) (accessToken, userID string, expiresIn int32, err error)
}

// Deps lists dependencies for the identity service.
type Deps struct {
	Users         *userrepo.Repository
	LoginCodes    *authrepo.LoginCodeRepository
	RefreshTokens *authrepo.RefreshTokenRepository
	OAuthStates   *authrepo.OAuthStateRepository
	ExchangeCodes *authrepo.ExchangeCodeRepository
	Yandex        *yandex.Client
	Tokens        *TokenManager
	FrontendURL   string
	Log           interface {
		Info(msg string, keysAndValues ...any)
		Error(msg string, keysAndValues ...any)
	}
}

type service struct {
	users         *userrepo.Repository
	loginCodes    *authrepo.LoginCodeRepository
	refreshTokens *authrepo.RefreshTokenRepository
	oauthStates   *authrepo.OAuthStateRepository
	exchangeCodes *authrepo.ExchangeCodeRepository
	yandex        *yandex.Client
	tokens        *TokenManager
	frontendURL   string
	log           interface {
		Info(msg string, keysAndValues ...any)
		Error(msg string, keysAndValues ...any)
	}
}

// New constructs the identity service.
func New(deps Deps) Service {
	return &service{
		users:         deps.Users,
		loginCodes:    deps.LoginCodes,
		refreshTokens: deps.RefreshTokens,
		oauthStates:   deps.OAuthStates,
		exchangeCodes: deps.ExchangeCodes,
		yandex:        deps.Yandex,
		tokens:        deps.Tokens,
		frontendURL:   deps.FrontendURL,
		log:           deps.Log,
	}
}

func isUserNotFound(err error) bool {
	return errors.Is(err, userrepo.ErrNotFound)
}

func isAuthNotFound(err error) bool {
	return errors.Is(err, authrepo.ErrNotFound)
}

func (s *service) AuthTelegram(ctx context.Context, code string) (*AuthResult, error) {
	loginCode, err := s.loginCodes.Consume(ctx, code)
	if err != nil {
		if isAuthNotFound(err) {
			return nil, ErrInvalidLoginCode
		}
		return nil, err
	}

	user, err := s.users.GetByTelegramID(ctx, loginCode.TelegramID)
	if err != nil && !isUserNotFound(err) {
		return nil, err
	}

	if user == nil {
		username, err := AllocateUsername(ctx, s.users, telegramUsernameCandidates(
			loginCode.FirstName,
			loginCode.LastName,
			loginCode.Username,
		)...)
		if err != nil {
			return nil, err
		}

		telegramID := loginCode.TelegramID
		user, err = s.users.Create(ctx, &model.User{
			Username:   username,
			TelegramID: &telegramID,
			AvatarURL:  loginCode.AvatarURL,
		})
		if err != nil {
			// A concurrent login may have created this user first; recover by
			// fetching the winner instead of surfacing a unique-violation error.
			if errors.Is(err, userrepo.ErrAlreadyExists) {
				user, err = s.users.GetByTelegramID(ctx, telegramID)
			}
			if err != nil {
				return nil, err
			}
		}
	} else if loginCode.AvatarURL != "" {
		user.AvatarURL = pickAvatar(user.AvatarURL, loginCode.AvatarURL, "")
		user, err = s.users.Update(ctx, user)
		if err != nil {
			return nil, err
		}
	}

	return s.issueTokens(ctx, user)
}

func (s *service) GetYandexAuthURL(ctx context.Context, linkUserID string) (string, string, error) {
	state, err := randomState()
	if err != nil {
		return "", "", err
	}

	oauthState := &authmodel.OAuthState{Type: authmodel.OAuthStateLogin}
	if linkUserID != "" {
		oauthState.Type = authmodel.OAuthStateLink
		oauthState.UserID = linkUserID
	}

	if err := s.oauthStates.Save(ctx, state, oauthState, oauthStateTTLSeconds); err != nil {
		return "", "", err
	}

	return s.yandex.AuthURL(state), state, nil
}

func (s *service) HandleYandexCallback(ctx context.Context, code, state string) (string, error) {
	oauthState, err := s.oauthStates.Consume(ctx, state)
	if err != nil {
		if isAuthNotFound(err) {
			return "", ErrInvalidOAuthState
		}
		return "", err
	}

	profile, err := s.yandex.ExchangeCode(ctx, code)
	if err != nil {
		return "", err
	}

	var user *model.User
	switch oauthState.Type {
	case authmodel.OAuthStateLink:
		user, err = s.linkYandexProfile(ctx, oauthState.UserID, profile)
	default:
		user, err = s.upsertYandexUser(ctx, profile)
	}
	if err != nil {
		return "", err
	}

	exchangeCode, err := randomState()
	if err != nil {
		return "", err
	}
	if err := s.exchangeCodes.Save(ctx, exchangeCode, user.ID, exchangeCodeTTLSeconds); err != nil {
		return "", err
	}

	redirectURL := fmt.Sprintf("%s/auth/callback?code=%s", trimTrailingSlash(s.frontendURL), exchangeCode)
	return redirectURL, nil
}

func (s *service) ExchangeYandexCode(ctx context.Context, exchangeCode string) (*AuthResult, error) {
	userID, err := s.exchangeCodes.Consume(ctx, exchangeCode)
	if err != nil {
		if isAuthNotFound(err) {
			return nil, ErrInvalidExchangeCode
		}
		return nil, err
	}

	user, err := s.users.GetByID(ctx, userID)
	if err != nil {
		return nil, err
	}

	return s.issueTokens(ctx, user)
}

func (s *service) RefreshToken(ctx context.Context, refreshToken string) (*AuthResult, error) {
	userID, err := s.refreshTokens.GetUserID(ctx, HashRefreshToken(refreshToken))
	if err != nil {
		if isAuthNotFound(err) {
			return nil, ErrInvalidRefreshToken
		}
		return nil, err
	}

	user, err := s.users.GetByID(ctx, userID)
	if err != nil {
		return nil, err
	}

	result, err := s.issueTokens(ctx, user)
	if err != nil {
		return nil, err
	}

	// Best-effort rotation: if deleting the old token fails it stays valid until
	// TTL expiry, so log it for visibility instead of dropping the error.
	if err := s.refreshTokens.Delete(ctx, HashRefreshToken(refreshToken)); err != nil && s.log != nil {
		s.log.Error("failed to delete rotated refresh token", "err", err)
	}
	return result, nil
}

func (s *service) Logout(ctx context.Context, refreshToken string) error {
	if refreshToken == "" {
		return nil
	}
	return s.refreshTokens.Delete(ctx, HashRefreshToken(refreshToken))
}

func (s *service) GetMe(ctx context.Context, userID string) (*model.User, error) {
	user, err := s.users.GetByID(ctx, userID)
	if err != nil {
		if isUserNotFound(err) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return user, nil
}

func (s *service) UpdateMe(ctx context.Context, userID string, timezone *string) (*model.User, error) {
	user, err := s.users.GetByID(ctx, userID)
	if err != nil {
		if isUserNotFound(err) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	if timezone == nil {
		return user, nil
	}
	tz := strings.TrimSpace(*timezone)
	if tz != "" {
		if _, err := time.LoadLocation(tz); err != nil {
			return nil, ErrInvalidTimezone
		}
	}
	user.Timezone = tz
	return s.users.Update(ctx, user)
}

func (s *service) LinkYandex(ctx context.Context, userID, code string) (*model.User, error) {
	profile, err := s.yandex.ExchangeCode(ctx, code)
	if err != nil {
		return nil, err
	}
	return s.linkYandexProfile(ctx, userID, profile)
}

func (s *service) GetUser(ctx context.Context, id string) (*model.User, error) {
	user, err := s.users.GetByID(ctx, id)
	if err != nil {
		if isUserNotFound(err) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return user, nil
}

func (s *service) GetUserByTelegramID(ctx context.Context, telegramID int64) (*model.User, error) {
	if telegramID == 0 {
		return nil, ErrNotFound
	}
	user, err := s.users.GetByTelegramID(ctx, telegramID)
	if err != nil {
		if isUserNotFound(err) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return user, nil
}

func (s *service) ValidateToken(ctx context.Context, accessToken string) (string, error) {
	if accessToken == "" {
		return "", ErrUnauthorized
	}
	userID, err := s.tokens.ValidateAccessToken(accessToken)
	if err != nil {
		return "", ErrUnauthorized
	}
	if _, err := s.users.GetByID(ctx, userID); err != nil {
		if isUserNotFound(err) {
			return "", ErrUnauthorized
		}
		return "", err
	}
	return userID, nil
}

func (s *service) MintScopedAccessToken(
	_ context.Context,
	role, scope, displayName string,
	ttlSeconds int32,
) (string, string, int32, error) {
	if scope == "" {
		return "", "", 0, errors.New("scope is required")
	}
	if role == "" {
		role = "guest"
	}
	ttl := time.Duration(ttlSeconds) * time.Second
	if ttl <= 0 {
		ttl = s.tokens.AccessTTL()
	}
	guestID, err := newGuestID()
	if err != nil {
		return "", "", 0, err
	}
	token, err := s.tokens.IssueScopedAccessToken(guestID, role, scope, displayName, ttl)
	if err != nil {
		return "", "", 0, err
	}
	return token, guestID, int32(ttl.Seconds()), nil
}

func newGuestID() (string, error) {
	return uuid.New().String(), nil
}

func (s *service) upsertYandexUser(ctx context.Context, profile *yandex.Profile) (*model.User, error) {
	user, err := s.users.GetByYandexID(ctx, profile.ID)
	if err != nil && !isUserNotFound(err) {
		return nil, err
	}

	if user != nil {
		user.AvatarURL = pickAvatar(user.AvatarURL, "", profile.AvatarURL)
		return s.users.Update(ctx, user)
	}

	username, err := AllocateUsername(ctx, s.users, yandexUsernameCandidates(profile.Login, profile.DisplayName)...)
	if err != nil {
		return nil, err
	}

	yandexID := profile.ID
	created, err := s.users.Create(ctx, &model.User{
		Username:  username,
		YandexID:  &yandexID,
		AvatarURL: profile.AvatarURL,
	})
	if err != nil {
		// Concurrent login already created this user; return the winner.
		if errors.Is(err, userrepo.ErrAlreadyExists) {
			return s.users.GetByYandexID(ctx, profile.ID)
		}
		return nil, err
	}
	return created, nil
}

func (s *service) linkYandexProfile(ctx context.Context, userID string, profile *yandex.Profile) (*model.User, error) {
	existing, err := s.users.GetByYandexID(ctx, profile.ID)
	if err != nil && !isUserNotFound(err) {
		return nil, err
	}
	if existing != nil && existing.ID != userID {
		return nil, ErrProviderAlreadyLinked
	}

	user, err := s.users.GetByID(ctx, userID)
	if err != nil {
		if isUserNotFound(err) {
			return nil, ErrNotFound
		}
		return nil, err
	}

	yandexID := profile.ID
	user.YandexID = &yandexID
	user.AvatarURL = pickAvatar(user.AvatarURL, "", profile.AvatarURL)

	return s.users.Update(ctx, user)
}

func (s *service) issueTokens(ctx context.Context, user *model.User) (*AuthResult, error) {
	accessToken, err := s.tokens.IssueAccessToken(user.ID)
	if err != nil {
		return nil, err
	}

	refreshToken, refreshHash, err := s.tokens.NewRefreshToken()
	if err != nil {
		return nil, err
	}

	ttl := int(s.tokens.RefreshTTL().Seconds())
	if err := s.refreshTokens.Save(ctx, refreshHash, user.ID, ttl); err != nil {
		return nil, err
	}

	return &AuthResult{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		User:         user,
	}, nil
}

func randomState() (string, error) {
	buf := make([]byte, 16)
	if _, err := rand.Read(buf); err != nil {
		return "", fmt.Errorf("generate state: %w", err)
	}
	return hex.EncodeToString(buf), nil
}

func trimTrailingSlash(value string) string {
	if len(value) > 1 && value[len(value)-1] == '/' {
		return value[:len(value)-1]
	}
	return value
}

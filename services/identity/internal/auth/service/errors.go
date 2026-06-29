package service

import "errors"

var (
	// ErrNotFound is returned when a user does not exist.
	ErrNotFound = errors.New("user not found")
	// ErrUnauthorized is returned when credentials are invalid or missing.
	ErrUnauthorized = errors.New("unauthorized")
	// ErrInvalidLoginCode is returned when a Telegram login code is invalid or expired.
	ErrInvalidLoginCode = errors.New("invalid login code")
	// ErrInvalidRefreshToken is returned when a refresh token is invalid or expired.
	ErrInvalidRefreshToken = errors.New("invalid refresh token")
	// ErrInvalidOAuthState is returned when Yandex OAuth state is invalid or expired.
	ErrInvalidOAuthState = errors.New("invalid oauth state")
	// ErrInvalidExchangeCode is returned when a Yandex exchange code is invalid or expired.
	ErrInvalidExchangeCode = errors.New("invalid exchange code")
	// ErrInvalidTimezone is returned when an IANA timezone name is invalid.
	ErrInvalidTimezone = errors.New("invalid timezone")
	// ErrProviderAlreadyLinked is returned when a provider account is linked to another user.
	ErrProviderAlreadyLinked = errors.New("provider already linked to another user")
)

package google

import (
	"context"
	"fmt"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
)

const calendarEventsScope = "https://www.googleapis.com/auth/calendar.events"

// Client wraps Google OAuth for Calendar integration.
type Client struct {
	config *oauth2.Config
}

// NewClient builds a Google OAuth client. Returns nil when not configured.
func NewClient(clientID, clientSecret, redirectURI string) *Client {
	if clientID == "" || clientSecret == "" || redirectURI == "" {
		return nil
	}
	return &Client{
		config: &oauth2.Config{
			ClientID:     clientID,
			ClientSecret: clientSecret,
			RedirectURL:  redirectURI,
			Scopes:       []string{calendarEventsScope},
			Endpoint:     google.Endpoint,
		},
	}
}

// Configured reports whether OAuth is available.
func (c *Client) Configured() bool {
	return c != nil && c.config != nil
}

// AuthURL returns the browser authorization URL for offline refresh tokens.
func (c *Client) AuthURL(state string) string {
	return c.config.AuthCodeURL(state, oauth2.AccessTypeOffline, oauth2.ApprovalForce)
}

// ExchangeCode trades an authorization code for a long-lived refresh token.
func (c *Client) ExchangeCode(ctx context.Context, code string) (string, error) {
	tok, err := c.config.Exchange(ctx, code)
	if err != nil {
		return "", fmt.Errorf("exchange google code: %w", err)
	}
	if tok.RefreshToken == "" {
		return "", fmt.Errorf("google oauth: empty refresh token")
	}
	return tok.RefreshToken, nil
}

// TokenSource returns an oauth2 token source backed by a refresh token.
func (c *Client) TokenSource(ctx context.Context, refreshToken string) oauth2.TokenSource {
	return c.config.TokenSource(ctx, &oauth2.Token{RefreshToken: refreshToken})
}

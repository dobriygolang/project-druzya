package yandex

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const (
	authURL  = "https://oauth.yandex.ru/authorize"
	tokenURL = "https://oauth.yandex.ru/token"
	infoURL  = "https://login.yandex.ru/info"
)

// Profile holds Yandex account data used for login or linking.
type Profile struct {
	ID          string
	Login       string
	DisplayName string
	AvatarURL   string
}

// Client exchanges OAuth codes for Yandex profiles.
type Client struct {
	clientID     string
	clientSecret string
	redirectURI  string
	httpClient   *http.Client
}

// NewClient constructs a Yandex OAuth client.
func NewClient(clientID, clientSecret, redirectURI string) *Client {
	return &Client{
		clientID:     clientID,
		clientSecret: clientSecret,
		redirectURI:  redirectURI,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

// AuthURL builds the Yandex OAuth authorization URL.
func (c *Client) AuthURL(state string) string {
	values := url.Values{}
	values.Set("response_type", "code")
	values.Set("client_id", c.clientID)
	values.Set("redirect_uri", c.redirectURI)
	values.Set("state", state)
	return authURL + "?" + values.Encode()
}

// ExchangeCode exchanges an authorization code for a Yandex profile.
func (c *Client) ExchangeCode(ctx context.Context, code string) (*Profile, error) {
	values := url.Values{}
	values.Set("grant_type", "authorization_code")
	values.Set("code", code)
	values.Set("client_id", c.clientID)
	values.Set("client_secret", c.clientSecret)
	values.Set("redirect_uri", c.redirectURI)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, tokenURL, strings.NewReader(values.Encode()))
	if err != nil {
		return nil, fmt.Errorf("build token request: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("exchange yandex code: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read token response: %w", err)
	}
	if resp.StatusCode >= http.StatusBadRequest {
		return nil, fmt.Errorf("yandex token exchange failed: status=%d body=%s", resp.StatusCode, string(body))
	}

	var tokenResp struct {
		AccessToken string `json:"access_token"`
	}
	if err := json.Unmarshal(body, &tokenResp); err != nil {
		return nil, fmt.Errorf("decode token response: %w", err)
	}
	if tokenResp.AccessToken == "" {
		return nil, fmt.Errorf("yandex token exchange returned empty access token")
	}

	return c.fetchProfile(ctx, tokenResp.AccessToken)
}

func (c *Client) fetchProfile(ctx context.Context, accessToken string) (*Profile, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, infoURL+"?format=json", nil)
	if err != nil {
		return nil, fmt.Errorf("build profile request: %w", err)
	}
	req.Header.Set("Authorization", "OAuth "+accessToken)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("fetch yandex profile: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read profile response: %w", err)
	}
	if resp.StatusCode >= http.StatusBadRequest {
		return nil, fmt.Errorf("yandex profile request failed: status=%d body=%s", resp.StatusCode, string(body))
	}

	var profileResp struct {
		ID              string `json:"id"`
		Login           string `json:"login"`
		DisplayName     string `json:"display_name"`
		DefaultAvatarID string `json:"default_avatar_id"`
	}
	if err := json.Unmarshal(body, &profileResp); err != nil {
		return nil, fmt.Errorf("decode profile response: %w", err)
	}
	if profileResp.ID == "" {
		return nil, fmt.Errorf("yandex profile missing id")
	}

	avatarURL := ""
	if profileResp.DefaultAvatarID != "" {
		avatarURL = "https://avatars.yandex.net/get-yapic/" + profileResp.DefaultAvatarID + "/islands-200"
	}

	return &Profile{
		ID:          profileResp.ID,
		Login:       profileResp.Login,
		DisplayName: profileResp.DisplayName,
		AvatarURL:   avatarURL,
	}, nil
}

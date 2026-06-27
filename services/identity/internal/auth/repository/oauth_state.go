package repository

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	goredis "github.com/redis/go-redis/v9"
	"github.com/sedorofeevd/project-druzya/services/identity/internal/auth/model"
)

const oauthStatePrefix = "oauth_state:"

type oauthStatePayload struct {
	Type   model.OAuthStateType `json:"type"`
	UserID string               `json:"user_id"`
}

// OAuthStateRepository stores Yandex OAuth state in Redis.
type OAuthStateRepository struct {
	client *Client
}

// NewOAuthStateRepository constructs a Redis-backed OAuth state repository.
func NewOAuthStateRepository(client *Client) *OAuthStateRepository {
	return &OAuthStateRepository{client: client}
}

func (r *OAuthStateRepository) Save(ctx context.Context, state string, data *model.OAuthState, ttlSeconds int) error {
	payload, err := json.Marshal(oauthStatePayload{
		Type:   data.Type,
		UserID: data.UserID,
	})
	if err != nil {
		return fmt.Errorf("marshal oauth state: %w", err)
	}

	key := oauthStatePrefix + state
	if err := r.client.Set(ctx, key, payload, time.Duration(ttlSeconds)*time.Second).Err(); err != nil {
		return fmt.Errorf("save oauth state: %w", err)
	}
	return nil
}

func (r *OAuthStateRepository) Consume(ctx context.Context, state string) (*model.OAuthState, error) {
	key := oauthStatePrefix + state
	raw, err := r.client.GetDel(ctx, key).Bytes()
	if err != nil {
		if errors.Is(err, goredis.Nil) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("consume oauth state: %w", err)
	}

	var payload oauthStatePayload
	if err := json.Unmarshal(raw, &payload); err != nil {
		return nil, fmt.Errorf("unmarshal oauth state: %w", err)
	}

	return &model.OAuthState{
		Type:   payload.Type,
		UserID: payload.UserID,
	}, nil
}

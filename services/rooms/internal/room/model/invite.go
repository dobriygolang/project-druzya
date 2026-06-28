package model

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
)

const (
	DefaultInviteTTL = 24 * time.Hour
)

var ErrInvalidInvite = errors.New("room: invalid invite token")

type InviteLink struct {
	URL       string
	Token     string
	ExpiresAt time.Time
}

func GenerateInviteToken(roomID uuid.UUID, ttl time.Duration, secret []byte, now time.Time) (string, time.Time, error) {
	if len(secret) == 0 {
		return "", time.Time{}, ErrInvalidInvite
	}
	if ttl <= 0 {
		return "", time.Time{}, fmt.Errorf("ttl must be positive")
	}
	exp := now.Add(ttl)
	raw := roomID.String() + "." + strconv.FormatInt(exp.Unix(), 10)
	mac := hmac.New(sha256.New, secret)
	mac.Write([]byte(raw))
	sig := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	return raw + "." + sig, exp, nil
}

func ValidateInviteToken(token string, secret []byte, now time.Time) (uuid.UUID, error) {
	if len(secret) == 0 || token == "" {
		return uuid.Nil, ErrInvalidInvite
	}
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return uuid.Nil, ErrInvalidInvite
	}
	rid, err := uuid.Parse(parts[0])
	if err != nil {
		return uuid.Nil, ErrInvalidInvite
	}
	expUnix, err := strconv.ParseInt(parts[1], 10, 64)
	if err != nil {
		return uuid.Nil, ErrInvalidInvite
	}
	if now.Unix() >= expUnix {
		return uuid.Nil, ErrInvalidInvite
	}
	raw := parts[0] + "." + parts[1]
	mac := hmac.New(sha256.New, secret)
	mac.Write([]byte(raw))
	wantSig := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	if !hmac.Equal([]byte(wantSig), []byte(parts[2])) {
		return uuid.Nil, ErrInvalidInvite
	}
	return rid, nil
}

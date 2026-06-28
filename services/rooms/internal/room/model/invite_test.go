package model_test

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/sedorofeevd/project-druzya/services/rooms/internal/room/model"
)

func TestGenerateAndValidateInviteToken(t *testing.T) {
	t.Parallel()
	secret := []byte("test-room-invite-secret")
	roomID := uuid.MustParse("11111111-1111-1111-1111-111111111111")
	now := time.Unix(1_700_000_000, 0)

	token, exp, err := model.GenerateInviteToken(roomID, model.DefaultInviteTTL, secret, now)
	if err != nil {
		t.Fatalf("generate: %v", err)
	}
	if token == "" {
		t.Fatal("expected token")
	}
	if !exp.After(now) {
		t.Fatal("expected future expiry")
	}

	got, err := model.ValidateInviteToken(token, secret, now.Add(time.Minute))
	if err != nil {
		t.Fatalf("validate: %v", err)
	}
	if got != roomID {
		t.Fatalf("room id mismatch: got %v want %v", got, roomID)
	}
}

func TestValidateInviteToken_rejectsExpired(t *testing.T) {
	t.Parallel()
	secret := []byte("test-room-invite-secret")
	roomID := uuid.MustParse("22222222-2222-2222-2222-222222222222")
	now := time.Unix(1_700_000_000, 0)

	token, _, err := model.GenerateInviteToken(roomID, time.Second, secret, now)
	if err != nil {
		t.Fatalf("generate: %v", err)
	}
	_, err = model.ValidateInviteToken(token, secret, now.Add(2*time.Second))
	if err == nil {
		t.Fatal("expected expired token error")
	}
}

func TestValidateInviteToken_rejectsBadSignature(t *testing.T) {
	t.Parallel()
	secret := []byte("test-room-invite-secret")
	roomID := uuid.MustParse("33333333-3333-3333-3333-333333333333")
	now := time.Unix(1_700_000_000, 0)

	token, _, err := model.GenerateInviteToken(roomID, model.DefaultInviteTTL, secret, now)
	if err != nil {
		t.Fatalf("generate: %v", err)
	}
	_, err = model.ValidateInviteToken(token, []byte("wrong-secret"), now)
	if err == nil {
		t.Fatal("expected invalid invite")
	}
}

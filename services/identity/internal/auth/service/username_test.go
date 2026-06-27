package service_test

import (
	"context"
	"testing"

	"github.com/sedorofeevd/project-druzya/services/identity/internal/auth/service"
)

type stubUsernameRepo struct {
	taken map[string]struct{}
}

func (s *stubUsernameRepo) UsernameExists(_ context.Context, username string) (bool, error) {
	_, ok := s.taken[username]
	return ok, nil
}

func TestAllocateUsernameUsesCandidate(t *testing.T) {
	repo := &stubUsernameRepo{taken: map[string]struct{}{}}

	username, err := service.AllocateUsername(context.Background(), repo, "@My_User")
	if err != nil {
		t.Fatalf("allocate username: %v", err)
	}
	if username != "my_user" {
		t.Fatalf("expected my_user, got %s", username)
	}
}

func TestAllocateUsernameAddsSuffixOnCollision(t *testing.T) {
	repo := &stubUsernameRepo{taken: map[string]struct{}{"ivan": {}}}

	username, err := service.AllocateUsername(context.Background(), repo, "Ivan")
	if err != nil {
		t.Fatalf("allocate username: %v", err)
	}
	if username == "ivan" {
		t.Fatal("expected unique suffix username")
	}
}

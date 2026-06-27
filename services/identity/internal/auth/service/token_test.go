package service_test

import (
	"os"
	"testing"
	"time"

	"github.com/sedorofeevd/project-druzya/services/identity/internal/auth/service"
)

func TestTokenManagerIssueAndValidate(t *testing.T) {
	privatePEM, err := os.ReadFile("../../../scripts/dev/jwt/private.pem")
	if err != nil {
		t.Skip("dev jwt keys not generated")
	}
	publicPEM, err := os.ReadFile("../../../scripts/dev/jwt/public.pem")
	if err != nil {
		t.Skip("dev jwt keys not generated")
	}

	manager, err := service.NewTokenManager(privatePEM, publicPEM, time.Minute, time.Hour)
	if err != nil {
		t.Fatalf("new token manager: %v", err)
	}

	token, err := manager.IssueAccessToken("user-1")
	if err != nil {
		t.Fatalf("issue token: %v", err)
	}

	userID, err := manager.ValidateAccessToken(token)
	if err != nil {
		t.Fatalf("validate token: %v", err)
	}
	if userID != "user-1" {
		t.Fatalf("expected user-1, got %s", userID)
	}
}

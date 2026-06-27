package jwt

import (
	"errors"
	"fmt"

	jwtlib "github.com/golang-jwt/jwt/v5"
)

const (
	ClaimRole        = "role"
	ClaimScope       = "scp"
	ClaimDisplayName = "dn"
	RoleGuest        = "guest"
)

// AccessClaims holds parsed JWT fields used by rooms WS and REST.
type AccessClaims struct {
	UserID      string
	Role        string
	Scope       string
	DisplayName string
}

// ParseScoped validates RS256 token and optional scope binding.
// Empty token scope means unrestricted user access token.
func (v *Validator) ParseScoped(tokenString, expectedScope string) (AccessClaims, error) {
	token, err := jwtlib.Parse(tokenString, func(token *jwtlib.Token) (any, error) {
		if token.Method != jwtlib.SigningMethodRS256 {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return v.publicKey, nil
	})
	if err != nil {
		return AccessClaims{}, fmt.Errorf("parse access token: %w", err)
	}
	if !token.Valid {
		return AccessClaims{}, errors.New("invalid access token")
	}

	claims, ok := token.Claims.(jwtlib.MapClaims)
	if !ok {
		return AccessClaims{}, errors.New("invalid token claims")
	}

	sub, err := claims.GetSubject()
	if err != nil || sub == "" {
		return AccessClaims{}, errors.New("missing token subject")
	}

	out := AccessClaims{UserID: sub}
	if role, ok := claims[ClaimRole].(string); ok {
		out.Role = role
	}
	if scope, ok := claims[ClaimScope].(string); ok {
		out.Scope = scope
	}
	if dn, ok := claims[ClaimDisplayName].(string); ok {
		out.DisplayName = dn
	}

	if out.Scope != "" && out.Scope != expectedScope {
		return AccessClaims{}, fmt.Errorf("token scope mismatch")
	}
	return out, nil
}

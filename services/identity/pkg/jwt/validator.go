package jwt

import (
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"errors"
	"fmt"

	jwtlib "github.com/golang-jwt/jwt/v5"
)

// Validator verifies RS256 access tokens issued by identity service.
type Validator struct {
	publicKey *rsa.PublicKey
}

// NewValidator constructs a validator from PEM-encoded RSA public key.
func NewValidator(publicKeyPEM []byte) (*Validator, error) {
	publicKey, err := parsePublicKey(publicKeyPEM)
	if err != nil {
		return nil, err
	}
	return &Validator{publicKey: publicKey}, nil
}

// UserID validates token and returns subject user ID.
func (v *Validator) UserID(tokenString string) (string, error) {
	token, err := jwtlib.Parse(tokenString, func(token *jwtlib.Token) (any, error) {
		if token.Method != jwtlib.SigningMethodRS256 {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return v.publicKey, nil
	})
	if err != nil {
		return "", fmt.Errorf("parse access token: %w", err)
	}
	if !token.Valid {
		return "", errors.New("invalid access token")
	}

	claims, ok := token.Claims.(jwtlib.MapClaims)
	if !ok {
		return "", errors.New("invalid token claims")
	}

	sub, err := claims.GetSubject()
	if err != nil || sub == "" {
		return "", errors.New("missing token subject")
	}
	return sub, nil
}

func parsePublicKey(pemBytes []byte) (*rsa.PublicKey, error) {
	block, _ := pem.Decode(pemBytes)
	if block == nil {
		return nil, errors.New("decode public key pem")
	}

	key, err := x509.ParsePKIXPublicKey(block.Bytes)
	if err == nil {
		publicKey, ok := key.(*rsa.PublicKey)
		if !ok {
			return nil, errors.New("public key is not rsa")
		}
		return publicKey, nil
	}

	publicKey, err := x509.ParsePKCS1PublicKey(block.Bytes)
	if err != nil {
		return nil, fmt.Errorf("parse public key: %w", err)
	}
	return publicKey, nil
}

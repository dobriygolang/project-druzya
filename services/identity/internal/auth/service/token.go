package service

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/hex"
	"encoding/pem"
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const tokenKeyID = "v1"

// TokenPair holds issued access and refresh tokens.
type TokenPair struct {
	AccessToken  string
	RefreshToken string
}

// TokenManager signs and validates RS256 JWT access tokens.
type TokenManager struct {
	privateKey *rsa.PrivateKey
	publicKey  *rsa.PublicKey
	accessTTL  time.Duration
	refreshTTL time.Duration
}

// NewTokenManager constructs a token manager from PEM-encoded RSA keys.
func NewTokenManager(privateKeyPEM, publicKeyPEM []byte, accessTTL, refreshTTL time.Duration) (*TokenManager, error) {
	privateKey, err := parsePrivateKey(privateKeyPEM)
	if err != nil {
		return nil, err
	}
	publicKey, err := parsePublicKey(publicKeyPEM)
	if err != nil {
		return nil, err
	}

	return &TokenManager{
		privateKey: privateKey,
		publicKey:  publicKey,
		accessTTL:  accessTTL,
		refreshTTL: refreshTTL,
	}, nil
}

// AccessTTL returns configured access token lifetime.
func (m *TokenManager) AccessTTL() time.Duration {
	return m.accessTTL
}

// RefreshTTL returns configured refresh token lifetime.
func (m *TokenManager) RefreshTTL() time.Duration {
	return m.refreshTTL
}

// IssueAccessToken creates a signed JWT for the given user ID.
func (m *TokenManager) IssueAccessToken(userID string) (string, error) {
	now := time.Now().UTC()
	claims := jwt.MapClaims{
		"sub": userID,
		"iat": now.Unix(),
		"exp": now.Add(m.accessTTL).Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	token.Header["kid"] = tokenKeyID

	signed, err := token.SignedString(m.privateKey)
	if err != nil {
		return "", fmt.Errorf("sign access token: %w", err)
	}
	return signed, nil
}

// ValidateAccessToken verifies JWT and returns the subject user ID.
func (m *TokenManager) ValidateAccessToken(tokenString string) (string, error) {
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (any, error) {
		if token.Method != jwt.SigningMethodRS256 {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return m.publicKey, nil
	})
	if err != nil {
		return "", fmt.Errorf("parse access token: %w", err)
	}
	if !token.Valid {
		return "", errors.New("invalid access token")
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return "", errors.New("invalid token claims")
	}

	sub, err := claims.GetSubject()
	if err != nil || sub == "" {
		return "", errors.New("missing token subject")
	}
	return sub, nil
}

// NewRefreshToken generates a random refresh token and its SHA-256 hash.
func (m *TokenManager) NewRefreshToken() (token string, hash string, err error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", "", fmt.Errorf("generate refresh token: %w", err)
	}
	token = hex.EncodeToString(buf)
	hash = HashRefreshToken(token)
	return token, hash, nil
}

// HashRefreshToken returns a stable hash for storing refresh tokens.
func HashRefreshToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

// PublicKeyPEM returns the PEM-encoded RSA public key.
func (m *TokenManager) PublicKeyPEM() ([]byte, error) {
	der, err := x509.MarshalPKIXPublicKey(m.publicKey)
	if err != nil {
		return nil, fmt.Errorf("marshal public key: %w", err)
	}
	return pem.EncodeToMemory(&pem.Block{
		Type:  "PUBLIC KEY",
		Bytes: der,
	}), nil
}

func parsePrivateKey(pemBytes []byte) (*rsa.PrivateKey, error) {
	block, _ := pem.Decode(pemBytes)
	if block == nil {
		return nil, errors.New("decode private key pem")
	}

	key, err := x509.ParsePKCS1PrivateKey(block.Bytes)
	if err == nil {
		return key, nil
	}

	parsed, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err != nil {
		return nil, fmt.Errorf("parse private key: %w", err)
	}

	privateKey, ok := parsed.(*rsa.PrivateKey)
	if !ok {
		return nil, errors.New("private key is not rsa")
	}
	return privateKey, nil
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

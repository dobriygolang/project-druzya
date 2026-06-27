package logincode

import (
	"crypto/rand"
	"fmt"
	"math/big"
)

const defaultLength = 8

const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

// Generate returns a human-friendly one-time login code.
func Generate(length int) (string, error) {
	if length <= 0 {
		length = defaultLength
	}

	result := make([]byte, length)
	for i := range result {
		n, err := rand.Int(rand.Reader, big.NewInt(int64(len(alphabet))))
		if err != nil {
			return "", fmt.Errorf("generate login code: %w", err)
		}
		result[i] = alphabet[n.Int64()]
	}
	return string(result), nil
}

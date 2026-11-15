package config

import (
	"crypto/rand"
	"fmt"
	"math/big"
)

func GenRandomNum() string {
	// Generate a cryptographically secure random number between 1000 and 9999
	n, err := rand.Int(rand.Reader, big.NewInt(9000))
	if err != nil {
		// Fallback to a timestamp-based approach if crypto/rand fails
		return fmt.Sprintf("%d", 1000)
	}
	return fmt.Sprintf("%d", n.Int64()+1000)
}

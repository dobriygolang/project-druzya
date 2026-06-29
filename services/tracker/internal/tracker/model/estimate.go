package model

import (
	"fmt"
	"math"
)

func NormalizeEstimateDays(v float64) (float64, error) {
	if v <= 0 || v > MaxTaskEstimateDays {
		return 0, fmt.Errorf("%w: estimate_days must be between %.1f and %.1f", ErrInvalidArgument, MinTaskEstimateDays, MaxTaskEstimateDays)
	}
	rounded := math.Round(v*2) / 2
	if rounded < MinTaskEstimateDays {
		rounded = MinTaskEstimateDays
	}
	return rounded, nil
}

func IsTaskArchived(meta map[string]any) bool {
	if meta == nil {
		return false
	}
	v, ok := meta["archived"]
	if !ok {
		return false
	}
	b, ok := v.(bool)
	return ok && b
}

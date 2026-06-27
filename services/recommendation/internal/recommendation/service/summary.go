package service

import "time"

func shouldRefreshSummary(updatedAt *time.Time) bool {
	if updatedAt == nil {
		return true
	}
	return time.Since(*updatedAt) > 24*time.Hour
}

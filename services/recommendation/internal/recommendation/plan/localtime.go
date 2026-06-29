package plan

import (
	"strings"
	"time"
)

// PlanClock anchors scoring and debounce to the user's local calendar day.
type PlanClock struct {
	LocalDate string
	Now       time.Time
	Location  *time.Location
}

// ResolvePlanClock picks the effective IANA timezone and local date for today planning.
// localDate: YYYY-MM-DD from client; timezone: IANA name (e.g. Europe/Moscow).
func ResolvePlanClock(localDate, timezone string) PlanClock {
	loc := time.UTC
	if tz := strings.TrimSpace(timezone); tz != "" {
		if l, err := time.LoadLocation(tz); err == nil {
			loc = l
		}
	}
	now := time.Now().In(loc)
	date := strings.TrimSpace(localDate)
	if date == "" {
		date = now.Format("2006-01-02")
	} else if _, err := time.Parse("2006-01-02", date); err != nil {
		date = now.Format("2006-01-02")
	}
	return PlanClock{LocalDate: date, Now: now, Location: loc}
}

// ReconcileDebounceKey scopes reconcile debounce to user + local calendar day.
func ReconcileDebounceKey(userID, localDate string) string {
	return userID + "|" + localDate
}

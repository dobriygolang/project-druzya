package entitlement

import (
	"encoding/json"
	"fmt"
	"time"
)

const (
	TypeBool    = "bool"
	TypeCounter = "counter"

	PeriodDay      = "day"
	PeriodMonth    = "month"
	PeriodYear     = "year"
	PeriodLifetime = "lifetime"
)

// Value is a parsed plan entitlement definition.
type Value struct {
	Type    string `json:"type"`
	Value   bool   `json:"value"`
	Limit   *int   `json:"limit"`
	Period  string `json:"period"`
	RawJSON json.RawMessage
}

// Parse decodes entitlement JSON into a typed value.
func Parse(raw json.RawMessage) (Value, error) {
	if len(raw) == 0 {
		return Value{}, fmt.Errorf("empty entitlement json")
	}
	var v Value
	if err := json.Unmarshal(raw, &v); err != nil {
		return Value{}, fmt.Errorf("decode entitlement: %w", err)
	}
	v.RawJSON = raw
	switch v.Type {
	case TypeBool:
		return v, nil
	case TypeCounter:
		if v.Period == "" {
			return Value{}, fmt.Errorf("counter entitlement requires period")
		}
		if v.Limit == nil {
			v.Limit = nil // unlimited
		}
		return v, nil
	default:
		return Value{}, fmt.Errorf("unsupported entitlement type %q", v.Type)
	}
}

// PeriodWindow returns inclusive-exclusive UTC bounds for a counter period.
func PeriodWindow(period string, now time.Time) (start, end time.Time, err error) {
	now = now.UTC()
	switch period {
	case PeriodDay:
		start = time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
		end = start.AddDate(0, 0, 1)
	case PeriodMonth:
		start = time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
		end = start.AddDate(0, 1, 0)
	case PeriodYear:
		start = time.Date(now.Year(), 1, 1, 0, 0, 0, 0, time.UTC)
		end = start.AddDate(1, 0, 0)
	case PeriodLifetime:
		start = time.Unix(0, 0).UTC()
		end = time.Date(9999, 12, 31, 0, 0, 0, 0, time.UTC)
	default:
		return time.Time{}, time.Time{}, fmt.Errorf("unsupported period %q", period)
	}
	return start, end, nil
}

// Remaining calculates remaining quota.
func Remaining(limit *int, used int) *int {
	if limit == nil {
		return nil
	}
	left := *limit - used
	if left < 0 {
		left = 0
	}
	return &left
}

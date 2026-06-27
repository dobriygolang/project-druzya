package payload

import (
	"fmt"
	"strconv"
	"time"
)

// StringField reads a string from an outbox/event payload map.
func StringField(payload map[string]any, key string) string {
	v, ok := payload[key]
	if !ok || v == nil {
		return ""
	}
	switch t := v.(type) {
	case string:
		return t
	default:
		return fmt.Sprintf("%v", t)
	}
}

// BoolField reads a bool from a payload map.
func BoolField(payload map[string]any, key string) bool {
	v, ok := payload[key]
	if !ok || v == nil {
		return false
	}
	switch t := v.(type) {
	case bool:
		return t
	case string:
		return t == "true" || t == "1"
	default:
		return false
	}
}

// FloatField reads a float from a nested map (e.g. feedback criteria).
func FloatField(m map[string]any, key string) float64 {
	v, ok := m[key]
	if !ok || v == nil {
		return 0
	}
	switch t := v.(type) {
	case float64:
		return t
	case float32:
		return float64(t)
	case int:
		return float64(t)
	case int64:
		return float64(t)
	case jsonNumber:
		f, _ := t.Float64()
		return f
	default:
		return 0
	}
}

// ParseScoreField handles decimal strings and numeric scores from interview payloads.
func ParseScoreField(payload map[string]any) float64 {
	if scoreRaw := StringField(payload, "score"); scoreRaw != "" {
		if f, err := strconv.ParseFloat(scoreRaw, 64); err == nil {
			return f
		}
	}
	if f, ok := payload["score"].(float64); ok {
		return f
	}
	return 0
}

// ParseOccurredAt reads RFC3339Nano timestamps from payloads.
func ParseOccurredAt(payload map[string]any) time.Time {
	if occurred := StringField(payload, "occurred_at"); occurred != "" {
		if t, err := time.Parse(time.RFC3339Nano, occurred); err == nil {
			return t
		}
	}
	return time.Time{}
}

type jsonNumber interface {
	Float64() (float64, error)
}

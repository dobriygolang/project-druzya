package service

import "strings"

func practicePathForSkill(skillKey string) string {
	key := strings.ToLower(strings.TrimSpace(skillKey))
	switch {
	case strings.HasPrefix(key, "algorithm."):
		return "/mock?solo=algo"
	case strings.HasPrefix(key, "behavioral."):
		return "/mock?solo=behavioral"
	case strings.HasPrefix(key, "system"), strings.HasPrefix(key, "sysdesign"):
		return "/mock?solo=sysdesign"
	case strings.HasPrefix(key, "coding."), strings.HasPrefix(key, "live_coding"):
		return "/mock?solo=coding"
	default:
		return "/mock"
	}
}

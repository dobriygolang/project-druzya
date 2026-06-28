package summary

import "strings"

func systemPrompt(locale string) string {
	if strings.HasPrefix(strings.ToLower(strings.TrimSpace(locale)), "en") {
		return `You are a career coach for technical interviews. Write 2-3 sentences in English: strengths, weak areas, next step. No markdown.`
	}
	return `Ты карьерный коуч для технических интервью. Напиши 2-3 предложения на русском: сильные стороны, слабые зоны, следующий шаг. Без markdown.`
}

package aiapi

import (
	"encoding/base64"
	"strings"

	"github.com/sedorofeevd/project-druzya/services/ai/internal/adapter/llm/llmchain"
)

func pngBase64ToImages(b64 string) []llmchain.Image {
	raw := strings.TrimSpace(b64)
	if raw == "" {
		return nil
	}
	if idx := strings.Index(raw, ","); idx >= 0 && strings.HasPrefix(raw, "data:") {
		raw = raw[idx+1:]
	}
	data, err := base64.StdEncoding.DecodeString(raw)
	if err != nil || len(data) == 0 {
		return nil
	}
	return []llmchain.Image{{MimeType: "image/png", Data: data}}
}

func hasVisionImages(b64 string) bool {
	return len(pngBase64ToImages(b64)) > 0
}

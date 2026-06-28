package evaluator

import (
	"encoding/base64"
	"encoding/json"
	"strings"
)

type attachmentRef struct {
	Name string `json:"name"`
	URL  string `json:"url"`
	Type string `json:"type"`
}

// DiagramPNGFromAttachments extracts inline diagram PNG data URL from attempt attachments JSON.
func DiagramPNGFromAttachments(raw json.RawMessage) string {
	if len(raw) == 0 {
		return ""
	}
	var items []attachmentRef
	if err := json.Unmarshal(raw, &items); err != nil {
		return ""
	}
	for _, a := range items {
		if a.Type == "diagram_png" && a.URL != "" {
			return a.URL
		}
	}
	return ""
}

func pngURLToBytes(dataURL string) []byte {
	raw := strings.TrimSpace(dataURL)
	if idx := strings.Index(raw, ","); idx >= 0 && strings.HasPrefix(raw, "data:") {
		raw = raw[idx+1:]
	}
	b, err := base64.StdEncoding.DecodeString(raw)
	if err != nil {
		return nil
	}
	return b
}

package llmchain

import (
	"bufio"
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"slices"
	"strings"
	"time"
)

// openAIDriver is the common driver for every OpenAI-compatible provider
// we speak to (Groq, Cerebras, Mistral, OpenRouter). They differ only in
// base URL, auth-header quirks, and rate-limit header layout — none of
// which is worth a full re-implementation per provider.
//
// Each provider-specific file (driver_groq.go, driver_cerebras.go, …)
// wraps this struct with its own Provider() identity and constructor.
//
// Wire format details matching services/copilot/infra/llm_openrouter.go
// so behaviour is identical for the copilot streaming path, minus the
// retry loop (that's the chain's job now).
type openAIDriver struct {
	provider Provider
	apiKey   string
	endpoint string // full chat-completions URL including /v1/chat/completions

	http *http.Client

	// supportsVision — driver-level opt-in. Mistral-Small and Groq Llama
	// models are text-only; OpenRouter vision models via BYOK are not.
	// When the chain sees Images on the Request and supportsVision=false,
	// we return ErrModelNotSupported so the chain moves on.
	supportsVision bool

	// supportsJSONMode — providers vary on whether they accept
	// response_format={"type":"json_object"}. Unsupported means we
	// still pass the hint but rely on prompt-level JSON instruction.
	supportsJSONMode bool

	// skipAuth — отключает Authorization header целиком. Зарезервировано
	// для драйверов на self-hosted OpenAI-совместимом endpoint'е без
	// API key. Cloud-провайдеры (Groq/Cerebras/Mistral/…) держат это поле
	// в false — для них пустой apiKey означает "драйвер не должен был
	// регистрироваться" и мы хотим, чтобы первый же запрос громко упал
	// с 401, а не молча прошёл в анонимном режиме.
	skipAuth bool
}

// newOpenAIDriver is the shared constructor. Per-provider files call
// this with their own base URL + quirks.
//
// The HTTP client has NO overall Timeout — SSE streams run for minutes
// on reasoning models. Instead, per-phase timeouts on Transport bound
// the connect / TLS / first-byte stages; ongoing body reads are governed
// by the caller's ctx (the chain injects a per-provider timeout).
func newOpenAIDriver(p Provider, apiKey, endpoint string) *openAIDriver {
	transport := &http.Transport{
		DialContext: (&net.Dialer{
			Timeout:   10 * time.Second,
			KeepAlive: 30 * time.Second,
		}).DialContext,
		TLSHandshakeTimeout:   10 * time.Second,
		ResponseHeaderTimeout: 60 * time.Second,
		ExpectContinueTimeout: 1 * time.Second,
		IdleConnTimeout:       90 * time.Second,
		MaxIdleConns:          100,
	}
	return &openAIDriver{
		provider:         p,
		apiKey:           apiKey,
		endpoint:         endpoint,
		http:             &http.Client{Transport: transport},
		supportsVision:   false,
		supportsJSONMode: true,
	}
}

// ─────────────────────────────────────────────────────────────────────────
// Wire structs — shared by every OpenAI-compatible provider.
// ─────────────────────────────────────────────────────────────────────────

type oaiReq struct {
	Model          string       `json:"model"`
	Messages       []oaiMessage `json:"messages"`
	Stream         bool         `json:"stream,omitempty"`
	Temperature    float64      `json:"temperature,omitempty"`
	MaxTokens      int          `json:"max_tokens,omitempty"`
	ResponseFormat *oaiRF       `json:"response_format,omitempty"`
}

type oaiRF struct {
	Type string `json:"type"`
}

type oaiMessage struct {
	Role    string      `json:"role"`
	Content interface{} `json:"content"` // string OR []oaiContentPart
}

type oaiContentPart struct {
	Type     string       `json:"type"`
	Text     string       `json:"text,omitempty"`
	ImageURL *oaiImageURL `json:"image_url,omitempty"`
}

type oaiImageURL struct {
	URL string `json:"url"`
}

// Non-streaming response.
type oaiResp struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
	Usage *oaiUsage `json:"usage"`
	Model string    `json:"model"`
}

// Streaming chunk — same wire shape as OpenRouter's chunks.
type oaiStreamChunk struct {
	Choices []struct {
		Delta struct {
			Content string `json:"content"`
		} `json:"delta"`
		FinishReason *string `json:"finish_reason"`
	} `json:"choices"`
	Usage *oaiUsage `json:"usage"`
	Model string    `json:"model"`
}

type oaiUsage struct {
	PromptTokens     int `json:"prompt_tokens"`
	CompletionTokens int `json:"completion_tokens"`
	TotalTokens      int `json:"total_tokens"`
}

// ─────────────────────────────────────────────────────────────────────────
// Chat (non-streaming).
// ─────────────────────────────────────────────────────────────────────────

func (d *openAIDriver) Provider() Provider { return d.provider }

// Capabilities — driver caps на wire-уровне. Tools пока ни
// одна задача не использует, поэтому false по умолчанию для всех
// OpenAI-compat драйверов; при необходимости конкретный provider-файл
// может выставить true (как с supportsVision/supportsJSONMode).
func (d *openAIDriver) Capabilities() Capabilities {
	return Capabilities{
		JSONMode: d.supportsJSONMode,
		Tools:    false,
	}
}

func (d *openAIDriver) Chat(ctx context.Context, model string, req Request) (Response, error) {
	if req.ModelOverride != "" {
		model = stripProviderPrefix(model)
	}
	if len(req.Messages) == 0 {
		return Response{}, fmt.Errorf("%w: empty messages", ErrBadRequest)
	}
	if hasImages(req.Messages) && !d.supportsVision {
		return Response{}, fmt.Errorf("%w: %s does not support vision inputs", ErrModelNotSupported, d.provider)
	}

	body, err := json.Marshal(oaiReq{
		Model:          model,
		Messages:       toOAIMessages(req.Messages),
		Temperature:    req.Temperature,
		MaxTokens:      req.MaxTokens,
		ResponseFormat: jsonFormat(req.JSONMode && d.supportsJSONMode),
	})
	if err != nil {
		return Response{}, fmt.Errorf("llmchain.%s.Chat: marshal: %w", d.provider, err)
	}

	start := time.Now()
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, d.endpoint, bytes.NewReader(body))
	if err != nil {
		return Response{}, fmt.Errorf("llmchain.%s.Chat: new request: %w", d.provider, err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Accept", "application/json")
	d.setAuthHeaders(httpReq)

	resp, err := d.http.Do(httpReq)
	if err != nil {
		return Response{}, classifyTransportError(err, ctx)
	}
	defer func() { _ = resp.Body.Close() }()

	if classErr := classifyHTTPStatus(resp); classErr != nil {
		return Response{}, classErr
	}

	var parsed oaiResp
	if err := json.NewDecoder(resp.Body).Decode(&parsed); err != nil {
		return Response{}, fmt.Errorf("llmchain.%s.Chat: decode: %w: %w", d.provider, ErrProviderDown, err)
	}
	content := ""
	if len(parsed.Choices) > 0 {
		content = parsed.Choices[0].Message.Content
	}
	tokensIn, tokensOut := 0, 0
	if parsed.Usage != nil {
		tokensIn = parsed.Usage.PromptTokens
		tokensOut = parsed.Usage.CompletionTokens
	}
	echoModel := parsed.Model
	if echoModel == "" {
		echoModel = model
	}
	return Response{
		Content:   content,
		TokensIn:  tokensIn,
		TokensOut: tokensOut,
		Provider:  d.provider,
		Model:     echoModel,
		Latency:   time.Since(start),
	}, nil
}

// ─────────────────────────────────────────────────────────────────────────
// ChatStream (SSE).
// ─────────────────────────────────────────────────────────────────────────

func (d *openAIDriver) ChatStream(ctx context.Context, model string, req Request) (<-chan StreamEvent, error) {
	if req.ModelOverride != "" {
		model = stripProviderPrefix(model)
	}
	if len(req.Messages) == 0 {
		return nil, fmt.Errorf("%w: empty messages", ErrBadRequest)
	}
	if hasImages(req.Messages) && !d.supportsVision {
		return nil, fmt.Errorf("%w: %s does not support vision inputs", ErrModelNotSupported, d.provider)
	}

	body, err := json.Marshal(oaiReq{
		Model:          model,
		Messages:       toOAIMessages(req.Messages),
		Stream:         true,
		Temperature:    req.Temperature,
		MaxTokens:      req.MaxTokens,
		ResponseFormat: jsonFormat(req.JSONMode && d.supportsJSONMode),
	})
	if err != nil {
		return nil, fmt.Errorf("llmchain.%s.ChatStream: marshal: %w", d.provider, err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, d.endpoint, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("llmchain.%s.ChatStream: new request: %w", d.provider, err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Accept", "text/event-stream")
	d.setAuthHeaders(httpReq)

	resp, err := d.http.Do(httpReq)
	if err != nil {
		return nil, classifyTransportError(err, ctx)
	}
	if classErr := classifyHTTPStatus(resp); classErr != nil {
		// classifyHTTPStatus drains+closes on non-2xx.
		return nil, classErr
	}

	out := make(chan StreamEvent, 16)
	go d.pumpSSE(ctx, resp, model, out)
	return out, nil
}

func (d *openAIDriver) pumpSSE(ctx context.Context, resp *http.Response, reqModel string, out chan<- StreamEvent) {
	defer close(out)
	defer func() { _ = resp.Body.Close() }()

	reader := bufio.NewReader(resp.Body)
	var modelEcho string
	for {
		if ctx.Err() != nil {
			out <- StreamEvent{Err: ctx.Err()}
			return
		}
		line, err := reader.ReadString('\n')
		if err != nil {
			if errors.Is(err, io.EOF) {
				// Upstream closed without emitting a final usage
				// record. Emit a zero-usage Done so the caller can
				// commit whatever content it already received.
				out <- StreamEvent{Done: &DoneInfo{Provider: d.provider, Model: coalesce(modelEcho, reqModel)}}
				return
			}
			out <- StreamEvent{Err: err}
			return
		}
		line = strings.TrimSpace(line)
		if line == "" || !strings.HasPrefix(line, "data:") {
			continue
		}
		data := strings.TrimSpace(strings.TrimPrefix(line, "data:"))
		if data == "[DONE]" {
			out <- StreamEvent{Done: &DoneInfo{Provider: d.provider, Model: coalesce(modelEcho, reqModel)}}
			return
		}
		var chunk oaiStreamChunk
		if err := json.Unmarshal([]byte(data), &chunk); err != nil {
			// Skip malformed lines — providers sometimes emit keep-alive
			// comments or ":" heartbeat lines interleaved with data.
			continue
		}
		if chunk.Model != "" {
			modelEcho = chunk.Model
		}
		for _, ch := range chunk.Choices {
			if ch.Delta.Content != "" {
				out <- StreamEvent{Delta: ch.Delta.Content}
			}
		}
		if chunk.Usage != nil {
			out <- StreamEvent{Done: &DoneInfo{
				TokensIn:  chunk.Usage.PromptTokens,
				TokensOut: chunk.Usage.CompletionTokens,
				Provider:  d.provider,
				Model:     coalesce(modelEcho, reqModel),
			}}
			return
		}
	}
}

// ─────────────────────────────────────────────────────────────────────────
// HTTP helpers.
// ─────────────────────────────────────────────────────────────────────────

func (d *openAIDriver) setAuthHeaders(r *http.Request) {
	if d.skipAuth {
		return
	}
	if d.apiKey == "" {
		return
	}
	r.Header.Set("Authorization", "Bearer "+d.apiKey)
}

// classifyHTTPStatus maps an HTTP response into the typed error set.
// Status codes come out of the upstream as plain ints; the chain then
// picks the right cooldown duration based on the sentinel.
func classifyHTTPStatus(resp *http.Response) error {
	code := resp.StatusCode
	if code >= 200 && code < 300 {
		return nil
	}
	// Drain body for context in the error message; keep the read bounded.
	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
	_ = resp.Body.Close()
	bodyStr := strings.TrimSpace(string(raw))

	switch {
	case code == http.StatusTooManyRequests:
		// Retry-After parsing happens chain-side — we just attach the
		// raw header back into the error for now via a wrapper.
		return &httpStatusError{status: code, body: bodyStr, sentinel: ErrRateLimited, header: resp.Header}
	case code == http.StatusUnauthorized, code == http.StatusForbidden:
		return &httpStatusError{status: code, body: bodyStr, sentinel: ErrUnauthorized, header: resp.Header}
	case code == http.StatusBadRequest, code == http.StatusNotFound, code == http.StatusUnprocessableEntity:
		return &httpStatusError{status: code, body: bodyStr, sentinel: ErrBadRequest, header: resp.Header}
	case code == http.StatusPaymentRequired:
		// 402 = OpenRouter "insufficient credits" — same remediation as
		// unauthorized (operator action), but conceptually its own slot.
		// Route to ErrUnauthorized so the alarm fires.
		return &httpStatusError{status: code, body: bodyStr, sentinel: ErrUnauthorized, header: resp.Header}
	case code >= 500:
		return &httpStatusError{status: code, body: bodyStr, sentinel: ErrProviderDown, header: resp.Header}
	default:
		return &httpStatusError{status: code, body: bodyStr, sentinel: ErrProviderDown, header: resp.Header}
	}
}

// httpStatusError carries structured info for chain-side decisions.
type httpStatusError struct {
	status   int
	body     string
	sentinel error
	header   http.Header
}

func (e *httpStatusError) Error() string {
	return fmt.Sprintf("http %d: %s", e.status, truncate(e.body, 200))
}
func (e *httpStatusError) Unwrap() error        { return e.sentinel }
func (e *httpStatusError) Is(target error) bool { return errors.Is(e.sentinel, target) }
func (e *httpStatusError) Status() int          { return e.status }
func (e *httpStatusError) Headers() http.Header { return e.header }

func classifyTransportError(err error, ctx context.Context) error {
	if ctx.Err() != nil {
		return fmt.Errorf("%w: %w", ErrTimeout, ctx.Err())
	}
	// Most net/http errors at this layer mean the upstream didn't even
	// answer — treat as ProviderDown.
	return fmt.Errorf("%w: %w", ErrProviderDown, err)
}

// toOAIMessages converts domain messages into OpenAI wire shape. Text-only
// messages become `content: string`; messages with images become a parts
// array. Matches what services/copilot/infra/llm_openrouter.go does.
func toOAIMessages(in []Message) []oaiMessage {
	out := make([]oaiMessage, 0, len(in))
	for _, m := range in {
		role := string(m.Role)
		if role == "" {
			role = string(RoleUser)
		}
		if len(m.Images) == 0 {
			out = append(out, oaiMessage{Role: role, Content: m.Content})
			continue
		}
		parts := make([]oaiContentPart, 0, 1+len(m.Images))
		if m.Content != "" {
			parts = append(parts, oaiContentPart{Type: "text", Text: m.Content})
		}
		for _, img := range m.Images {
			parts = append(parts, oaiContentPart{
				Type:     "image_url",
				ImageURL: &oaiImageURL{URL: encodeDataURI(img)},
			})
		}
		out = append(out, oaiMessage{Role: role, Content: parts})
	}
	return out
}

func encodeDataURI(img Image) string {
	mime := img.MimeType
	if mime == "" {
		mime = "image/png"
	}
	return "data:" + mime + ";base64," + base64.StdEncoding.EncodeToString(img.Data)
}

func hasImages(msgs []Message) bool {
	return slices.ContainsFunc(msgs, func(m Message) bool { return len(m.Images) > 0 })
}

func jsonFormat(enabled bool) *oaiRF {
	if !enabled {
		return nil
	}
	return &oaiRF{Type: "json_object"}
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}

func coalesce(xs ...string) string {
	for _, s := range xs {
		if s != "" {
			return s
		}
	}
	return ""
}

// stripProviderPrefix removes the leading "<provider>/" token from a
// model id so drivers pass only the upstream-native id (e.g. "groq/
// llama-3.3-70b" → "llama-3.3-70b" for Groq). OpenRouter expects the
// full "vendor/model" form — its driver overrides this to identity.
func stripProviderPrefix(m string) string {
	if idx := strings.Index(m, "/"); idx > 0 {
		return m[idx+1:]
	}
	return m
}

package aiapi

import (
	"context"
	"encoding/json"
	"strings"

	aiv1 "github.com/sedorofeevd/project-druzya/services/ai/pkg/api/ai/v1"
	"github.com/sedorofeevd/project-druzya/services/ai/internal/adapter/llm/llmchain"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/structpb"
)

const trackerClassifySystemPrompt = `You classify user task titles for a learning tracker.
Return ONLY valid JSON with keys:
- kind: one of "learning", "event", "life", "general"
- metadata: object with optional keys task_kind (same as kind), skill_key, book, chapter, topic, event_time (HH:MM), event_date (DD.MM or DD.MM.YYYY), action_path
- epic_hint: optional epic name string (e.g. "DDIA", "Events", "Life") or omit

Rules:
- For kind=learning you MUST set skill_key (snake_case, e.g. distributed_systems, replication, algorithm.arrays) and epic_hint when obvious.
- For kind=event set event_time when a clock time appears; set epic_hint to "Events".
- For kind=life set epic_hint to "Life".

learning = study/practice/read/mock/retry content.
event = meetings, calls, interviews with a schedule.
life = errands, health, shopping, personal admin.
general = everything else.`

// ClassifyTrackerTask uses LLM to parse a free-text task title.
func (i *Implementation) ClassifyTrackerTask(
	ctx context.Context,
	req *aiv1.ClassifyTrackerTaskRequest,
) (*aiv1.ClassifyTrackerTaskResponse, error) {
	title := strings.TrimSpace(req.GetTitle())
	if title == "" {
		return nil, invalidArgument("title is required")
	}
	chain, tier := i.sdChatChain("")
	if chain == nil {
		return nil, status.Error(codes.FailedPrecondition, "llm chain not configured")
	}
	resp, err := chain.Chat(ctx, llmchain.Request{
		Task:        llmchain.TaskTrackerClassify,
		UserTier:    tier,
		JSONMode:    true,
		Temperature: 0.1,
		MaxTokens:   300,
		Messages: []llmchain.Message{
			{Role: llmchain.RoleSystem, Content: trackerClassifySystemPrompt},
			{Role: llmchain.RoleUser, Content: title},
		},
	})
	if err != nil {
		return nil, status.Error(codes.Internal, "llm call failed")
	}
	var parsed struct {
		Kind     string         `json:"kind"`
		Metadata map[string]any `json:"metadata"`
		EpicHint *string        `json:"epic_hint"`
	}
	raw := strings.TrimSpace(resp.Content)
	if err := json.Unmarshal([]byte(raw), &parsed); err != nil {
		return nil, status.Error(codes.Internal, "invalid llm json")
	}
	kind := strings.TrimSpace(parsed.Kind)
	if kind == "" {
		kind = "general"
	}
	meta := parsed.Metadata
	if meta == nil {
		meta = map[string]any{}
	}
	meta["task_kind"] = kind
	st, err := structpb.NewStruct(meta)
	if err != nil {
		return nil, status.Error(codes.Internal, "metadata mapping failed")
	}
	out := &aiv1.ClassifyTrackerTaskResponse{Kind: kind, Metadata: st}
	if parsed.EpicHint != nil && strings.TrimSpace(*parsed.EpicHint) != "" {
		hint := strings.TrimSpace(*parsed.EpicHint)
		out.EpicHint = &hint
	}
	return out, nil
}

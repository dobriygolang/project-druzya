package aiapi

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	aiv1 "github.com/sedorofeevd/project-druzya/services/ai/pkg/api/ai/v1"
	"github.com/sedorofeevd/project-druzya/services/ai/internal/adapter/llm/llmchain"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/structpb"
)

const sdCheckpointSystemPrompt = `You are a system design reviewer. Critique the candidate's work for the given phase.
When an architecture diagram image is attached, reference concrete components and flows you see.
Be specific: name gaps, risks, and one concrete improvement. Under 180 words.
Use the candidate's language (Russian or English).`

// RunSystemDesignCheckpoint critiques workspace state for the current phase.
func (i *Implementation) RunSystemDesignCheckpoint(
	ctx context.Context,
	req *aiv1.RunSystemDesignCheckpointRequest,
) (*aiv1.RunSystemDesignCheckpointResponse, error) {
	if req.GetUserId() == "" || req.GetTaskId() == "" {
		return nil, invalidArgument("user_id and task_id are required")
	}
	chain, tier := i.sdChatChain(req.GetUserId())
	if chain == nil {
		return nil, status.Error(codes.FailedPrecondition, "llm chain not configured")
	}

	var b strings.Builder
	if req.TaskTitle != nil {
		fmt.Fprintf(&b, "Task: %s\n", *req.TaskTitle)
	}
	if req.TaskDescription != nil {
		fmt.Fprintf(&b, "Description:\n%s\n\n", *req.TaskDescription)
	}
	fmt.Fprintf(&b, "Phase to review: %s\n", req.GetPhase())
	if req.WorkspaceSnapshot != nil {
		snap, _ := json.MarshalIndent(req.WorkspaceSnapshot.AsMap(), "", "  ")
		fmt.Fprintf(&b, "Workspace:\n%s\n", string(snap))
	}

	pngB64 := ""
	if req.DiagramPngBase64 != nil {
		pngB64 = *req.DiagramPngBase64
	}
	userMsg := llmchain.Message{Role: llmchain.RoleUser, Content: b.String()}
	if imgs := pngBase64ToImages(pngB64); len(imgs) > 0 {
		userMsg.Images = imgs
		userMsg.Content += "\n\nArchitecture diagram attached — analyze it together with the workspace JSON."
	}

	resp, err := chain.Chat(ctx, llmchain.Request{
		Task:        llmchain.TaskSysDesignCritique,
		UserTier:    tier,
		Temperature: 0.4,
		MaxTokens:   500,
		Messages: []llmchain.Message{
			{Role: llmchain.RoleSystem, Content: sdCheckpointSystemPrompt},
			userMsg,
		},
	})
	if err != nil {
		return nil, status.Error(codes.Internal, "llm call failed")
	}
	critique := strings.TrimSpace(resp.Content)
	if critique == "" {
		critique = "Continue detailing components, data flows, and failure modes for this phase."
	}
	meta, _ := structpb.NewStruct(map[string]any{
		"provider":    string(resp.Provider),
		"model":       resp.Model,
		"phase":       req.GetPhase(),
		"vision_used": len(userMsg.Images) > 0,
	})
	return &aiv1.RunSystemDesignCheckpointResponse{
		Critique: critique,
		Metadata: meta,
	}, nil
}

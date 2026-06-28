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

const sdInterviewerSystemPrompt = `You are a senior/staff system design interviewer at a top tech company.
Conduct a realistic mock: ask one focused follow-up at a time, push back on vague answers, demand numbers and tradeoffs.
Stay in character. Reply in the same language the candidate uses (Russian or English).
Do not grade yet — this is live dialogue. Keep replies under 120 words unless summarizing.`

// RunSystemDesignInterviewerTurn generates the next interviewer message.
func (i *Implementation) RunSystemDesignInterviewerTurn(
	ctx context.Context,
	req *aiv1.RunSystemDesignInterviewerTurnRequest,
) (*aiv1.RunSystemDesignInterviewerTurnResponse, error) {
	if req.GetUserId() == "" || req.GetTaskId() == "" {
		return nil, invalidArgument("user_id and task_id are required")
	}
	chain, tier := i.sdChatChain(req.GetUserId())
	if chain == nil {
		return nil, status.Error(codes.FailedPrecondition, "llm chain not configured")
	}

	userPrompt := buildSDInterviewerUserPrompt(req)
	resp, err := chain.Chat(ctx, llmchain.Request{
		Task:        llmchain.TaskSystemDesignSeniorMock,
		UserTier:    tier,
		Temperature: 0.5,
		MaxTokens:   400,
		Messages: []llmchain.Message{
			{Role: llmchain.RoleSystem, Content: sdInterviewerSystemPrompt},
			{Role: llmchain.RoleUser, Content: userPrompt},
		},
	})
	if err != nil {
		return nil, status.Error(codes.Internal, "llm call failed")
	}
	reply := strings.TrimSpace(resp.Content)
	if reply == "" {
		reply = "Could you elaborate on your assumptions and scale targets?"
	}
	meta, _ := structpb.NewStruct(map[string]any{
		"provider": string(resp.Provider),
		"model":    resp.Model,
	})
	return &aiv1.RunSystemDesignInterviewerTurnResponse{
		Reply:    reply,
		Metadata: meta,
	}, nil
}

func buildSDInterviewerUserPrompt(req *aiv1.RunSystemDesignInterviewerTurnRequest) string {
	var b strings.Builder
	if req.TaskTitle != nil {
		fmt.Fprintf(&b, "Task: %s\n", *req.TaskTitle)
	}
	if req.TaskDescription != nil {
		fmt.Fprintf(&b, "Description:\n%s\n\n", *req.TaskDescription)
	}
	fmt.Fprintf(&b, "Current phase: %s\n\n", req.GetPhase())
	if req.WorkspaceSnapshot != nil {
		snap, _ := json.MarshalIndent(req.WorkspaceSnapshot.AsMap(), "", "  ")
		fmt.Fprintf(&b, "Workspace snapshot (JSON):\n%s\n\n", string(snap))
	}
	if len(req.GetTurns()) > 0 {
		b.WriteString("Conversation so far:\n")
		for _, t := range req.GetTurns() {
			fmt.Fprintf(&b, "[%s/%s] %s: %s\n", t.GetPhase(), t.GetRole(), t.GetRole(), t.GetContent())
		}
		b.WriteString("\nRespond as the interviewer to the latest candidate message.")
	} else {
		b.WriteString("Open the clarification phase: greet briefly and ask the first requirements question.")
	}
	return b.String()
}

func (i *Implementation) sdChatChain(_ string) (llmchain.ChatClient, llmchain.SubscriptionPlan) {
	if i.chains == nil || i.chains.Free == nil {
		return nil, llmchain.SubscriptionPlanFree
	}
	return i.chains.Free, llmchain.SubscriptionPlanFree
}

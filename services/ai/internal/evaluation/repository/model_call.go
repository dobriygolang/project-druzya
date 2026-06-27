package repository

import (
	"context"
	"fmt"

	evaluationmodel "github.com/sedorofeevd/project-druzya/services/ai/internal/evaluation/model"
)

func (r *Repository) CreateModelCall(ctx context.Context, call *evaluationmodel.ModelCall) error {
	_, err := r.conn(ctx).Exec(ctx, `
		INSERT INTO model_calls (
			id, evaluation_job_id, provider, model, request_json, response_json,
			parsed_result, prompt_tokens, completion_tokens, total_tokens,
			cost_usd, latency_ms, error, call_no, created_at
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
	`, call.ID, call.EvaluationJobID, call.Provider, call.Model, call.RequestJSON, call.ResponseJSON,
		call.ParsedResult, call.PromptTokens, call.CompletionTokens, call.TotalTokens,
		decimalPtrToNumeric(call.CostUSD), call.LatencyMS, call.Error, call.CallNo, call.CreatedAt)
	if err != nil {
		return fmt.Errorf("insert model call: %w", err)
	}
	return nil
}

func (r *Repository) CountModelCalls(ctx context.Context, jobID string) (int, error) {
	row := r.conn(ctx).QueryRow(ctx, `
		SELECT COUNT(*) FROM model_calls WHERE evaluation_job_id = $1
	`, jobID)
	var count int
	if err := row.Scan(&count); err != nil {
		return 0, fmt.Errorf("count model calls: %w", err)
	}
	return count, nil
}

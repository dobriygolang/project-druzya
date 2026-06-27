package contentapi

import (
	"context"
	"strings"

	contentv1 "github.com/sedorofeevd/project-druzya/services/content/pkg/api/content/v1"
	catalogmodel "github.com/sedorofeevd/project-druzya/services/content/internal/catalog/model"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
)

const adminTokenHeader = "x-admin-token"

// AdminInterceptor validates admin token for ContentAdminService RPCs.
func AdminInterceptor(token string) grpc.UnaryServerInterceptor {
	return func(ctx context.Context, req any, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (any, error) {
		if !strings.Contains(info.FullMethod, "ContentAdminService/") {
			return handler(ctx, req)
		}
		if token == "" {
			return nil, status.Error(codes.Unauthenticated, "admin token not configured")
		}
		md, ok := metadata.FromIncomingContext(ctx)
		if !ok {
			return nil, status.Error(codes.Unauthenticated, "missing metadata")
		}
		vals := md.Get(adminTokenHeader)
		if len(vals) == 0 || vals[0] != token {
			return nil, status.Error(codes.Unauthenticated, "invalid admin token")
		}
		return handler(ctx, req)
	}
}

// UpsertCompany creates or updates a company (admin).
func (i *Implementation) UpsertCompany(ctx context.Context, req *contentv1.UpsertCompanyRequest) (*contentv1.UpsertCompanyResponse, error) {
	company, err := i.service.UpsertCompany(ctx, catalogmodel.Company{
		ID:          req.GetId(),
		Slug:        req.GetSlug(),
		Name:        req.GetName(),
		Description: optionalString(req.Description),
		IsActive:    req.GetIsActive(),
	})
	if err != nil {
		return nil, mapServiceError(err)
	}
	return &contentv1.UpsertCompanyResponse{Company: toProtoCompany(company)}, nil
}

// UpsertTask creates or updates a task (admin).
func (i *Implementation) UpsertTask(ctx context.Context, req *contentv1.UpsertTaskRequest) (*contentv1.UpsertTaskResponse, error) {
	meta := []byte("{}")
	if req.GetMetadata() != nil {
		raw, err := req.GetMetadata().MarshalJSON()
		if err != nil {
			return nil, invalidArgument("invalid metadata")
		}
		meta = raw
	}
	var est *int
	if req.EstimatedMinutes != nil {
		v := int(req.GetEstimatedMinutes())
		est = &v
	}
	task, err := i.service.UpsertTask(ctx, catalogmodel.Task{
		ID:               req.GetId(),
		Slug:             req.GetSlug(),
		Type:             req.GetType(),
		Title:            req.GetTitle(),
		Description:      req.GetDescription(),
		Difficulty:       req.GetDifficulty(),
		EstimatedMinutes: est,
		Metadata:         meta,
		Status:           req.GetStatus(),
	})
	if err != nil {
		return nil, mapServiceError(err)
	}
	protoTask, err := toProtoTask(task)
	if err != nil {
		return nil, mapServiceError(err)
	}
	return &contentv1.UpsertTaskResponse{Task: protoTask}, nil
}

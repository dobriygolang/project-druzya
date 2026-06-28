package recommendationapi

import (
	"context"

	recommendationv1 "github.com/sedorofeevd/project-druzya/services/recommendation/pkg/api/recommendation/v1"
	"google.golang.org/protobuf/types/known/timestamppb"
)

// MarkArticleRead records that the user finished a knowledge-base article.
func (i *Implementation) MarkArticleRead(ctx context.Context, req *recommendationv1.MarkArticleReadRequest) (*recommendationv1.MarkArticleReadResponse, error) {
	userID, err := requireUserID(ctx)
	if err != nil {
		return nil, err
	}
	slug := req.GetSlug()
	if slug == "" {
		return nil, invalidArgument("slug is required")
	}
	read, err := i.service.MarkArticleRead(ctx, userID, slug)
	if err != nil {
		return nil, mapServiceError(err)
	}
	return &recommendationv1.MarkArticleReadResponse{
		Slug:   read.Slug,
		ReadAt: timestamppb.New(read.ReadAt),
	}, nil
}

package templateapi

import (
	"context"

	templatev1 "github.com/sedorofeevd/project-druzya/services/template/pkg/api/template/v1"
)

// GetItem returns an item by id or slug.
func (i *Implementation) GetItem(ctx context.Context, req *templatev1.GetItemRequest) (*templatev1.GetItemResponse, error) {
	if err := requireIDOrSlug(req.GetId(), req.GetSlug()); err != nil {
		return nil, err
	}

	item, err := i.service.GetItem(ctx, req.GetId(), req.GetSlug())
	if err != nil {
		return nil, mapServiceError(err)
	}
	return &templatev1.GetItemResponse{Item: toProtoItem(item)}, nil
}

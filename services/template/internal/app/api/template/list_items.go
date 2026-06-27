package templateapi

import (
	"context"

	templatev1 "github.com/sedorofeevd/project-druzya/services/template/pkg/api/template/v1"
)

// ListItems returns paginated items.
func (i *Implementation) ListItems(ctx context.Context, req *templatev1.ListItemsRequest) (*templatev1.ListItemsResponse, error) {
	items, err := i.service.ListItems(ctx, int(req.GetLimit()), int(req.GetOffset()))
	if err != nil {
		return nil, mapServiceError(err)
	}

	protoItems := make([]*templatev1.Item, 0, len(items))
	for idx := range items {
		protoItems = append(protoItems, toProtoItem(&items[idx]))
	}
	return &templatev1.ListItemsResponse{Items: protoItems}, nil
}

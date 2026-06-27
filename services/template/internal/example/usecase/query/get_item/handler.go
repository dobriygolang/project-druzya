package get_item

import (
	"context"

	examplemodel "github.com/sedorofeevd/project-druzya/services/template/internal/example/model"
)

// ItemReader is the persistence port this query needs (consumer-side interface).
//
//go:generate go run github.com/vektra/mockery/v2@v2.53.5 --case=underscore --with-expecter --name=ItemReader --output=./mocks --outpkg=mocks --filename=item_reader.go
type ItemReader interface {
	GetItemByID(ctx context.Context, id string) (*examplemodel.Item, error)
	GetItemBySlug(ctx context.Context, slug string) (*examplemodel.Item, error)
}

// Handler resolves an item by id or slug.
type Handler struct {
	reader ItemReader
}

// New constructs the get-item query handler.
func New(reader ItemReader) *Handler {
	return &Handler{reader: reader}
}

// Handle executes the query.
func (h *Handler) Handle(ctx context.Context, q Query) (*examplemodel.Item, error) {
	if err := q.Validate(); err != nil {
		return nil, err
	}
	if q.ID != "" {
		return h.reader.GetItemByID(ctx, q.ID)
	}
	return h.reader.GetItemBySlug(ctx, q.Slug)
}

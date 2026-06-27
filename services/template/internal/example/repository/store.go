package repository

import (
	"context"

	examplemodel "github.com/sedorofeevd/project-druzya/services/template/internal/example/model"
)

// Store is the persistence port consumed by the domain/usecase layers. The
// concrete Postgres Repository satisfies it; tests use a generated mock.
// New services should define a Store (or per-usecase) interface like this so the
// service is testable without a database.
type Store interface {
	ListItems(ctx context.Context, f ListItemsFilter) ([]examplemodel.Item, error)
	GetItemByID(ctx context.Context, id string) (*examplemodel.Item, error)
	GetItemBySlug(ctx context.Context, slug string) (*examplemodel.Item, error)
}

var _ Store = (*Repository)(nil)

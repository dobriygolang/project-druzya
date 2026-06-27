// Package get_item is the reference CQRS query for the template service:
// one operation = one package with a validated Query and a Handler that depends
// on a small consumer-side interface. Copy this shape for new read operations.
package get_item

import (
	"fmt"

	examplemodel "github.com/sedorofeevd/project-druzya/services/template/internal/example/model"
)

// Query selects an item by id or slug.
type Query struct {
	ID   string
	Slug string
}

// Validate ensures at least one selector is present.
func (q Query) Validate() error {
	if q.ID == "" && q.Slug == "" {
		return fmt.Errorf("id or slug is required: %w", examplemodel.ErrInvalidArgument)
	}
	return nil
}

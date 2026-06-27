package get_item_test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	examplemodel "github.com/sedorofeevd/project-druzya/services/template/internal/example/model"
	"github.com/sedorofeevd/project-druzya/services/template/internal/example/usecase/query/get_item"
	"github.com/sedorofeevd/project-druzya/services/template/internal/example/usecase/query/get_item/mocks"
)

func TestQueryValidate(t *testing.T) {
	t.Parallel()
	require.ErrorIs(t, get_item.Query{}.Validate(), examplemodel.ErrInvalidArgument)
	require.NoError(t, get_item.Query{ID: "1"}.Validate())
	require.NoError(t, get_item.Query{Slug: "x"}.Validate())
}

func TestHandleByID(t *testing.T) {
	t.Parallel()
	reader := mocks.NewItemReader(t)
	reader.EXPECT().GetItemByID(mock.Anything, "1").Return(&examplemodel.Item{ID: "1"}, nil)

	got, err := get_item.New(reader).Handle(context.Background(), get_item.Query{ID: "1"})
	require.NoError(t, err)
	require.Equal(t, "1", got.ID)
}

func TestHandleInvalid(t *testing.T) {
	t.Parallel()
	reader := mocks.NewItemReader(t)
	_, err := get_item.New(reader).Handle(context.Background(), get_item.Query{})
	require.ErrorIs(t, err, examplemodel.ErrInvalidArgument)
}

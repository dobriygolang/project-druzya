package templateapi

import (
	examplemodel "github.com/sedorofeevd/project-druzya/services/template/internal/example/model"
	exampleservice "github.com/sedorofeevd/project-druzya/services/template/internal/example/service"
	templatev1 "github.com/sedorofeevd/project-druzya/services/template/pkg/api/template/v1"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"
)

func toProtoItem(item *examplemodel.Item) *templatev1.Item {
	if item == nil {
		return nil
	}
	return &templatev1.Item{
		Id:        item.ID,
		Slug:      item.Slug,
		Title:     item.Title,
		CreatedAt: timestamppb.New(item.CreatedAt),
		UpdatedAt: timestamppb.New(item.UpdatedAt),
	}
}

func mapServiceError(err error) error {
	if exampleservice.IsNotFound(err) {
		return notFound("not found")
	}
	return status.Error(codes.Internal, "internal error")
}

func requireIDOrSlug(id, slug string) error {
	if id == "" && slug == "" {
		return invalidArgument("id or slug is required")
	}
	return nil
}

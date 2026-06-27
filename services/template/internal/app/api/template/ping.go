package templateapi

import (
	"context"

	templatev1 "github.com/sedorofeevd/project-druzya/services/template/pkg/api/template/v1"
	"google.golang.org/protobuf/types/known/emptypb"
)

// Ping is a health-style RPC without dependencies.
func (i *Implementation) Ping(ctx context.Context, _ *emptypb.Empty) (*templatev1.PingResponse, error) {
	message, err := i.service.Ping(ctx)
	if err != nil {
		return nil, mapServiceError(err)
	}
	return &templatev1.PingResponse{Message: message}, nil
}

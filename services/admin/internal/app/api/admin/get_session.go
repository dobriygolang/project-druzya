package adminapi

import (
	"context"

	adminv1 "github.com/sedorofeevd/project-druzya/services/admin/pkg/api/admin/v1"
)

// GetSession returns the authenticated admin user id.
func (i *Implementation) GetSession(ctx context.Context, _ *adminv1.GetSessionRequest) (*adminv1.GetSessionResponse, error) {
	userID, err := requireUserID(ctx)
	if err != nil {
		return nil, err
	}
	return &adminv1.GetSessionResponse{UserId: userID}, nil
}

package service

import (
	"context"
)

func (s *trackerService) syncEpicsForTask(ctx context.Context, epicIDs ...*string) error {
	seen := map[string]struct{}{}
	for _, id := range epicIDs {
		if id == nil || *id == "" {
			continue
		}
		if _, ok := seen[*id]; ok {
			continue
		}
		seen[*id] = struct{}{}
		if err := s.repo.SyncEpicStatus(ctx, *id); err != nil {
			return err
		}
	}
	return nil
}

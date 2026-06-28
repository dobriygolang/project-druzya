package app

import (
	"context"
	"time"

	natsadapter "github.com/sedorofeevd/project-druzya/services/interview/internal/adapter/nats"
	"github.com/sedorofeevd/project-druzya/services/interview/internal/outboxrelay"
)

// RunOutboxRelay publishes claimed outbox rows to NATS when enabled.
func RunOutboxRelay(ctx context.Context, a *App) error {
	pub, err := natsadapter.Connect(a.Config.NATSURL)
	if err != nil {
		return err
	}
	defer pub.Close()

	return outboxrelay.Run(ctx, a.Logger, a.Service, pub, 2*time.Second, 20)
}

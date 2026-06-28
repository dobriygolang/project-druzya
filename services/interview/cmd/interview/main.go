package main

import (
	"context"
	"os"
	"os/signal"
	"sync"
	"syscall"

	"github.com/sedorofeevd/project-druzya/services/interview/cmd/interview/app"
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	a, err := app.New(ctx)
	if err != nil {
		panic(err)
	}
	defer a.Close()

	var wg sync.WaitGroup
	errCh := make(chan error, 2)

	if a.Config.OutboxRelayEnabled {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if err := app.RunOutboxRelay(ctx, a); err != nil {
				errCh <- err
			}
		}()
	}

	wg.Add(1)
	go func() {
		defer wg.Done()
		if err := app.RunAPI(ctx, a); err != nil {
			errCh <- err
		}
	}()

	select {
	case <-ctx.Done():
	case err := <-errCh:
		if err != nil {
			panic(err)
		}
	}

	stop()
	wg.Wait()
}

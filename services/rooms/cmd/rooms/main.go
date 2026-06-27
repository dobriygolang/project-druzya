package main

import (
	"context"
	"os"
	"os/signal"
	"syscall"

	"github.com/sedorofeevd/project-druzya/services/rooms/cmd/rooms/app"
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	application, err := app.New(ctx)
	if err != nil {
		panic(err)
	}
	defer application.Close()

	if err := app.RunAPI(ctx, application); err != nil {
		application.Logger.Error("server stopped", "err", err)
		os.Exit(1)
	}
}

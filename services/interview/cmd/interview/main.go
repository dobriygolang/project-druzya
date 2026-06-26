package main

import (
	"context"
	"os"
	"os/signal"
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
	worker := false
	for _, arg := range os.Args[1:] {
		if arg == "--worker" {
			worker = true
		}
	}

	if worker {
		if err := app.RunWorker(ctx, a); err != nil {
			panic(err)
		}
		return
	}

	if err := app.RunAPI(ctx, a); err != nil {
		panic(err)
	}
}

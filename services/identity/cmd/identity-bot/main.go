package main

import (
	"context"
	"os"
	"os/signal"
	"syscall"

	authrepo "github.com/sedorofeevd/project-druzya/services/identity/internal/auth/repository"
	"github.com/sedorofeevd/project-druzya/services/identity/internal/bot"
	"github.com/sedorofeevd/project-druzya/services/identity/internal/config"
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	cfg, err := config.LoadBot()
	if err != nil {
		panic(err)
	}

	redisClient, err := authrepo.New(ctx, cfg.RedisAddr)
	if err != nil {
		panic(err)
	}
	defer func() { _ = redisClient.Close() }()

	tgBot, err := bot.New(cfg.TelegramBotToken, authrepo.NewLoginCodeRepository(redisClient))
	if err != nil {
		panic(err)
	}

	if err := tgBot.Run(ctx); err != nil && ctx.Err() == nil {
		panic(err)
	}
}

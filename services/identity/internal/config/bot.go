package config

import "fmt"

// BotConfig holds Telegram bot configuration.
type BotConfig struct {
	RedisAddr        string
	TelegramBotToken string
}

// LoadBot reads bot configuration from environment variables.
func LoadBot() (*BotConfig, error) {
	token := getEnv("TELEGRAM_BOT_TOKEN", "")
	if token == "" {
		return nil, fmt.Errorf("TELEGRAM_BOT_TOKEN is required")
	}

	return &BotConfig{
		RedisAddr:        getEnv("REDIS_ADDR", "localhost:6379"),
		TelegramBotToken: token,
	}, nil
}

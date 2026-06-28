package bot

import (
	"context"
	"fmt"
	"strings"
	"time"

	tgbotapi "github.com/go-telegram-bot-api/telegram-bot-api/v5"
	"github.com/sedorofeevd/project-druzya/services/identity/internal/adapter/telegram"
	"github.com/sedorofeevd/project-druzya/services/identity/internal/auth/logincode"
	"github.com/sedorofeevd/project-druzya/services/identity/internal/auth/model"
	authrepo "github.com/sedorofeevd/project-druzya/services/identity/internal/auth/repository"
)

const loginCodeTTLSeconds = 300

// Bot handles Telegram login code delivery.
type Bot struct {
	api        *tgbotapi.BotAPI
	loginCodes *authrepo.LoginCodeRepository
}

// New constructs a Telegram bot.
func New(token string, loginCodes *authrepo.LoginCodeRepository) (*Bot, error) {
	api, err := tgbotapi.NewBotAPI(token)
	if err != nil {
		return nil, fmt.Errorf("init telegram bot: %w", err)
	}
	return &Bot{
		api:        api,
		loginCodes: loginCodes,
	}, nil
}

// Run starts long-polling until context is cancelled.
func (b *Bot) Run(ctx context.Context) error {
	updateCfg := tgbotapi.NewUpdate(0)
	updateCfg.Timeout = 30
	updates := b.api.GetUpdatesChan(updateCfg)

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case update, ok := <-updates:
			if !ok {
				return nil
			}
			if update.Message == nil {
				continue
			}
			if err := b.handleMessage(ctx, update.Message); err != nil {
				_, _ = b.api.Send(tgbotapi.NewMessage(update.Message.Chat.ID, "Не удалось выдать код. Попробуйте позже."))
			}
		}
	}
}

func (b *Bot) handleMessage(ctx context.Context, message *tgbotapi.Message) error {
	if !message.IsCommand() {
		return nil
	}

	command := message.Command()
	if command != "start" {
		return nil
	}

	args := strings.TrimSpace(message.CommandArguments())
	if args != "" && args != "login" {
		return nil
	}

	code, err := logincode.Generate(8)
	if err != nil {
		return err
	}

	expiresAt := time.Now().UTC().Add(loginCodeTTLSeconds * time.Second)
	payload := &model.TelegramLoginCode{
		TelegramID: message.From.ID,
		FirstName:  message.From.FirstName,
		LastName:   message.From.LastName,
		Username:   message.From.UserName,
		AvatarURL:  resolveTelegramAvatar(b.api, message.From.ID),
		ExpiresAt:  expiresAt,
	}

	if err := b.loginCodes.Save(ctx, code, payload, loginCodeTTLSeconds); err != nil {
		return err
	}

	text := fmt.Sprintf("Код для входа: %s\n\nВведите его на сайте. Код действует 5 минут.", code)
	msg := tgbotapi.NewMessage(message.Chat.ID, text)
	_, err = b.api.Send(msg)
	return err
}

func resolveTelegramAvatar(api *tgbotapi.BotAPI, userID int64) string {
	path, err := telegram.ProfilePhotoFilePath(api, userID)
	if err != nil || path == "" {
		return ""
	}
	return telegram.StoreRef(path)
}

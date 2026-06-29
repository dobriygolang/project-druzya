package service

import (
	"context"
	"errors"
	"strings"
	"time"

	focusmodel "github.com/sedorofeevd/project-druzya/services/focus/internal/focus/model"
	focusrepo "github.com/sedorofeevd/project-druzya/services/focus/internal/focus/repository"
)

// ErrNotFound is returned when an entity does not exist.
var ErrNotFound = focusmodel.ErrNotFound

// ErrInvalidArgument is returned when required input is missing or malformed.
var ErrInvalidArgument = focusmodel.ErrInvalidArgument

// Service is the focus domain API.
type Service interface {
	StartFocusSession(ctx context.Context, userID string, mode, pinnedTitle, taskID string) (*focusmodel.Session, error)
	EndFocusSession(ctx context.Context, userID, sessionID string, secondsFocused, pomodorosCompleted int) (*focusmodel.Session, error)
	GetStats(ctx context.Context, userID, upToDate string) (*focusmodel.Stats, error)
}

type focusService struct {
	repo focusrepo.Store
}

// Deps holds service dependencies.
type Deps struct {
	Repo focusrepo.Store
}

// New constructs the domain service.
func New(deps Deps) Service {
	return &focusService{repo: deps.Repo}
}

func (s *focusService) StartFocusSession(
	ctx context.Context,
	userID, mode, pinnedTitle, taskID string,
) (*focusmodel.Session, error) {
	if strings.TrimSpace(userID) == "" {
		return nil, ErrInvalidArgument
	}
	mode = strings.TrimSpace(mode)
	if mode == "" {
		mode = "pomodoro"
	}
	if mode != "pomodoro" && mode != "stopwatch" {
		return nil, ErrInvalidArgument
	}
	var taskPtr *string
	if tid := strings.TrimSpace(taskID); tid != "" {
		taskPtr = &tid
	}
	return s.repo.CreateSession(ctx, userID, mode, strings.TrimSpace(pinnedTitle), taskPtr)
}

func (s *focusService) EndFocusSession(
	ctx context.Context,
	userID, sessionID string,
	secondsFocused, pomodorosCompleted int,
) (*focusmodel.Session, error) {
	if strings.TrimSpace(userID) == "" || strings.TrimSpace(sessionID) == "" {
		return nil, ErrInvalidArgument
	}
	if secondsFocused < 0 || pomodorosCompleted < 0 {
		return nil, ErrInvalidArgument
	}
	sess, err := s.repo.EndSession(ctx, userID, sessionID, secondsFocused, pomodorosCompleted)
	if errors.Is(err, focusmodel.ErrNotFound) {
		return nil, ErrNotFound
	}
	return sess, err
}

func (s *focusService) GetStats(ctx context.Context, userID, upToDate string) (*focusmodel.Stats, error) {
	if strings.TrimSpace(userID) == "" {
		return nil, ErrInvalidArgument
	}
	upTo := time.Now().UTC().Truncate(24 * time.Hour)
	if d := strings.TrimSpace(upToDate); d != "" {
		parsed, err := time.Parse("2006-01-02", d)
		if err != nil {
			return nil, ErrInvalidArgument
		}
		upTo = parsed.UTC()
	}
	return s.repo.GetStats(ctx, userID, upTo)
}

// IsNotFound reports whether err is a not-found error.
func IsNotFound(err error) bool {
	return errors.Is(err, ErrNotFound)
}

// IsInvalidArgument reports whether err is an invalid-argument error.
func IsInvalidArgument(err error) bool {
	return errors.Is(err, ErrInvalidArgument)
}

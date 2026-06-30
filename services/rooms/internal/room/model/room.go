package model

import (
	"time"

	"github.com/google/uuid"
)

type RoomType string

const (
	RoomTypePractice     RoomType = "practice"
	RoomTypeInterview    RoomType = "interview"
	RoomTypePairMock     RoomType = "pair_mock"
	RoomTypeSystemDesign RoomType = "system_design"
)

func (t RoomType) IsValid() bool {
	switch t {
	case RoomTypePractice, RoomTypeInterview, RoomTypePairMock, RoomTypeSystemDesign:
		return true
	}
	return false
}

func (t RoomType) String() string { return string(t) }

type Visibility string

const (
	VisibilityShared  Visibility = "shared"
	VisibilityPrivate Visibility = "private"
)

func (v Visibility) IsValid() bool {
	switch v {
	case VisibilityShared, VisibilityPrivate:
		return true
	}
	return false
}

type Room struct {
	ID             uuid.UUID
	OwnerID        uuid.UUID
	Type           RoomType
	Language       Language
	IsFrozen   bool
	Visibility Visibility
	ExpiresAt     time.Time
	CreatedAt     time.Time
	IsGuestCreated bool
}

type Participant struct {
	RoomID   uuid.UUID
	UserID   uuid.UUID
	Role     Role
	JoinedAt time.Time
}

const DefaultRoomTTL = 6 * time.Hour
const DefaultGuestRoomTTL = 1 * time.Hour

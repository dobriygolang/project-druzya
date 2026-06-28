package model

import "fmt"

// CanEdit returns whether role may mutate CRDT state when room may be frozen.
func CanEdit(role Role, frozen bool) bool {
	switch role {
	case RoleOwner, RoleInterviewer:
		return true
	case RoleParticipant:
		return !frozen
	case RoleViewer:
		return false
	}
	return false
}

// RoleForInvitee picks participant role for a new joiner.
func RoleForInvitee(room Room, existing []Participant) Role {
	switch room.Type {
	case RoomTypeInterview:
		for _, p := range existing {
			if p.Role == RoleInterviewer {
				return RoleParticipant
			}
		}
		return RoleInterviewer
	case RoomTypePairMock, RoomTypePractice, RoomTypeSystemDesign:
		return RoleParticipant
	}
	return RoleViewer
}

// ValidateCreate checks create payload before persistence.
func ValidateCreate(roomType RoomType, lang Language) error {
	if roomType != "" && !roomType.IsValid() {
		return fmt.Errorf("invalid room type %q", roomType)
	}
	if !lang.IsValid() {
		return fmt.Errorf("invalid language %q", lang)
	}
	return nil
}

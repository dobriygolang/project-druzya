package model

type Role string

const (
	RoleOwner       Role = "owner"
	RoleInterviewer Role = "interviewer"
	RoleParticipant Role = "participant"
	RoleViewer      Role = "viewer"
)

func (r Role) IsValid() bool {
	switch r {
	case RoleOwner, RoleInterviewer, RoleParticipant, RoleViewer:
		return true
	}
	return false
}

func (r Role) String() string { return string(r) }

func (r Role) CanEdit() bool {
	switch r {
	case RoleOwner, RoleInterviewer, RoleParticipant:
		return true
	case RoleViewer:
		return false
	}
	return false
}

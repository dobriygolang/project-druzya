package model

// OAuthStateType distinguishes login vs account-link Yandex flows.
type OAuthStateType string

const (
	OAuthStateLogin OAuthStateType = "login"
	OAuthStateLink  OAuthStateType = "link"
)

// OAuthState is stored in Redis while the user completes Yandex OAuth.
type OAuthState struct {
	Type   OAuthStateType
	UserID string
}

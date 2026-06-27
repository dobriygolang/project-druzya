package ws

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"

	"github.com/sedorofeevd/project-druzya/services/identity/pkg/jwt"
	"github.com/sedorofeevd/project-druzya/services/rooms/internal/room/model"
	"github.com/sedorofeevd/project-druzya/services/rooms/internal/room/repository"
)

type RoomStore interface {
	GetRoom(ctx context.Context, id uuid.UUID) (model.Room, error)
	GetRole(ctx context.Context, roomID, userID uuid.UUID) (model.Role, error)
	AddParticipant(ctx context.Context, p model.Participant) (model.Participant, error)
}

type Handler struct {
	Hub      *Hub
	JWT      *jwt.Validator
	Store    RoomStore
	Log      *slog.Logger
	Upgrader websocket.Upgrader
}

func NewHandler(hub *Hub, v *jwt.Validator, store RoomStore, log *slog.Logger) *Handler {
	return &Handler{
		Hub:   hub,
		JWT:   v,
		Store: store,
		Log:   log,
		Upgrader: websocket.Upgrader{
			ReadBufferSize:  8192,
			WriteBufferSize: 8192,
			CheckOrigin:     func(r *http.Request) bool { return true },
		},
	}
}

func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	raw := r.PathValue("roomId")
	roomID, err := uuid.Parse(raw)
	if err != nil {
		http.Error(w, "bad room id", http.StatusBadRequest)
		return
	}

	token := r.URL.Query().Get("token")
	if token == "" {
		if auth := r.Header.Get("Authorization"); strings.HasPrefix(auth, "Bearer ") {
			token = strings.TrimPrefix(auth, "Bearer ")
		}
	}
	if token == "" || h.JWT == nil {
		http.Error(w, "missing token", http.StatusUnauthorized)
		return
	}

	expectedScope := fmt.Sprintf("editor:%s", roomID)
	claims, err := h.JWT.ParseScoped(token, expectedScope)
	if err != nil {
		http.Error(w, "invalid token", http.StatusUnauthorized)
		return
	}
	uid, err := uuid.Parse(claims.UserID)
	if err != nil {
		http.Error(w, "invalid token subject", http.StatusUnauthorized)
		return
	}
	isGuest := claims.Role == jwt.RoleGuest

	room, err := h.Store.GetRoom(r.Context(), roomID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			http.Error(w, "room not found", http.StatusNotFound)
			return
		}
		http.Error(w, "internal", http.StatusInternalServerError)
		return
	}

	var role model.Role
	if isGuest {
		if room.Visibility != model.VisibilityShared {
			http.Error(w, "private room: guests not allowed", http.StatusForbidden)
			return
		}
		role = model.RoleViewer
	} else {
		if room.Visibility == model.VisibilityPrivate && uid != room.OwnerID {
			if _, gerr := h.Store.GetRole(r.Context(), roomID, uid); errors.Is(gerr, repository.ErrNotFound) {
				http.Error(w, "private room: not authorized", http.StatusForbidden)
				return
			}
		}

		var pErr error
		role, pErr = h.Store.GetRole(r.Context(), roomID, uid)
		if pErr != nil {
			if !errors.Is(pErr, repository.ErrNotFound) {
				http.Error(w, "internal", http.StatusInternalServerError)
				return
			}
			if room.Visibility != model.VisibilityShared {
				http.Error(w, "not a participant", http.StatusForbidden)
				return
			}
			row, addErr := h.Store.AddParticipant(r.Context(), model.Participant{
				RoomID:   roomID,
				UserID:   uid,
				Role:     model.RoleParticipant,
				JoinedAt: time.Now().UTC(),
			})
			if addErr != nil {
				http.Error(w, "internal", http.StatusInternalServerError)
				return
			}
			role = row.Role
		}
	}

	ws, err := h.Upgrader.Upgrade(w, r, nil)
	if err != nil {
		if h.Log != nil {
			h.Log.Warn("ws upgrade failed", slog.Any("err", err))
		}
		return
	}

	if h.Hub.RoomResolver == nil {
		h.Hub.RoomResolver = h.Store.GetRoom
	}
	if h.Hub.RoleResolver == nil {
		h.Hub.RoleResolver = h.Store.GetRole
	}

	c := newWSConn(ws, roomID, uid, role, h.Log)
	h.Hub.register(roomID, c)
	go c.writeLoop()

	if snap := h.Hub.SnapshotOf(roomID); len(snap) > 0 {
		payload, _ := json.Marshal(opPayload{Payload: snap})
		env, _ := json.Marshal(Envelope{Kind: KindSnapshot, Data: payload})
		c.enqueue(env)
	}

	h.Hub.readLoop(r.Context(), c)
}

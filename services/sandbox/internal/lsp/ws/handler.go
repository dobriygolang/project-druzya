package ws

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"strings"
	"sync"

	"github.com/gorilla/websocket"

	"github.com/sedorofeevd/project-druzya/services/identity/pkg/jwt"
	"github.com/sedorofeevd/project-druzya/services/sandbox/internal/lsp/gopls"
)

type configMessage struct {
	Type    string `json:"type"`
	RootURI string `json:"rootUri"`
	DocURI  string `json:"docUri"`
}

// Handler upgrades to WebSocket and proxies LSP JSON-RPC to gopls.
type Handler struct {
	JWT       *jwt.Validator
	WorkRoot  string
	GoplsPath string
	Log       *slog.Logger
	Upgrader  websocket.Upgrader
}

func NewHandler(v *jwt.Validator, workRoot, goplsPath string, log *slog.Logger) *Handler {
	if log == nil {
		log = slog.Default()
	}
	return &Handler{
		JWT:       v,
		WorkRoot:  workRoot,
		GoplsPath: goplsPath,
		Log:       log,
		Upgrader: websocket.Upgrader{
			ReadBufferSize:  8192,
			WriteBufferSize: 8192,
			CheckOrigin:     func(r *http.Request) bool { return true },
		},
	}
}

func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if h.JWT == nil {
		http.Error(w, "auth unavailable", http.StatusServiceUnavailable)
		return
	}
	token := r.URL.Query().Get("token")
	if token == "" {
		if auth := r.Header.Get("Authorization"); strings.HasPrefix(auth, "Bearer ") {
			token = strings.TrimPrefix(auth, "Bearer ")
		}
	}
	if token == "" {
		http.Error(w, "missing token", http.StatusUnauthorized)
		return
	}
	if _, err := h.JWT.UserID(token); err != nil {
		http.Error(w, "invalid token", http.StatusUnauthorized)
		return
	}

	ctx := r.Context()
	session, err := gopls.NewSession(ctx, h.WorkRoot, h.GoplsPath)
	if err != nil {
		h.Log.Error("lsp session", "err", err)
		http.Error(w, "gopls unavailable", http.StatusServiceUnavailable)
		return
	}
	defer session.Close()

	ws, err := h.Upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	defer func() { _ = ws.Close() }()

	cfg, err := json.Marshal(configMessage{
		Type:    "config",
		RootURI: session.RootURI,
		DocURI:  session.DocURI,
	})
	if err != nil {
		return
	}
	if err := ws.WriteMessage(websocket.TextMessage, cfg); err != nil {
		return
	}

	var writeMu sync.Mutex
	writeJSON := func(payload []byte) error {
		writeMu.Lock()
		defer writeMu.Unlock()
		return ws.WriteMessage(websocket.TextMessage, payload)
	}

	// gopls -> browser
	go func() {
		for {
			msg, err := session.ReadFromServer()
			if err != nil {
				return
			}
			if err := writeJSON(msg); err != nil {
				return
			}
		}
	}()

	for {
		_, payload, err := ws.ReadMessage()
		if err != nil {
			return
		}
		if err := session.WriteToServer(payload); err != nil {
			return
		}
	}
}

package ws

import (
	"context"
	"encoding/json"
	"log/slog"
	"sync"
	"sync/atomic"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"

	"github.com/sedorofeevd/project-druzya/services/rooms/internal/room/model"
)

const (
	wsRateLimit     = 200
	wsPingInterval  = 30 * time.Second
	wsReadDeadline  = 120 * time.Second
	replayBufferCap = 10_000

	KindOp                = "op"
	KindSnapshot          = "snapshot"
	KindCursor            = "cursor"
	KindFreeze            = "freeze"
	KindRoleChange        = "role_change"
	KindParticipantJoined = "participant_joined"
	KindParticipantLeft   = "participant_left"
	KindError             = "error"
	KindPong              = "pong"

	InOp       = "op"
	InSnapshot = "snapshot"
	InCursor   = "cursor"
	InPresence = "presence"
	InPing     = "ping"
)

type Envelope struct {
	Kind string          `json:"kind"`
	Data json.RawMessage `json:"data,omitempty"`
}

type opPayload struct {
	Payload []byte `json:"payload"`
}

type cursorPayload struct {
	Line   int `json:"line"`
	Column int `json:"column"`
}

type Hub struct {
	Log          *slog.Logger
	RoomResolver func(ctx context.Context, roomID uuid.UUID) (model.Room, error)
	RoleResolver func(ctx context.Context, roomID, userID uuid.UUID) (model.Role, error)

	mu          sync.RWMutex
	rooms       map[uuid.UUID]*roomHub
	seqCounters sync.Map
}

func NewHub(log *slog.Logger) *Hub {
	return &Hub{Log: log, rooms: make(map[uuid.UUID]*roomHub)}
}

type roomHub struct {
	mu           sync.RWMutex
	clients      map[*wsConn]struct{}
	buffer       []bufferedEntry
	bufHead      int
	bufLen       int
	lastSnapshot []byte
}

type bufferedEntry struct {
	Kind      string    `json:"kind"`
	Seq       int64     `json:"seq,omitempty"`
	UserID    uuid.UUID `json:"user_id"`
	Payload   []byte    `json:"payload,omitempty"`
	Line      int       `json:"line,omitempty"`
	Column    int       `json:"column,omitempty"`
	CreatedAt time.Time `json:"created_at"`
}

func (h *Hub) room(roomID uuid.UUID) *roomHub {
	h.mu.RLock()
	rh := h.rooms[roomID]
	h.mu.RUnlock()
	if rh != nil {
		return rh
	}
	h.mu.Lock()
	defer h.mu.Unlock()
	if rh = h.rooms[roomID]; rh != nil {
		return rh
	}
	rh = &roomHub{
		clients: make(map[*wsConn]struct{}),
		buffer:  make([]bufferedEntry, replayBufferCap),
	}
	h.rooms[roomID] = rh
	return rh
}

func (h *Hub) register(roomID uuid.UUID, c *wsConn) {
	rh := h.room(roomID)
	rh.mu.Lock()
	rh.clients[c] = struct{}{}
	rh.mu.Unlock()
	h.Broadcast(roomID, KindParticipantJoined, map[string]any{"user_id": c.userID})
}

func (h *Hub) unregister(roomID uuid.UUID, c *wsConn) {
	h.mu.RLock()
	rh := h.rooms[roomID]
	h.mu.RUnlock()
	if rh == nil {
		return
	}
	rh.mu.Lock()
	delete(rh.clients, c)
	rh.mu.Unlock()
	h.Broadcast(roomID, KindParticipantLeft, map[string]any{"user_id": c.userID})
}

func (h *Hub) Broadcast(roomID uuid.UUID, kind string, data any) {
	var raw json.RawMessage
	if data != nil {
		b, err := json.Marshal(data)
		if err != nil {
			if h.Log != nil {
				h.Log.Error("ws.Broadcast marshal", slog.Any("err", err))
			}
			return
		}
		raw = b
	}
	env, err := json.Marshal(Envelope{Kind: kind, Data: raw})
	if err != nil {
		return
	}
	h.mu.RLock()
	rh := h.rooms[roomID]
	h.mu.RUnlock()
	if rh == nil {
		return
	}
	rh.mu.RLock()
	targets := make([]*wsConn, 0, len(rh.clients))
	for c := range rh.clients {
		targets = append(targets, c)
	}
	rh.mu.RUnlock()
	for _, c := range targets {
		c.enqueue(env)
	}
}

func (h *Hub) BroadcastFreeze(roomID uuid.UUID, frozen bool, actor uuid.UUID) {
	h.Broadcast(roomID, KindFreeze, map[string]any{
		"frozen":   frozen,
		"actor_id": actor,
	})
}

// CloseRoom disconnects all clients in the room and drops in-memory state.
func (h *Hub) CloseRoom(roomID uuid.UUID) {
	h.mu.Lock()
	rh := h.rooms[roomID]
	delete(h.rooms, roomID)
	h.mu.Unlock()
	h.seqCounters.Delete(roomID)
	if rh == nil {
		return
	}
	rh.mu.RLock()
	clients := make([]*wsConn, 0, len(rh.clients))
	for c := range rh.clients {
		clients = append(clients, c)
	}
	rh.mu.RUnlock()
	for _, c := range clients {
		_ = c.ws.Close()
	}
}

func (h *Hub) nextSeq(roomID uuid.UUID) int64 {
	v, _ := h.seqCounters.LoadOrStore(roomID, new(atomic.Int64))
	return v.(*atomic.Int64).Add(1)
}

func (rh *roomHub) pushEntry(e bufferedEntry) {
	rh.mu.Lock()
	defer rh.mu.Unlock()
	rh.buffer[rh.bufHead] = e
	rh.bufHead = (rh.bufHead + 1) % replayBufferCap
	if rh.bufLen < replayBufferCap {
		rh.bufLen++
	}
}

// FlushRoom serialises the rolling replay buffer as JSONL.
func (h *Hub) FlushRoom(roomID uuid.UUID) []byte {
	h.mu.RLock()
	rh := h.rooms[roomID]
	h.mu.RUnlock()
	if rh == nil {
		return nil
	}
	rh.mu.RLock()
	defer rh.mu.RUnlock()
	if rh.bufLen == 0 {
		return nil
	}
	start := (rh.bufHead - rh.bufLen + replayBufferCap) % replayBufferCap
	var out []byte
	for i := 0; i < rh.bufLen; i++ {
		idx := (start + i) % replayBufferCap
		line, err := json.Marshal(rh.buffer[idx])
		if err != nil {
			continue
		}
		out = append(out, line...)
		out = append(out, '\n')
	}
	return out
}

func (h *Hub) SnapshotOf(roomID uuid.UUID) []byte {
	h.mu.RLock()
	rh := h.rooms[roomID]
	h.mu.RUnlock()
	if rh == nil {
		return nil
	}
	rh.mu.RLock()
	defer rh.mu.RUnlock()
	if len(rh.lastSnapshot) == 0 {
		return nil
	}
	out := make([]byte, len(rh.lastSnapshot))
	copy(out, rh.lastSnapshot)
	return out
}

func (h *Hub) CloseAll() {
	h.mu.RLock()
	rooms := make([]*roomHub, 0, len(h.rooms))
	for _, rh := range h.rooms {
		rooms = append(rooms, rh)
	}
	h.mu.RUnlock()
	for _, rh := range rooms {
		rh.mu.RLock()
		for c := range rh.clients {
			_ = c.ws.Close()
		}
		rh.mu.RUnlock()
	}
}

type wsConn struct {
	ws     *websocket.Conn
	roomID uuid.UUID
	userID uuid.UUID
	role   atomic.Value
	out    chan []byte
	done   chan struct{}
	log    *slog.Logger

	rlMu    sync.Mutex
	rlStart time.Time
	rlCount int
}

func newWSConn(ws *websocket.Conn, roomID, userID uuid.UUID, role model.Role, log *slog.Logger) *wsConn {
	c := &wsConn{
		ws:      ws,
		roomID:  roomID,
		userID:  userID,
		out:     make(chan []byte, 128),
		done:    make(chan struct{}),
		log:     log,
		rlStart: time.Now(),
	}
	c.role.Store(role)
	return c
}

func (c *wsConn) currentRole() model.Role {
	v := c.role.Load()
	if v == nil {
		return model.RoleViewer
	}
	return v.(model.Role)
}

func (c *wsConn) enqueue(msg []byte) {
	select {
	case c.out <- msg:
	default:
		if c.log != nil {
			c.log.Warn("ws slow client, frame dropped",
				slog.String("user", c.userID.String()),
				slog.String("room", c.roomID.String()))
		}
	}
}

func (c *wsConn) rateOk() bool {
	c.rlMu.Lock()
	defer c.rlMu.Unlock()
	now := time.Now()
	if now.Sub(c.rlStart) >= time.Second {
		c.rlStart = now
		c.rlCount = 0
	}
	c.rlCount++
	return c.rlCount <= wsRateLimit
}

func (c *wsConn) writeLoop() {
	pinger := time.NewTicker(wsPingInterval)
	defer pinger.Stop()
	for {
		select {
		case <-c.done:
			return
		case <-pinger.C:
			_ = c.ws.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.ws.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		case msg, ok := <-c.out:
			_ = c.ws.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				_ = c.ws.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			if err := c.ws.WriteMessage(websocket.TextMessage, msg); err != nil {
				return
			}
		}
	}
}

func (h *Hub) readLoop(ctx context.Context, c *wsConn) {
	defer func() {
		h.unregister(c.roomID, c)
		close(c.done)
		_ = c.ws.Close()
	}()
	c.ws.SetReadLimit(256 * 1024)
	_ = c.ws.SetReadDeadline(time.Now().Add(wsReadDeadline))
	c.ws.SetPongHandler(func(string) error {
		return c.ws.SetReadDeadline(time.Now().Add(wsReadDeadline))
	})
	for {
		if ctx.Err() != nil {
			return
		}
		_, data, err := c.ws.ReadMessage()
		if err != nil {
			return
		}
		if !c.rateOk() {
			continue
		}
		var env Envelope
		if err := json.Unmarshal(data, &env); err != nil {
			continue
		}
		switch env.Kind {
		case InPing:
			c.enqueue(mustEnvelope(KindPong, nil))
		case InOp:
			role := c.currentRole()
			if !role.CanEdit() {
				continue
			}
			if h.RoomResolver != nil {
				room, rerr := h.RoomResolver(ctx, c.roomID)
				if rerr == nil && !model.CanEdit(role, room.IsFrozen) {
					continue
				}
			}
			var p opPayload
			if err := json.Unmarshal(env.Data, &p); err != nil {
				continue
			}
			seq := h.nextSeq(c.roomID)
			h.room(c.roomID).pushEntry(bufferedEntry{
				Kind: KindOp, Seq: seq, UserID: c.userID, Payload: p.Payload, CreatedAt: time.Now().UTC(),
			})
			h.Broadcast(c.roomID, KindOp, map[string]any{
				"seq": seq, "user_id": c.userID, "payload": p.Payload,
			})
		case InCursor:
			var p cursorPayload
			if err := json.Unmarshal(env.Data, &p); err != nil {
				continue
			}
			h.room(c.roomID).pushEntry(bufferedEntry{
				Kind: KindCursor, UserID: c.userID, Line: p.Line, Column: p.Column, CreatedAt: time.Now().UTC(),
			})
			h.Broadcast(c.roomID, KindCursor, map[string]any{
				"user_id": c.userID, "line": p.Line, "column": p.Column,
			})
		case InPresence:
			h.Broadcast(c.roomID, InPresence, map[string]any{"user_id": c.userID, "data": env.Data})
		case InSnapshot:
			role := c.currentRole()
			if !role.CanEdit() {
				continue
			}
			var p opPayload
			if err := json.Unmarshal(env.Data, &p); err != nil || len(p.Payload) == 0 {
				continue
			}
			rh := h.room(c.roomID)
			rh.mu.Lock()
			rh.lastSnapshot = p.Payload
			rh.mu.Unlock()
		}
	}
}

func mustEnvelope(kind string, data any) []byte {
	var raw json.RawMessage
	if data != nil {
		b, _ := json.Marshal(data)
		raw = b
	}
	out, _ := json.Marshal(Envelope{Kind: kind, Data: raw})
	return out
}

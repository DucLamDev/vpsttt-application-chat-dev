package http

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	nethttp "net/http"
	"strings"
	"time"

	platformws "github.com/duclamdev/application-chat/backend/internal/platform/websocket"
	"github.com/duclamdev/application-chat/backend/internal/shared/middleware"
	"github.com/duclamdev/application-chat/backend/internal/shared/response"
	"github.com/gin-gonic/gin"
	xwebsocket "golang.org/x/net/websocket"
)

type Handler struct {
	manager *platformws.Manager
}

type clientCommand struct {
	Type string `json:"type"`
	Room string `json:"room"`
}

func NewHandler(manager *platformws.Manager) *Handler {
	return &Handler{manager: manager}
}

func (h *Handler) RegisterRoutes(router gin.IRouter, authMiddleware gin.HandlerFunc) {
	router.GET("/ws", authMiddleware, h.Connect)
}

func (h *Handler) Connect(c *gin.Context) {
	if h.manager == nil {
		response.Fail(c, nethttp.StatusServiceUnavailable, "WEBSOCKET_DISABLED", "WebSocket chưa sẵn sàng.", nil)
		return
	}

	userID := middleware.CurrentUserID(c)
	xwebsocket.Handler(func(conn *xwebsocket.Conn) {
		h.serve(conn, userID)
	}).ServeHTTP(c.Writer, c.Request)
}

func (h *Handler) serve(conn *xwebsocket.Conn, userID string) {
	client := &platformws.Client{
		ID:     newClientID(),
		UserID: userID,
		Send:   make(chan platformws.Event, 64),
	}
	if err := h.manager.Register(client); err != nil {
		_ = xwebsocket.JSON.Send(conn, map[string]string{
			"type":    "error",
			"message": err.Error(),
		})
		return
	}
	defer h.manager.Unregister(client.ID)

	done := make(chan struct{})
	go func() {
		defer close(done)
		for event := range client.Send {
			if err := xwebsocket.JSON.Send(conn, event); err != nil {
				return
			}
		}
	}()

	for {
		var command clientCommand
		if err := xwebsocket.JSON.Receive(conn, &command); err != nil {
			if !errors.Is(err, nethttp.ErrAbortHandler) {
				return
			}
			return
		}
		h.handleCommand(client.ID, command)
		select {
		case <-done:
			return
		default:
		}
	}
}

func (h *Handler) handleCommand(clientID string, command clientCommand) {
	room := strings.TrimSpace(command.Room)
	if room == "" {
		return
	}
	switch strings.TrimSpace(command.Type) {
	case "join":
		h.manager.Join(room, clientID)
	case "leave":
		h.manager.Leave(room, clientID)
	}
}

func newClientID() string {
	var random [8]byte
	if _, err := rand.Read(random[:]); err != nil {
		return hex.EncodeToString([]byte(time.Now().UTC().Format(time.RFC3339Nano)))
	}
	return hex.EncodeToString(random[:])
}

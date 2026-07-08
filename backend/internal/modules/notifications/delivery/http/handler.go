package http

import (
	nethttp "net/http"
	"strconv"

	notificationsapp "github.com/duclamdev/application-chat/backend/internal/modules/notifications/application"
	"github.com/duclamdev/application-chat/backend/internal/shared/middleware"
	"github.com/duclamdev/application-chat/backend/internal/shared/response"
	"github.com/gin-gonic/gin"
)

type Handler struct {
	service *notificationsapp.Service
}

func NewHandler(service *notificationsapp.Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) RegisterRoutes(router gin.IRouter, authMiddleware gin.HandlerFunc) {
	private := router.Group("/notifications")
	private.Use(authMiddleware)
	private.GET("", h.ListMine)
	private.PUT("/:notification_id/read", h.MarkRead)
	private.PUT("/read-all", h.MarkAllRead)
}

func (h *Handler) ListMine(c *gin.Context) {
	notifications, err := h.service.ListMine(c.Request.Context(), notificationsapp.ListParams{
		UserID:      middleware.CurrentUserID(c),
		WorkspaceID: c.Query("workspace_id"),
		Limit:       queryInt(c, "limit"),
	})
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, nethttp.StatusOK, gin.H{"notifications": notifications})
}

func (h *Handler) MarkRead(c *gin.Context) {
	notification, err := h.service.MarkRead(c.Request.Context(), middleware.CurrentUserID(c), c.Param("notification_id"))
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, nethttp.StatusOK, notification)
}

func (h *Handler) MarkAllRead(c *gin.Context) {
	if err := h.service.MarkAllRead(c.Request.Context(), middleware.CurrentUserID(c), c.Query("workspace_id")); err != nil {
		response.Error(c, err)
		return
	}
	response.NoContent(c)
}

func queryInt(c *gin.Context, key string) int {
	value, err := strconv.Atoi(c.Query(key))
	if err != nil {
		return 0
	}
	return value
}

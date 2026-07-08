package http

import (
	"encoding/json"
	nethttp "net/http"

	botsapp "github.com/duclamdev/application-chat/backend/internal/modules/bots/application"
	"github.com/duclamdev/application-chat/backend/internal/shared/middleware"
	"github.com/duclamdev/application-chat/backend/internal/shared/response"
	"github.com/gin-gonic/gin"
)

type Handler struct {
	service *botsapp.Service
}

type createBotRequest struct {
	Slug        string          `json:"slug"`
	Name        string          `json:"name"`
	Description string          `json:"description"`
	AvatarURL   string          `json:"avatar_url"`
	Settings    json.RawMessage `json:"settings"`
}

type installBotRequest struct {
	ChannelID string          `json:"channel_id"`
	Config    json.RawMessage `json:"config"`
}

type sendBotMessageRequest struct {
	ChannelID string          `json:"channel_id"`
	Body      string          `json:"body"`
	Metadata  json.RawMessage `json:"metadata"`
}

func NewHandler(service *botsapp.Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) RegisterRoutes(router gin.IRouter, authMiddleware gin.HandlerFunc) {
	private := router.Group("/workspaces/:workspace_id")
	private.Use(authMiddleware)
	private.GET("/bots", h.ListBots)
	private.POST("/bots", h.CreateBot)
	private.GET("/bots/:bot_id/installations", h.ListInstallations)
	private.POST("/bots/:bot_id/installations", h.InstallBot)
	private.POST("/bots/:bot_id/messages", h.SendMessage)
}

func (h *Handler) CreateBot(c *gin.Context) {
	var req createBotRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, nethttp.StatusBadRequest, "INVALID_JSON", "Body JSON không hợp lệ.", nil)
		return
	}
	bot, err := h.service.CreateBot(c.Request.Context(), botsapp.CreateBotInput{
		ActorUserID: middleware.CurrentUserID(c),
		WorkspaceID: c.Param("workspace_id"),
		Slug:        req.Slug,
		Name:        req.Name,
		Description: req.Description,
		AvatarURL:   req.AvatarURL,
		Settings:    req.Settings,
	})
	if err != nil {
		response.Error(c, err)
		return
	}
	response.Created(c, bot)
}

func (h *Handler) ListBots(c *gin.Context) {
	bots, err := h.service.ListBots(c.Request.Context(), middleware.CurrentUserID(c), c.Param("workspace_id"))
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, nethttp.StatusOK, gin.H{"bots": bots})
}

func (h *Handler) InstallBot(c *gin.Context) {
	var req installBotRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, nethttp.StatusBadRequest, "INVALID_JSON", "Body JSON không hợp lệ.", nil)
		return
	}
	installation, err := h.service.InstallBot(c.Request.Context(), botsapp.InstallBotInput{
		ActorUserID: middleware.CurrentUserID(c),
		WorkspaceID: c.Param("workspace_id"),
		BotID:       c.Param("bot_id"),
		ChannelID:   req.ChannelID,
		Config:      req.Config,
	})
	if err != nil {
		response.Error(c, err)
		return
	}
	response.Created(c, installation)
}

func (h *Handler) ListInstallations(c *gin.Context) {
	installations, err := h.service.ListInstallations(c.Request.Context(), middleware.CurrentUserID(c), c.Param("workspace_id"), c.Param("bot_id"))
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, nethttp.StatusOK, gin.H{"installations": installations})
}

func (h *Handler) SendMessage(c *gin.Context) {
	var req sendBotMessageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, nethttp.StatusBadRequest, "INVALID_JSON", "Body JSON không hợp lệ.", nil)
		return
	}
	message, err := h.service.SendMessage(c.Request.Context(), botsapp.SendBotMessageInput{
		ActorUserID: middleware.CurrentUserID(c),
		WorkspaceID: c.Param("workspace_id"),
		BotID:       c.Param("bot_id"),
		ChannelID:   req.ChannelID,
		Body:        req.Body,
		Metadata:    req.Metadata,
	})
	if err != nil {
		response.Error(c, err)
		return
	}
	response.Created(c, message)
}

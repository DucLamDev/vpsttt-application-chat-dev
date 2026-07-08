package http

import (
	"encoding/json"
	nethttp "net/http"
	"net/url"
	"strconv"

	messagesapp "github.com/duclamdev/application-chat/backend/internal/modules/messages/application"
	"github.com/duclamdev/application-chat/backend/internal/shared/middleware"
	"github.com/duclamdev/application-chat/backend/internal/shared/response"
	"github.com/gin-gonic/gin"
)

type Handler struct {
	service *messagesapp.Service
}

type sendMessageRequest struct {
	ParentID         string          `json:"parent_id"`
	Kind             string          `json:"kind"`
	Body             string          `json:"body"`
	Metadata         json.RawMessage `json:"metadata"`
	MentionedUserIDs []string        `json:"mentioned_user_ids"`
}

type updateMessageRequest struct {
	Body string `json:"body"`
}

type reactionRequest struct {
	Emoji string `json:"emoji"`
}

func NewHandler(service *messagesapp.Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) RegisterRoutes(router gin.IRouter, authMiddleware gin.HandlerFunc) {
	private := router.Group("/workspaces/:workspace_id")
	private.Use(authMiddleware)

	private.GET("/messages/search", h.Search)
	private.GET("/channels/:channel_id/messages", h.List)
	private.POST("/channels/:channel_id/messages", h.Send)
	private.GET("/channels/:channel_id/messages/:message_id", h.Get)
	private.PATCH("/channels/:channel_id/messages/:message_id", h.Update)
	private.DELETE("/channels/:channel_id/messages/:message_id", h.Delete)
	private.GET("/channels/:channel_id/messages/:message_id/thread", h.ListThread)
	private.POST("/channels/:channel_id/messages/:message_id/reactions", h.AddReaction)
	private.DELETE("/channels/:channel_id/messages/:message_id/reactions/:emoji", h.RemoveReaction)
}

func (h *Handler) Send(c *gin.Context) {
	var req sendMessageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, nethttp.StatusBadRequest, "INVALID_JSON", "Body JSON không hợp lệ.", nil)
		return
	}

	message, err := h.service.Send(c.Request.Context(), messagesapp.SendInput{
		ActorUserID:      middleware.CurrentUserID(c),
		WorkspaceID:      c.Param("workspace_id"),
		ChannelID:        c.Param("channel_id"),
		ParentID:         req.ParentID,
		Kind:             req.Kind,
		Body:             req.Body,
		Metadata:         req.Metadata,
		MentionedUserIDs: req.MentionedUserIDs,
	})
	if err != nil {
		response.Error(c, err)
		return
	}
	response.Created(c, message)
}

func (h *Handler) Get(c *gin.Context) {
	message, err := h.service.Get(c.Request.Context(), messagesapp.MessageRef{
		ActorUserID: middleware.CurrentUserID(c),
		WorkspaceID: c.Param("workspace_id"),
		ChannelID:   c.Param("channel_id"),
		MessageID:   c.Param("message_id"),
	})
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, nethttp.StatusOK, message)
}

func (h *Handler) List(c *gin.Context) {
	messages, meta, err := h.service.List(c.Request.Context(), messagesapp.ListInput{
		ActorUserID: middleware.CurrentUserID(c),
		WorkspaceID: c.Param("workspace_id"),
		ChannelID:   c.Param("channel_id"),
		Limit:       queryInt(c, "limit"),
		BeforeID:    c.Query("before"),
	})
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OKWithMeta(c, nethttp.StatusOK, gin.H{"messages": messages}, meta)
}

func (h *Handler) ListThread(c *gin.Context) {
	messages, meta, err := h.service.ListThread(c.Request.Context(), messagesapp.ThreadInput{
		ActorUserID: middleware.CurrentUserID(c),
		WorkspaceID: c.Param("workspace_id"),
		ChannelID:   c.Param("channel_id"),
		MessageID:   c.Param("message_id"),
		Limit:       queryInt(c, "limit"),
	})
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OKWithMeta(c, nethttp.StatusOK, gin.H{"messages": messages}, meta)
}

func (h *Handler) Search(c *gin.Context) {
	messages, meta, err := h.service.Search(c.Request.Context(), messagesapp.SearchInput{
		ActorUserID: middleware.CurrentUserID(c),
		WorkspaceID: c.Param("workspace_id"),
		Query:       c.Query("q"),
		Limit:       queryInt(c, "limit"),
	})
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OKWithMeta(c, nethttp.StatusOK, gin.H{"messages": messages}, meta)
}

func (h *Handler) Update(c *gin.Context) {
	var req updateMessageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, nethttp.StatusBadRequest, "INVALID_JSON", "Body JSON không hợp lệ.", nil)
		return
	}

	message, err := h.service.Update(c.Request.Context(), messagesapp.UpdateInput{
		ActorUserID: middleware.CurrentUserID(c),
		WorkspaceID: c.Param("workspace_id"),
		ChannelID:   c.Param("channel_id"),
		MessageID:   c.Param("message_id"),
		Body:        req.Body,
	})
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, nethttp.StatusOK, message)
}

func (h *Handler) Delete(c *gin.Context) {
	if err := h.service.Delete(c.Request.Context(), messagesapp.DeleteInput{
		ActorUserID: middleware.CurrentUserID(c),
		WorkspaceID: c.Param("workspace_id"),
		ChannelID:   c.Param("channel_id"),
		MessageID:   c.Param("message_id"),
	}); err != nil {
		response.Error(c, err)
		return
	}
	response.NoContent(c)
}

func (h *Handler) AddReaction(c *gin.Context) {
	var req reactionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, nethttp.StatusBadRequest, "INVALID_JSON", "Body JSON không hợp lệ.", nil)
		return
	}

	message, err := h.service.AddReaction(c.Request.Context(), messagesapp.ReactionInput{
		ActorUserID: middleware.CurrentUserID(c),
		WorkspaceID: c.Param("workspace_id"),
		ChannelID:   c.Param("channel_id"),
		MessageID:   c.Param("message_id"),
		Emoji:       req.Emoji,
	})
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, nethttp.StatusOK, message)
}

func (h *Handler) RemoveReaction(c *gin.Context) {
	emoji, err := url.PathUnescape(c.Param("emoji"))
	if err != nil {
		response.Fail(c, nethttp.StatusBadRequest, "VALIDATION_ERROR", "Reaction không hợp lệ.", nil)
		return
	}

	message, err := h.service.RemoveReaction(c.Request.Context(), messagesapp.ReactionInput{
		ActorUserID: middleware.CurrentUserID(c),
		WorkspaceID: c.Param("workspace_id"),
		ChannelID:   c.Param("channel_id"),
		MessageID:   c.Param("message_id"),
		Emoji:       emoji,
	})
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, nethttp.StatusOK, message)
}

func queryInt(c *gin.Context, key string) int {
	value, err := strconv.Atoi(c.Query(key))
	if err != nil {
		return 0
	}
	return value
}

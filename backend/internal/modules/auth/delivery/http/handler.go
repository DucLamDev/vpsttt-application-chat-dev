package http

import (
	nethttp "net/http"

	authapp "github.com/duclamdev/application-chat/backend/internal/modules/auth/application"
	"github.com/duclamdev/application-chat/backend/internal/shared/middleware"
	"github.com/duclamdev/application-chat/backend/internal/shared/response"
	"github.com/gin-gonic/gin"
)

type Handler struct {
	service *authapp.Service
}

type registerRequest struct {
	Email       string `json:"email"`
	Username    string `json:"username"`
	DisplayName string `json:"display_name"`
	Password    string `json:"password"`
	DeviceName  string `json:"device_name"`
}

type loginRequest struct {
	Identifier string `json:"identifier"`
	Password   string `json:"password"`
	DeviceName string `json:"device_name"`
}

type refreshRequest struct {
	RefreshToken string `json:"refresh_token"`
}

type logoutRequest struct {
	RefreshToken string `json:"refresh_token"`
}

func NewHandler(service *authapp.Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) RegisterRoutes(router gin.IRouter, authMiddleware gin.HandlerFunc) {
	router.POST("/register", h.Register)
	router.POST("/login", h.Login)
	router.POST("/refresh", h.Refresh)
	router.POST("/logout", h.Logout)

	private := router.Group("")
	private.Use(authMiddleware)
	private.GET("/me", h.Me)
	private.GET("/sessions", h.ListSessions)
	private.DELETE("/sessions/:session_id", h.RevokeSession)
	private.DELETE("/sessions", h.RevokeAllSessions)
}

func (h *Handler) Register(c *gin.Context) {
	var req registerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, nethttp.StatusBadRequest, "INVALID_JSON", "Body JSON không hợp lệ.", nil)
		return
	}

	result, err := h.service.Register(c.Request.Context(), authapp.RegisterInput{
		Email:       req.Email,
		Username:    req.Username,
		DisplayName: req.DisplayName,
		Password:    req.Password,
		DeviceName:  req.DeviceName,
		IPAddress:   clientIP(c),
		UserAgent:   c.Request.UserAgent(),
	})
	if err != nil {
		response.Error(c, err)
		return
	}
	response.Created(c, result)
}

func (h *Handler) Login(c *gin.Context) {
	var req loginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, nethttp.StatusBadRequest, "INVALID_JSON", "Body JSON không hợp lệ.", nil)
		return
	}

	result, err := h.service.Login(c.Request.Context(), authapp.LoginInput{
		Identifier: req.Identifier,
		Password:   req.Password,
		DeviceName: req.DeviceName,
		IPAddress:  clientIP(c),
		UserAgent:  c.Request.UserAgent(),
	})
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, nethttp.StatusOK, result)
}

func (h *Handler) Refresh(c *gin.Context) {
	var req refreshRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, nethttp.StatusBadRequest, "INVALID_JSON", "Body JSON không hợp lệ.", nil)
		return
	}

	result, err := h.service.Refresh(c.Request.Context(), authapp.RefreshInput{RefreshToken: req.RefreshToken})
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, nethttp.StatusOK, result)
}

func (h *Handler) Logout(c *gin.Context) {
	var req logoutRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, nethttp.StatusBadRequest, "INVALID_JSON", "Body JSON không hợp lệ.", nil)
		return
	}

	if err := h.service.Logout(c.Request.Context(), authapp.LogoutInput{RefreshToken: req.RefreshToken}); err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, nethttp.StatusOK, gin.H{"status": "logged_out"})
}

func (h *Handler) Me(c *gin.Context) {
	user, err := h.service.Me(c.Request.Context(), middleware.CurrentUserID(c))
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, nethttp.StatusOK, user)
}

func (h *Handler) ListSessions(c *gin.Context) {
	sessions, err := h.service.ListSessions(c.Request.Context(), middleware.CurrentUserID(c))
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, nethttp.StatusOK, gin.H{"sessions": sessions})
}

func (h *Handler) RevokeSession(c *gin.Context) {
	if err := h.service.RevokeSession(c.Request.Context(), middleware.CurrentUserID(c), c.Param("session_id")); err != nil {
		response.Error(c, err)
		return
	}
	response.NoContent(c)
}

func (h *Handler) RevokeAllSessions(c *gin.Context) {
	if err := h.service.RevokeAllSessions(c.Request.Context(), middleware.CurrentUserID(c)); err != nil {
		response.Error(c, err)
		return
	}
	response.NoContent(c)
}

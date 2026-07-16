package http

import (
	"context"
	"encoding/json"
	"errors"
	nethttp "net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	authapp "github.com/duclamdev/application-chat/backend/internal/modules/auth/application"
	"github.com/duclamdev/application-chat/backend/internal/shared/middleware"
	"github.com/duclamdev/application-chat/backend/internal/shared/response"
	"github.com/gin-gonic/gin"
)

type Handler struct {
	service        *authapp.Service
	googleClientID string
	httpClient     *nethttp.Client
}

type registerRequest struct {
	Email       string `json:"email"`
	Username    string `json:"username"`
	DisplayName string `json:"display_name"`
	Domain      string `json:"domain"`
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

type googleLoginRequest struct {
	Credential string `json:"credential"`
	DeviceName string `json:"device_name"`
}

type googleTokenInfo struct {
	Audience      string `json:"aud"`
	Email         string `json:"email"`
	EmailVerified string `json:"email_verified"`
	ExpiresAt     string `json:"exp"`
	Issuer        string `json:"iss"`
	Name          string `json:"name"`
	Picture       string `json:"picture"`
	Subject       string `json:"sub"`
}

func NewHandler(service *authapp.Service, googleClientIDs ...string) *Handler {
	clientID := ""
	if len(googleClientIDs) > 0 {
		clientID = strings.TrimSpace(googleClientIDs[0])
	}
	return &Handler{
		service:        service,
		googleClientID: clientID,
		httpClient:     &nethttp.Client{Timeout: 10 * time.Second},
	}
}

func (h *Handler) RegisterRoutes(router gin.IRouter, authMiddleware gin.HandlerFunc) {
	router.POST("/register", h.Register)
	router.POST("/login", h.Login)
	router.POST("/google", h.GoogleLogin)
	router.POST("/refresh", h.Refresh)
	router.POST("/logout", h.Logout)

	private := router.Group("")
	private.Use(authMiddleware)
	private.GET("/me", h.Me)
	private.GET("/sessions", h.ListSessions)
	private.DELETE("/sessions/:session_id", h.RevokeSession)
	private.DELETE("/sessions", h.RevokeAllSessions)
}

func (h *Handler) GoogleLogin(c *gin.Context) {
	if h.googleClientID == "" {
		response.Fail(c, nethttp.StatusServiceUnavailable, "GOOGLE_AUTH_NOT_CONFIGURED", "Đăng nhập Google chưa được cấu hình.", nil)
		return
	}
	var req googleLoginRequest
	if err := c.ShouldBindJSON(&req); err != nil || strings.TrimSpace(req.Credential) == "" {
		response.Fail(c, nethttp.StatusBadRequest, "INVALID_GOOGLE_CREDENTIAL", "Thiếu thông tin xác thực Google.", nil)
		return
	}
	profile, err := h.verifyGoogleCredential(c.Request.Context(), req.Credential)
	if err != nil {
		response.Fail(c, nethttp.StatusUnauthorized, "INVALID_GOOGLE_CREDENTIAL", "Phiên xác thực Google không hợp lệ hoặc đã hết hạn.", nil)
		return
	}
	result, err := h.service.LoginWithGoogle(c.Request.Context(), authapp.GoogleLoginInput{
		Subject:       profile.Subject,
		Email:         profile.Email,
		EmailVerified: profile.EmailVerified == "true",
		DisplayName:   profile.Name,
		AvatarURL:     profile.Picture,
		DeviceName:    req.DeviceName,
		IPAddress:     clientIP(c),
		UserAgent:     c.Request.UserAgent(),
	})
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, nethttp.StatusOK, result)
}

func (h *Handler) verifyGoogleCredential(ctx context.Context, credential string) (googleTokenInfo, error) {
	var profile googleTokenInfo
	endpoint := "https://oauth2.googleapis.com/tokeninfo?id_token=" + url.QueryEscape(strings.TrimSpace(credential))
	req, err := nethttp.NewRequestWithContext(ctx, nethttp.MethodGet, endpoint, nil)
	if err != nil {
		return profile, err
	}
	resp, err := h.httpClient.Do(req)
	if err != nil {
		return profile, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != nethttp.StatusOK {
		return profile, errors.New("google tokeninfo rejected credential")
	}
	if err := json.NewDecoder(resp.Body).Decode(&profile); err != nil {
		return profile, err
	}
	expiresAt, err := strconv.ParseInt(profile.ExpiresAt, 10, 64)
	if err != nil || expiresAt <= time.Now().Unix() {
		return profile, errors.New("google credential expired")
	}
	if profile.Audience != h.googleClientID || (profile.Issuer != "accounts.google.com" && profile.Issuer != "https://accounts.google.com") || profile.Subject == "" || profile.Email == "" || profile.EmailVerified != "true" {
		return profile, errors.New("google credential claims are invalid")
	}
	return profile, nil
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
		Domain:      req.Domain,
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

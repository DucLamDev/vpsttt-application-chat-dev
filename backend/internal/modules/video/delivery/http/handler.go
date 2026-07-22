package http

import (
	"crypto/sha256"
	"fmt"
	nethttp "net/http"
	"regexp"
	"strings"
	"time"

	"github.com/duclamdev/application-chat/backend/internal/shared/middleware"
	"github.com/duclamdev/application-chat/backend/internal/shared/response"
	"github.com/gin-gonic/gin"
)

type Handler struct {
	appID         uint32
	appSign       string
	serverSecret  string
	tokenTTL      time.Duration
	now           func() time.Time
	generateToken zegoTokenGenerator
}

type zegoTokenGenerator func(appID uint32, userID string, serverSecret string, effectiveTimeInSeconds int64, payload string) (string, error)

type zegoCallCredentialsResponse struct {
	AppID     uint32 `json:"app_id"`
	AppSign   string `json:"app_sign"`
	UserID    string `json:"user_id"`
	UserName  string `json:"user_name"`
	Token     string `json:"token"`
	ExpiresAt string `json:"expires_at"`
}

var zegoIdentifierPattern = regexp.MustCompile(`^[A-Za-z0-9_]{1,32}$`)

func NewHandler(appID uint32, appSign string, serverSecret string, tokenTTL time.Duration) *Handler {
	if tokenTTL <= 0 {
		tokenTTL = 24 * time.Hour
	}
	return &Handler{
		appID:         appID,
		appSign:       strings.TrimSpace(appSign),
		serverSecret:  strings.TrimSpace(serverSecret),
		tokenTTL:      tokenTTL,
		now:           time.Now,
		generateToken: generateZegoToken04,
	}
}

func (h *Handler) RegisterRoutes(router *gin.RouterGroup, auth gin.HandlerFunc) {
	private := router.Group("/video", auth)
	private.GET("/zego-token", h.ZegoToken)
}

func (h *Handler) ZegoToken(c *gin.Context) {
	if h.appID == 0 || h.appSign == "" || h.serverSecret == "" {
		response.Fail(
			c,
			nethttp.StatusServiceUnavailable,
			"ZEGO_NOT_CONFIGURED",
			"ZEGOCLOUD chưa được cấu hình trên server.",
			nil,
		)
		return
	}

	userID := strings.TrimSpace(middleware.CurrentUserID(c))
	if userID == "" {
		response.Fail(c, nethttp.StatusUnauthorized, "UNAUTHORIZED", "Bạn cần đăng nhập để tiếp tục.", nil)
		return
	}

	token, zegoUserID, expiresAt, err := h.createUserToken(userID)
	if err != nil {
		response.Error(c, err)
		return
	}

	response.OK(c, nethttp.StatusOK, gin.H{
		"zego_call": zegoCallCredentialsResponse{
			AppID:     h.appID,
			AppSign:   h.appSign,
			UserID:    zegoUserID,
			UserName:  zegoUserID,
			Token:     token,
			ExpiresAt: expiresAt.UTC().Format(time.RFC3339),
		},
	})
}

func (h *Handler) createUserToken(rawUserID string) (string, string, time.Time, error) {
	now := h.now().UTC()
	expiresAt := now.Add(h.tokenTTL)
	zegoUserID := zegoUserIDFromAppUserID(rawUserID)
	if zegoUserID == "" {
		return "", "", time.Time{}, fmt.Errorf("build zego user id: empty user id")
	}

	token, err := h.generateToken(h.appID, zegoUserID, h.serverSecret, int64(h.tokenTTL.Seconds()), "")
	if err != nil {
		return "", "", time.Time{}, fmt.Errorf("generate zego token: %w", err)
	}
	return token, zegoUserID, expiresAt, nil
}

func zegoUserIDFromAppUserID(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return ""
	}

	compactUUID := strings.ReplaceAll(raw, "-", "")
	if len(compactUUID) == 32 && zegoIdentifierPattern.MatchString(compactUUID) {
		return compactUUID
	}

	var cleaned strings.Builder
	for _, r := range raw {
		if r >= 'a' && r <= 'z' || r >= 'A' && r <= 'Z' || r >= '0' && r <= '9' || r == '_' {
			cleaned.WriteRune(r)
		}
	}
	candidate := cleaned.String()
	if zegoIdentifierPattern.MatchString(candidate) {
		return candidate
	}

	sum := sha256.Sum256([]byte(raw))
	return fmt.Sprintf("%x", sum)[:32]
}

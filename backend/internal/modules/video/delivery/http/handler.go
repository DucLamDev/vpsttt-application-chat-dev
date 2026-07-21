package http

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	nethttp "net/http"
	"strings"
	"time"

	"github.com/duclamdev/application-chat/backend/internal/shared/middleware"
	"github.com/duclamdev/application-chat/backend/internal/shared/response"
	"github.com/gin-gonic/gin"
)

type Handler struct {
	apiKey    string
	apiSecret string
	tokenTTL  time.Duration
	now       func() time.Time
}

type streamTokenResponse struct {
	APIKey    string `json:"api_key"`
	UserID    string `json:"user_id"`
	Token     string `json:"token"`
	ExpiresAt string `json:"expires_at"`
}

type streamTokenClaims struct {
	UserID    string `json:"user_id"`
	IssuedAt  int64  `json:"iat"`
	ExpiresAt int64  `json:"exp"`
}

func NewHandler(apiKey string, apiSecret string, tokenTTL time.Duration) *Handler {
	if tokenTTL <= 0 {
		tokenTTL = 24 * time.Hour
	}
	return &Handler{
		apiKey:    strings.TrimSpace(apiKey),
		apiSecret: strings.TrimSpace(apiSecret),
		tokenTTL:  tokenTTL,
		now:       time.Now,
	}
}

func (h *Handler) RegisterRoutes(router *gin.RouterGroup, auth gin.HandlerFunc) {
	private := router.Group("/video", auth)
	private.GET("/stream-token", h.StreamToken)
}

func (h *Handler) StreamToken(c *gin.Context) {
	if h.apiKey == "" || h.apiSecret == "" {
		response.Fail(
			c,
			nethttp.StatusServiceUnavailable,
			"STREAM_VIDEO_NOT_CONFIGURED",
			"Stream Video chua duoc cau hinh tren server.",
			nil,
		)
		return
	}

	userID := strings.TrimSpace(middleware.CurrentUserID(c))
	if userID == "" {
		response.Fail(c, nethttp.StatusUnauthorized, "UNAUTHORIZED", "Ban can dang nhap de tiep tuc.", nil)
		return
	}

	token, expiresAt, err := h.createUserToken(userID)
	if err != nil {
		response.Error(c, err)
		return
	}

	response.OK(c, nethttp.StatusOK, gin.H{
		"stream_video": streamTokenResponse{
			APIKey:    h.apiKey,
			UserID:    userID,
			Token:     token,
			ExpiresAt: expiresAt.UTC().Format(time.RFC3339),
		},
	})
}

func (h *Handler) createUserToken(userID string) (string, time.Time, error) {
	now := h.now().UTC()
	expiresAt := now.Add(h.tokenTTL)
	claims := streamTokenClaims{
		UserID:    userID,
		IssuedAt:  now.Unix(),
		ExpiresAt: expiresAt.Unix(),
	}

	token, err := signStreamToken(claims, []byte(h.apiSecret))
	if err != nil {
		return "", time.Time{}, err
	}
	return token, expiresAt, nil
}

func signStreamToken(claims streamTokenClaims, secret []byte) (string, error) {
	headerBytes, err := json.Marshal(map[string]string{"alg": "HS256", "typ": "JWT"})
	if err != nil {
		return "", fmt.Errorf("encode stream token header: %w", err)
	}
	payloadBytes, err := json.Marshal(claims)
	if err != nil {
		return "", fmt.Errorf("encode stream token payload: %w", err)
	}

	header := base64.RawURLEncoding.EncodeToString(headerBytes)
	payload := base64.RawURLEncoding.EncodeToString(payloadBytes)
	message := header + "." + payload
	signature := base64.RawURLEncoding.EncodeToString(signHMAC([]byte(message), secret))
	return message + "." + signature, nil
}

func signHMAC(message []byte, secret []byte) []byte {
	mac := hmac.New(sha256.New, secret)
	_, _ = mac.Write(message)
	return mac.Sum(nil)
}

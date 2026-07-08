package middleware

import (
	"errors"
	"net/http"
	"strings"

	sharedauth "github.com/duclamdev/application-chat/backend/internal/shared/auth"
	"github.com/duclamdev/application-chat/backend/internal/shared/constants"
	"github.com/duclamdev/application-chat/backend/internal/shared/response"
	"github.com/gin-gonic/gin"
)

func Auth(tokens *sharedauth.Manager) gin.HandlerFunc {
	return func(c *gin.Context) {
		raw := strings.TrimSpace(c.GetHeader("Authorization"))
		if raw == "" {
			response.Fail(c, http.StatusUnauthorized, "UNAUTHORIZED", "Bạn cần đăng nhập để tiếp tục.", nil)
			c.Abort()
			return
		}

		prefix := "Bearer "
		if !strings.HasPrefix(raw, prefix) {
			response.Fail(c, http.StatusUnauthorized, "UNAUTHORIZED", "Header Authorization không hợp lệ.", nil)
			c.Abort()
			return
		}

		claims, err := tokens.VerifyAccessToken(strings.TrimSpace(strings.TrimPrefix(raw, prefix)))
		if err != nil {
			message := "Token không hợp lệ."
			if errors.Is(err, sharedauth.ErrExpiredToken) {
				message = "Token đã hết hạn."
			}
			response.Fail(c, http.StatusUnauthorized, "UNAUTHORIZED", message, nil)
			c.Abort()
			return
		}

		c.Set(constants.ContextUserID, claims.Subject)
		c.Set(constants.ContextEmail, claims.Email)
		c.Set(constants.ContextUsername, claims.Username)
		c.Next()
	}
}

func CurrentUserID(c *gin.Context) string {
	value, ok := c.Get(constants.ContextUserID)
	if !ok {
		return ""
	}
	userID, _ := value.(string)
	return userID
}

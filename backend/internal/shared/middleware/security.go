package middleware

import (
	"net/http"
	"strings"

	"github.com/duclamdev/application-chat/backend/internal/shared/response"
	"github.com/gin-gonic/gin"
)

func SecurityHeaders(production bool) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("X-Content-Type-Options", "nosniff")
		c.Header("X-Frame-Options", "DENY")
		c.Header("Referrer-Policy", "no-referrer")
		c.Header("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
		c.Header("X-XSS-Protection", "0")
		if production {
			c.Header("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
		}

		c.Next()
	}
}

func CORS(allowedOrigins []string) gin.HandlerFunc {
	allowed, allowAll := buildAllowedOrigins(allowedOrigins)

	return func(c *gin.Context) {
		origin := strings.TrimSpace(c.GetHeader("Origin"))
		if origin == "" {
			c.Next()
			return
		}

		if !allowAll && !allowed[strings.ToLower(origin)] {
			response.Fail(c, http.StatusForbidden, "CORS_ORIGIN_DENIED", "Nguồn truy cập không được phép.", nil)
			c.Abort()
			return
		}

		if allowAll {
			c.Header("Access-Control-Allow-Origin", "*")
		} else {
			c.Header("Access-Control-Allow-Origin", origin)
			c.Header("Vary", "Origin")
		}
		c.Header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Authorization,Content-Type,X-Request-ID,X-API-Key,X-Webhook-Signature,X-Webhook-Timestamp")
		c.Header("Access-Control-Expose-Headers", "X-Request-ID")
		c.Header("Access-Control-Max-Age", "600")
		if !allowAll {
			c.Header("Access-Control-Allow-Credentials", "true")
		}

		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}

func buildAllowedOrigins(origins []string) (map[string]bool, bool) {
	allowed := make(map[string]bool, len(origins))
	for _, origin := range origins {
		origin = strings.TrimSpace(origin)
		if origin == "" {
			continue
		}
		if origin == "*" {
			return map[string]bool{}, true
		}
		allowed[strings.ToLower(origin)] = true
	}
	return allowed, false
}

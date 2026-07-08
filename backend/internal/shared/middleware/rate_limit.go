package middleware

import (
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/duclamdev/application-chat/backend/internal/shared/response"
	"github.com/gin-gonic/gin"
)

type rateLimitEntry struct {
	count   int
	resetAt time.Time
}

func RateLimit(perMinute int, burst int) gin.HandlerFunc {
	limit := perMinute + burst
	if limit <= 0 {
		return func(c *gin.Context) {
			c.Next()
		}
	}

	var mu sync.Mutex
	entries := make(map[string]rateLimitEntry)
	lastCleanup := time.Now()
	window := time.Minute

	return func(c *gin.Context) {
		now := time.Now()
		key := c.ClientIP()

		mu.Lock()
		if now.Sub(lastCleanup) > window {
			for existingKey, entry := range entries {
				if now.After(entry.resetAt) {
					delete(entries, existingKey)
				}
			}
			lastCleanup = now
		}

		entry := entries[key]
		if entry.resetAt.IsZero() || now.After(entry.resetAt) {
			entry = rateLimitEntry{
				count:   0,
				resetAt: now.Add(window),
			}
		}

		if entry.count >= limit {
			retryAfter := int(time.Until(entry.resetAt).Seconds())
			if retryAfter < 1 {
				retryAfter = 1
			}
			entries[key] = entry
			mu.Unlock()

			c.Header("Retry-After", strconv.Itoa(retryAfter))
			c.Header("X-RateLimit-Limit", strconv.Itoa(limit))
			c.Header("X-RateLimit-Remaining", "0")
			response.Fail(c, http.StatusTooManyRequests, "RATE_LIMITED", "Bạn thao tác quá nhanh, vui lòng thử lại sau.", nil)
			c.Abort()
			return
		}

		entry.count++
		remaining := limit - entry.count
		resetAt := entry.resetAt
		entries[key] = entry
		mu.Unlock()

		c.Header("X-RateLimit-Limit", strconv.Itoa(limit))
		c.Header("X-RateLimit-Remaining", strconv.Itoa(remaining))
		c.Header("X-RateLimit-Reset", strconv.FormatInt(resetAt.Unix(), 10))

		c.Next()
	}
}

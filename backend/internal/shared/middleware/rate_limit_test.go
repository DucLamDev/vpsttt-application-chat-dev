package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestRateLimitBlocksAfterLimit(t *testing.T) {
	gin.SetMode(gin.TestMode)

	router := gin.New()
	router.Use(RateLimit(1, 0))
	router.GET("/ping", func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})

	first := httptest.NewRecorder()
	firstReq := httptest.NewRequest(http.MethodGet, "/ping", nil)
	firstReq.RemoteAddr = "127.0.0.1:1000"
	router.ServeHTTP(first, firstReq)
	if first.Code != http.StatusNoContent {
		t.Fatalf("request đầu status = %d, muốn %d", first.Code, http.StatusNoContent)
	}

	second := httptest.NewRecorder()
	secondReq := httptest.NewRequest(http.MethodGet, "/ping", nil)
	secondReq.RemoteAddr = "127.0.0.1:1001"
	router.ServeHTTP(second, secondReq)
	if second.Code != http.StatusTooManyRequests {
		t.Fatalf("request thứ hai status = %d, muốn %d", second.Code, http.StatusTooManyRequests)
	}
	if got := second.Header().Get("Retry-After"); got == "" {
		t.Fatal("Retry-After không được để trống")
	}
}

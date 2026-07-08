package http

import (
	nethttp "net/http"
	"net/http/httptest"
	"net/url"
	"testing"
	"time"

	platformws "github.com/duclamdev/application-chat/backend/internal/platform/websocket"
	sharedauth "github.com/duclamdev/application-chat/backend/internal/shared/auth"
)

func TestAccessTokenFromRequest(t *testing.T) {
	tests := []struct {
		name   string
		req    *nethttp.Request
		expect string
	}{
		{
			name: "authorization bearer",
			req: func() *nethttp.Request {
				req := httptest.NewRequest(nethttp.MethodGet, "/api/v1/ws", nil)
				req.Header.Set("Authorization", "Bearer header-token")
				return req
			}(),
			expect: "header-token",
		},
		{
			name:   "access token query",
			req:    httptest.NewRequest(nethttp.MethodGet, "/api/v1/ws?access_token=query-token", nil),
			expect: "query-token",
		},
		{
			name:   "token query fallback",
			req:    httptest.NewRequest(nethttp.MethodGet, "/api/v1/ws?token=query-token", nil),
			expect: "query-token",
		},
		{
			name: "subprotocol pair",
			req: func() *nethttp.Request {
				req := httptest.NewRequest(nethttp.MethodGet, "/api/v1/ws", nil)
				req.Header.Set("Sec-WebSocket-Protocol", "webtui.jwt, protocol-token")
				return req
			}(),
			expect: "protocol-token",
		},
		{
			name: "subprotocol compact",
			req: func() *nethttp.Request {
				req := httptest.NewRequest(nethttp.MethodGet, "/api/v1/ws", nil)
				req.Header.Set("Sec-WebSocket-Protocol", "webtui.jwt.protocol-token")
				return req
			}(),
			expect: "protocol-token",
		},
		{
			name: "subprotocol with nil URL",
			req: func() *nethttp.Request {
				req := httptest.NewRequest(nethttp.MethodGet, "/api/v1/ws", nil)
				req.URL = nil
				req.Header.Set("Sec-WebSocket-Protocol", "webtui.token, protocol-token")
				return req
			}(),
			expect: "protocol-token",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := accessTokenFromRequest(tt.req); got != tt.expect {
				t.Fatalf("accessTokenFromRequest() = %q, want %q", got, tt.expect)
			}
		})
	}
}

func TestAuthenticateRequestFromBrowserQueryToken(t *testing.T) {
	tokens := sharedauth.NewManager("access-secret", "refresh-secret", time.Hour, 24*time.Hour)
	accessToken, _, err := tokens.CreateAccessToken("user-1", "user@example.com", "user")
	if err != nil {
		t.Fatalf("CreateAccessToken() error = %v", err)
	}

	req := httptest.NewRequest(nethttp.MethodGet, "/api/v1/ws?access_token="+url.QueryEscape(accessToken), nil)
	handler := NewHandler(platformws.NewManager(), tokens)

	userID, err := handler.authenticateRequest(req)
	if err != nil {
		t.Fatalf("authenticateRequest() error = %v", err)
	}
	if userID != "user-1" {
		t.Fatalf("authenticateRequest() userID = %q, want user-1", userID)
	}
}

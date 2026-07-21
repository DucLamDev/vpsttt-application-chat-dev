package http

import (
	"crypto/hmac"
	"encoding/base64"
	"encoding/json"
	"strings"
	"testing"
	"time"
)

func TestCreateUserTokenSignsStreamClaims(t *testing.T) {
	handler := NewHandler("api-key", "stream-secret-that-is-long-enough", time.Hour)
	handler.now = func() time.Time {
		return time.Unix(1700000000, 0).UTC()
	}

	token, expiresAt, err := handler.createUserToken("user-1")
	if err != nil {
		t.Fatalf("createUserToken() error = %v", err)
	}
	if got, want := expiresAt.Unix(), int64(1700003600); got != want {
		t.Fatalf("expiresAt = %d, want %d", got, want)
	}

	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		t.Fatalf("token parts = %d, want 3", len(parts))
	}

	payload, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		t.Fatalf("decode payload: %v", err)
	}
	var claims streamTokenClaims
	if err := json.Unmarshal(payload, &claims); err != nil {
		t.Fatalf("unmarshal payload: %v", err)
	}
	if claims.UserID != "user-1" || claims.IssuedAt != 1700000000 || claims.ExpiresAt != 1700003600 {
		t.Fatalf("unexpected claims: %#v", claims)
	}

	expected := base64.RawURLEncoding.EncodeToString(
		signHMAC([]byte(parts[0]+"."+parts[1]), []byte("stream-secret-that-is-long-enough")),
	)
	if !hmac.Equal([]byte(parts[2]), []byte(expected)) {
		t.Fatal("token signature is invalid")
	}
}

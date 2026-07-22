package http

import (
	"testing"
	"time"
)

func TestCreateUserTokenBuildsZegoCredentials(t *testing.T) {
	handler := NewHandler(87181369, "zego-app-sign", "zego-server-secret", time.Hour)
	handler.now = func() time.Time {
		return time.Unix(1700000000, 0).UTC()
	}
	handler.generateToken = func(appID uint32, userID string, serverSecret string, effectiveTimeInSeconds int64, payload string) (string, error) {
		if appID != 87181369 {
			t.Fatalf("appID = %d, want 87181369", appID)
		}
		if userID != "11111111222233334444555555555555" {
			t.Fatalf("userID = %q, want normalized UUID", userID)
		}
		if serverSecret != "zego-server-secret" {
			t.Fatalf("serverSecret = %q, want configured secret", serverSecret)
		}
		if effectiveTimeInSeconds != 3600 {
			t.Fatalf("effectiveTimeInSeconds = %d, want 3600", effectiveTimeInSeconds)
		}
		if payload != "" {
			t.Fatalf("payload = %q, want empty identity-token payload", payload)
		}
		return "zego-token", nil
	}

	token, zegoUserID, expiresAt, err := handler.createUserToken("11111111-2222-3333-4444-555555555555")
	if err != nil {
		t.Fatalf("createUserToken() error = %v", err)
	}
	if token != "zego-token" {
		t.Fatalf("token = %q, want zego-token", token)
	}
	if zegoUserID != "11111111222233334444555555555555" {
		t.Fatalf("zegoUserID = %q, want normalized UUID", zegoUserID)
	}
	if got, want := expiresAt.Unix(), int64(1700003600); got != want {
		t.Fatalf("expiresAt = %d, want %d", got, want)
	}
}

func TestZegoUserIDFromAppUserID(t *testing.T) {
	tests := map[string]string{
		"11111111-2222-3333-4444-555555555555": "11111111222233334444555555555555",
		"simple_user":                          "simple_user",
		"duclam@example.com":                   "duclamexamplecom",
	}

	for input, want := range tests {
		if got := zegoUserIDFromAppUserID(input); got != want {
			t.Fatalf("zegoUserIDFromAppUserID(%q) = %q, want %q", input, got, want)
		}
	}

	got := zegoUserIDFromAppUserID("this-user-id-is-far-too-long-for-zego-and-needs-hashing")
	if len(got) != 32 || !zegoIdentifierPattern.MatchString(got) {
		t.Fatalf("hashed zego id = %q, want 32-character Zego-safe id", got)
	}
}

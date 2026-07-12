package httpclient

import (
	"errors"
	"net/http"
	"testing"

	orderapp "github.com/duclamdev/application-chat/backend/internal/modules/order/application"
)

func TestParseUpstreamErrorReadsJSONMessage(t *testing.T) {
	err := parseUpstreamError(http.StatusForbidden, []byte(`{
		"ok": false,
		"message": "IP không nằm trong whitelist: 160.191.55.144"
	}`))

	var upstream *orderapp.UpstreamError
	if !errors.As(err, &upstream) {
		t.Fatalf("error type = %T, want *application.UpstreamError", err)
	}
	if upstream.StatusCode != http.StatusForbidden {
		t.Fatalf("status = %d, want %d", upstream.StatusCode, http.StatusForbidden)
	}
	if upstream.Message != "IP không nằm trong whitelist: 160.191.55.144" {
		t.Fatalf("message = %q", upstream.Message)
	}
}

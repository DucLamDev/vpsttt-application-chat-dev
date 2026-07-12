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

func TestConfigurationErrorRejectsOverviewKey(t *testing.T) {
	client := New(Config{
		BaseURL:        "https://order.vpsttt.com/api",
		InternalAPIKey: "ovw_example",
	})

	if err := client.ConfigurationError(); err == nil {
		t.Fatal("ConfigurationError() = nil, want wrong-key error")
	}
}

func TestConfigurationErrorAcceptsInternalKey(t *testing.T) {
	client := New(Config{
		BaseURL:        "https://order.vpsttt.com/api",
		InternalAPIKey: "internal-api-key",
	})

	if err := client.ConfigurationError(); err != nil {
		t.Fatalf("ConfigurationError() = %v, want nil", err)
	}
}

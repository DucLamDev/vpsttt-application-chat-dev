package config

import "testing"

func TestLoadIncludesLocalFrontendCORSOrigins(t *testing.T) {
	t.Setenv("APP_ENV", "dev")
	t.Setenv("CORS_ALLOWED_ORIGINS", "")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}

	assertContains(t, cfg.HTTP.CORSAllowedOrigins, "http://localhost:3000")
	assertContains(t, cfg.HTTP.CORSAllowedOrigins, "http://localhost:3001")
}

func TestLoadMergesConfiguredAndLocalFrontendCORSOrigins(t *testing.T) {
	t.Setenv("APP_ENV", "dev")
	t.Setenv("CORS_ALLOWED_ORIGINS", "https://chat.vpsttt.com")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}

	assertContains(t, cfg.HTTP.CORSAllowedOrigins, "https://chat.vpsttt.com")
	assertContains(t, cfg.HTTP.CORSAllowedOrigins, "http://localhost:3000")
	assertContains(t, cfg.HTTP.CORSAllowedOrigins, "http://localhost:3001")
}

func TestValidateRejectsWeakProductionSecrets(t *testing.T) {
	cfg := &Config{
		App: AppConfig{
			Name: "webtui-chat",
			Env:  "production",
		},
		HTTP: HTTPConfig{
			Host: "0.0.0.0",
			Port: 8080,
		},
		Worker: WorkerConfig{
			Concurrency: 1,
		},
		Database: DatabaseConfig{
			URL: "postgres://user:pass@localhost:5432/app?sslmode=disable",
		},
		Security: SecurityConfig{
			JWTAccessSecret:      "change_me_access_secret",
			JWTRefreshSecret:     "change_me_refresh_secret",
			WebhookSigningSecret: "change_me_webhook_secret",
		},
	}

	if err := cfg.Validate(); err == nil {
		t.Fatal("Validate() expected weak secret error")
	}
}

func assertContains(t *testing.T, values []string, expected string) {
	t.Helper()

	for _, value := range values {
		if value == expected {
			return
		}
	}

	t.Fatalf("%q không có trong %v", expected, values)
}

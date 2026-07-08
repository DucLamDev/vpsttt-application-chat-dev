package config

import "testing"

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

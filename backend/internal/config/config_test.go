package config

import (
	"testing"
	"time"
)

func TestLoadIncludesLocalFrontendCORSOrigins(t *testing.T) {
	t.Setenv("APP_ENV", "dev")
	t.Setenv("CORS_ALLOWED_ORIGINS", "")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}

	assertContains(t, cfg.HTTP.CORSAllowedOrigins, "http://localhost:3000")
	assertContains(t, cfg.HTTP.CORSAllowedOrigins, "http://localhost:3001")
	assertContains(t, cfg.HTTP.CORSAllowedOrigins, "http://tauri.localhost")
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
	assertContains(t, cfg.HTTP.CORSAllowedOrigins, "http://tauri.localhost")
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

func TestLoadReadsRegistrationDefaultWorkspaceID(t *testing.T) {
	t.Setenv("APP_ENV", "dev")
	t.Setenv("REGISTRATION_DEFAULT_WORKSPACE_ID", "3f1e32b9-0a2f-4ca1-b0dc-04221a551c1c")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}
	if cfg.Registration.DefaultWorkspaceID != "3f1e32b9-0a2f-4ca1-b0dc-04221a551c1c" {
		t.Fatalf("Registration.DefaultWorkspaceID = %q", cfg.Registration.DefaultWorkspaceID)
	}
}

func TestLoadReadsDesktopVersionPolicy(t *testing.T) {
	t.Setenv("APP_ENV", "dev")
	t.Setenv("DESKTOP_MIN_VERSION", "1.4.0")
	t.Setenv("DESKTOP_RECOMMENDED_VERSION", "1.5.2")
	t.Setenv("DESKTOP_RELEASE_MANIFEST_DIR", "data/desktop-releases")
	t.Setenv("DESKTOP_UPDATE_URL", "https://chat.vpsttt.com/downloads/desktop/stable")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}
	if cfg.Client.DesktopMinimumVersion != "1.4.0" {
		t.Fatalf("DesktopMinimumVersion = %q", cfg.Client.DesktopMinimumVersion)
	}
	if cfg.Client.DesktopRecommendedVersion != "1.5.2" {
		t.Fatalf("DesktopRecommendedVersion = %q", cfg.Client.DesktopRecommendedVersion)
	}
	if cfg.Client.DesktopReleaseManifestDir != "data/desktop-releases" {
		t.Fatalf("DesktopReleaseManifestDir = %q", cfg.Client.DesktopReleaseManifestDir)
	}
	if cfg.Client.DesktopUpdateURL != "https://chat.vpsttt.com/downloads/desktop/stable" {
		t.Fatalf("DesktopUpdateURL = %q", cfg.Client.DesktopUpdateURL)
	}
}

func TestValidateRejectsInvalidDesktopUpdateURL(t *testing.T) {
	cfg := &Config{
		App:      AppConfig{Name: "webtui-chat", Env: "dev"},
		Client:   ClientConfig{DesktopUpdateURL: "not-a-url"},
		HTTP:     HTTPConfig{Host: "0.0.0.0", Port: 8080},
		Worker:   WorkerConfig{Concurrency: 1},
		Backup:   BackupConfig{PGDumpPath: "pg_dump", Timeout: time.Minute},
		Database: DatabaseConfig{Enabled: true, URL: "postgres://user:pass@localhost:5432/app?sslmode=disable"},
		Order:    OrderConfig{Timeout: time.Second},
	}

	if err := cfg.Validate(); err == nil {
		t.Fatal("Validate() expected invalid desktop update URL error")
	}
}

func TestValidateRejectsInvalidRegistrationDefaultWorkspaceID(t *testing.T) {
	cfg := &Config{
		App:          AppConfig{Name: "webtui-chat", Env: "dev"},
		HTTP:         HTTPConfig{Host: "0.0.0.0", Port: 8080},
		Worker:       WorkerConfig{Concurrency: 1},
		Backup:       BackupConfig{PGDumpPath: "pg_dump", Timeout: time.Minute},
		Database:     DatabaseConfig{Enabled: true, URL: "postgres://user:pass@localhost:5432/app?sslmode=disable"},
		Order:        OrderConfig{Timeout: time.Second},
		Registration: RegistrationConfig{DefaultWorkspaceID: "not-a-uuid"},
	}

	if err := cfg.Validate(); err == nil {
		t.Fatal("Validate() expected invalid default workspace UUID error")
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

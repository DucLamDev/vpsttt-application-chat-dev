package application

import (
	"context"
	"errors"
	"testing"
	"time"

	authdomain "github.com/duclamdev/application-chat/backend/internal/modules/auth/domain"
	sharedauth "github.com/duclamdev/application-chat/backend/internal/shared/auth"
)

type workspaceProvisioningRepo struct {
	user              authdomain.User
	provisionedUserID string
	provisioningErr   error
	createdSessions   int
}

func (r *workspaceProvisioningRepo) CreateUser(context.Context, CreateUserParams) (authdomain.User, error) {
	return r.user, nil
}

func (r *workspaceProvisioningRepo) EnsureDefaultWorkspaceMembership(_ context.Context, userID string) error {
	r.provisionedUserID = userID
	return r.provisioningErr
}

func (r *workspaceProvisioningRepo) FindUserByID(context.Context, string) (authdomain.User, error) {
	return r.user, nil
}

func (r *workspaceProvisioningRepo) FindUserByIdentifier(context.Context, string) (authdomain.User, error) {
	return r.user, nil
}

func (r *workspaceProvisioningRepo) UpdateLastLoginInfo(context.Context, UpdateLastLoginInfoParams) error {
	return nil
}

func (r *workspaceProvisioningRepo) CreateSession(_ context.Context, params CreateSessionParams) (authdomain.Session, error) {
	r.createdSessions++
	return authdomain.Session{ID: "session-1", UserID: params.UserID, ExpiresAt: params.ExpiresAt}, nil
}

func (r *workspaceProvisioningRepo) FindSessionByRefreshTokenHash(context.Context, string) (authdomain.Session, error) {
	return authdomain.Session{}, authdomain.ErrSessionNotFound
}

func (r *workspaceProvisioningRepo) RotateSessionRefreshToken(context.Context, RotateSessionParams) (authdomain.Session, error) {
	return authdomain.Session{}, nil
}

func (r *workspaceProvisioningRepo) RevokeSessionByRefreshTokenHash(context.Context, string, time.Time) error {
	return nil
}

func (r *workspaceProvisioningRepo) RevokeSessionByID(context.Context, string, string, time.Time) error {
	return nil
}

func (r *workspaceProvisioningRepo) RevokeAllSessions(context.Context, string, time.Time) error {
	return nil
}

func (r *workspaceProvisioningRepo) ListSessions(context.Context, string) ([]authdomain.Session, error) {
	return nil, nil
}

func (r *workspaceProvisioningRepo) RecordAudit(context.Context, AuditEvent) error {
	return nil
}

func TestDetectDeviceName(t *testing.T) {
	tests := []struct {
		name      string
		userAgent string
		want      string
	}{
		{
			name:      "windows chrome",
			userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36",
			want:      "Windows - Chrome",
		},
		{
			name:      "iphone safari",
			userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1",
			want:      "iPhone - Safari",
		},
		{
			name:      "unknown",
			userAgent: "",
			want:      "Thiết bị không xác định",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := detectDeviceName(tt.userAgent); got != tt.want {
				t.Fatalf("detectDeviceName() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestNormalizeClientInfoKeepsExplicitDeviceName(t *testing.T) {
	deviceName, ipAddress, userAgent := normalizeClientInfo("Laptop kế toán", "127.0.0.1", "Mozilla/5.0")

	if deviceName != "Laptop kế toán" {
		t.Fatalf("deviceName = %q", deviceName)
	}
	if ipAddress != "127.0.0.1" {
		t.Fatalf("ipAddress = %q", ipAddress)
	}
	if userAgent != "Mozilla/5.0" {
		t.Fatalf("userAgent = %q", userAgent)
	}
}

func TestGoogleUsernameIsStableAndValid(t *testing.T) {
	username := googleUsername("Ho.Duc.Lam@example.com", "google-subject-123")
	if !usernamePattern.MatchString(username) {
		t.Fatalf("googleUsername() = %q không hợp lệ", username)
	}
	if username != googleUsername("Ho.Duc.Lam@example.com", "google-subject-123") {
		t.Fatal("googleUsername() phải ổn định với cùng Google subject")
	}
}

func TestLoginRepairsDefaultWorkspaceMembershipBeforeCreatingSession(t *testing.T) {
	passwordHash, err := sharedauth.HashPassword("password-123")
	if err != nil {
		t.Fatalf("HashPassword() error = %v", err)
	}
	repo := &workspaceProvisioningRepo{user: authdomain.User{
		ID:           "6c8dd8dd-e7c3-4fa9-9f95-1cdf312587ba",
		Email:        "member@example.com",
		Username:     "member",
		DisplayName:  "Member",
		PasswordHash: passwordHash,
		Status:       "active",
	}}
	service := NewService(repo, sharedauth.NewManager("access-secret", "refresh-secret", time.Hour, 24*time.Hour))

	result, err := service.Login(context.Background(), LoginInput{
		Identifier: "member@example.com",
		Password:   "password-123",
	})
	if err != nil {
		t.Fatalf("Login() error = %v", err)
	}
	if repo.provisionedUserID != repo.user.ID {
		t.Fatalf("provisioned user = %q, want %q", repo.provisionedUserID, repo.user.ID)
	}
	if repo.createdSessions != 1 || result.SessionID != "session-1" {
		t.Fatalf("session was not created after provisioning: count=%d id=%q", repo.createdSessions, result.SessionID)
	}
}

func TestLoginDoesNotProvisionWorkspaceForInvalidPassword(t *testing.T) {
	passwordHash, err := sharedauth.HashPassword("password-123")
	if err != nil {
		t.Fatalf("HashPassword() error = %v", err)
	}
	repo := &workspaceProvisioningRepo{user: authdomain.User{
		ID:           "6c8dd8dd-e7c3-4fa9-9f95-1cdf312587ba",
		Email:        "member@example.com",
		Username:     "member",
		DisplayName:  "Member",
		PasswordHash: passwordHash,
		Status:       "active",
	}}
	service := NewService(repo, sharedauth.NewManager("access-secret", "refresh-secret", time.Hour, 24*time.Hour))

	if _, err := service.Login(context.Background(), LoginInput{
		Identifier: "member@example.com",
		Password:   "wrong-password",
	}); err == nil {
		t.Fatal("Login() expected invalid credentials error")
	}
	if repo.provisionedUserID != "" || repo.createdSessions != 0 {
		t.Fatalf("invalid login changed access: provisioned=%q sessions=%d", repo.provisionedUserID, repo.createdSessions)
	}
}

func TestLoginDoesNotCreateSessionWhenWorkspaceProvisioningFails(t *testing.T) {
	passwordHash, err := sharedauth.HashPassword("password-123")
	if err != nil {
		t.Fatalf("HashPassword() error = %v", err)
	}
	provisioningErr := errors.New("default workspace unavailable")
	repo := &workspaceProvisioningRepo{
		user: authdomain.User{
			ID:           "6c8dd8dd-e7c3-4fa9-9f95-1cdf312587ba",
			Email:        "member@example.com",
			Username:     "member",
			DisplayName:  "Member",
			PasswordHash: passwordHash,
			Status:       "active",
		},
		provisioningErr: provisioningErr,
	}
	service := NewService(repo, sharedauth.NewManager("access-secret", "refresh-secret", time.Hour, 24*time.Hour))

	_, err = service.Login(context.Background(), LoginInput{
		Identifier: "member@example.com",
		Password:   "password-123",
	})
	if !errors.Is(err, provisioningErr) {
		t.Fatalf("Login() error = %v, want provisioning error", err)
	}
	if repo.provisionedUserID != repo.user.ID || repo.createdSessions != 0 {
		t.Fatalf("failed provisioning created access: provisioned=%q sessions=%d", repo.provisionedUserID, repo.createdSessions)
	}
}

func TestMeRepairsDefaultWorkspaceMembershipForExistingSession(t *testing.T) {
	repo := &workspaceProvisioningRepo{user: authdomain.User{
		ID:          "6c8dd8dd-e7c3-4fa9-9f95-1cdf312587ba",
		Email:       "member@example.com",
		Username:    "member",
		DisplayName: "Member",
		Status:      "active",
	}}
	service := NewService(repo, sharedauth.NewManager("access-secret", "refresh-secret", time.Hour, 24*time.Hour))

	result, err := service.Me(context.Background(), repo.user.ID)
	if err != nil {
		t.Fatalf("Me() error = %v", err)
	}
	if repo.provisionedUserID != repo.user.ID {
		t.Fatalf("provisioned user = %q, want %q", repo.provisionedUserID, repo.user.ID)
	}
	if result.ID != repo.user.ID {
		t.Fatalf("Me() user ID = %q, want %q", result.ID, repo.user.ID)
	}
}

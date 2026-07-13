package postgres

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"strings"
	"time"

	authapp "github.com/duclamdev/application-chat/backend/internal/modules/auth/application"
	authdomain "github.com/duclamdev/application-chat/backend/internal/modules/auth/domain"
	apperrors "github.com/duclamdev/application-chat/backend/internal/shared/errors"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	pool               *pgxpool.Pool
	defaultWorkspaceID string
}

func NewRepository(pool *pgxpool.Pool, defaultWorkspaceID ...string) *Repository {
	workspaceID := ""
	if len(defaultWorkspaceID) > 0 {
		workspaceID = strings.TrimSpace(defaultWorkspaceID[0])
	}
	return &Repository{pool: pool, defaultWorkspaceID: workspaceID}
}

func (r *Repository) CreateUser(ctx context.Context, params authapp.CreateUserParams) (authdomain.User, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return authdomain.User{}, err
	}
	defer func() {
		_ = tx.Rollback(ctx)
	}()

	row := tx.QueryRow(ctx, `
INSERT INTO users (
    email,
    username,
    display_name,
    password_hash,
    status,
    registration_ip_address,
    registration_device_name,
    registration_user_agent,
    last_ip_address,
    device_name,
    last_user_agent,
    last_seen_at,
    avatar_url,
    email_verified_at
)
VALUES (
    $1,
    $2,
    $3,
    $4,
    'active',
    NULLIF($5, '')::inet,
    NULLIF($6, ''),
    NULLIF($7, ''),
    NULLIF($5, '')::inet,
    NULLIF($6, ''),
    NULLIF($7, ''),
    now(),
    NULLIF($8, ''),
    CASE WHEN $9 THEN now() ELSE NULL END
)
RETURNING id::text, email::text, username::text, display_name, password_hash, avatar_url, status,
          locale, timezone, email_verified_at, last_seen_at,
          host(registration_ip_address), registration_device_name,
          host(last_ip_address), device_name,
          created_at, updated_at
`, params.Email, params.Username, params.DisplayName, params.PasswordHash, params.IPAddress, params.DeviceName, params.UserAgent, params.AvatarURL, params.EmailVerified)

	user, err := scanUser(row)
	if err != nil {
		if isUniqueViolation(err) {
			return authdomain.User{}, authdomain.ErrUserAlreadyExists
		}
		return authdomain.User{}, err
	}
	if err := r.ensureDefaultWorkspaceMembership(ctx, tx, user.ID); err != nil {
		return authdomain.User{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return authdomain.User{}, err
	}
	return user, nil
}

// EnsureDefaultWorkspaceMembership provisions the baseline access required by
// the chat UI. It is idempotent so existing accounts are repaired on login.
// A configured workspace is preferred; a single active workspace is treated
// as the implicit default for self-hosted/single-tenant installations.
func (r *Repository) EnsureDefaultWorkspaceMembership(ctx context.Context, userID string) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() {
		_ = tx.Rollback(ctx)
	}()

	if err := r.ensureDefaultWorkspaceMembership(ctx, tx, userID); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (r *Repository) ensureDefaultWorkspaceMembership(ctx context.Context, tx pgx.Tx, userID string) error {
	workspaceID, err := r.resolveDefaultWorkspaceID(ctx, tx)
	if err != nil {
		return err
	}

	if _, err := tx.Exec(ctx, `
INSERT INTO workspace_members (workspace_id, user_id, status, joined_at)
SELECT $1::uuid, u.id, 'active', now()
FROM users u
WHERE u.id = $2::uuid AND u.status = 'active' AND u.deleted_at IS NULL
ON CONFLICT (workspace_id, user_id)
DO UPDATE SET status = 'active', joined_at = COALESCE(workspace_members.joined_at, now())
WHERE workspace_members.status = 'invited'
`, workspaceID, userID); err != nil {
		return err
	}
	var activeMember bool
	if err := tx.QueryRow(ctx, `
SELECT EXISTS (
    SELECT 1
    FROM workspace_members
    WHERE workspace_id = $1::uuid AND user_id = $2::uuid AND status = 'active'
)
`, workspaceID, userID).Scan(&activeMember); err != nil {
		return err
	}
	if !activeMember {
		return apperrors.New(
			"WORKSPACE_ACCESS_DISABLED",
			"Quyền truy cập workspace của tài khoản đã bị vô hiệu hóa.",
			403,
		)
	}

	// Do not overwrite or broaden an existing owner/admin role. Accounts with
	// no role receive only the baseline workspace_member role.
	if _, err := tx.Exec(ctx, `
INSERT INTO workspace_member_roles (workspace_id, user_id, role_id, assigned_by)
SELECT $1::uuid, $2::uuid, r.id, NULL
FROM roles r
WHERE r.code = 'workspace_member'
  AND r.workspace_id IS NULL
  AND r.is_system = true
  AND r.deleted_at IS NULL
  AND NOT EXISTS (
      SELECT 1
      FROM workspace_member_roles existing
      WHERE existing.workspace_id = $1::uuid AND existing.user_id = $2::uuid
  )
ORDER BY r.created_at
LIMIT 1
ON CONFLICT (workspace_id, user_id, role_id) DO NOTHING
`, workspaceID, userID); err != nil {
		return err
	}

	var hasRole bool
	if err := tx.QueryRow(ctx, `
SELECT EXISTS (
    SELECT 1
    FROM workspace_member_roles wmr
    JOIN roles r ON r.id = wmr.role_id AND r.deleted_at IS NULL
    WHERE wmr.workspace_id = $1::uuid AND wmr.user_id = $2::uuid
)
`, workspaceID, userID).Scan(&hasRole); err != nil {
		return err
	}
	if !hasRole {
		return defaultWorkspaceUnavailable("default_member_role_unavailable")
	}

	_, err = tx.Exec(ctx, `
INSERT INTO channel_members (channel_id, user_id, status)
SELECT c.id, $2::uuid, 'active'
FROM channels c
WHERE c.workspace_id = $1::uuid
  AND c.type = 'public'
  AND c.status = 'active'
  AND c.deleted_at IS NULL
  AND COALESCE(c.settings->>'bot_session_mode', '') <> 'private'
ON CONFLICT (channel_id, user_id) DO NOTHING
`, workspaceID, userID)
	return err
}

func (r *Repository) resolveDefaultWorkspaceID(ctx context.Context, tx pgx.Tx) (string, error) {
	if r.defaultWorkspaceID != "" {
		var workspaceID string
		err := tx.QueryRow(ctx, `
SELECT id::text
FROM workspaces
WHERE id = $1::uuid AND status = 'active' AND deleted_at IS NULL
`, r.defaultWorkspaceID).Scan(&workspaceID)
		if errors.Is(err, pgx.ErrNoRows) {
			return "", defaultWorkspaceUnavailable("configured_workspace_unavailable")
		}
		return workspaceID, err
	}

	rows, err := tx.Query(ctx, `
SELECT id::text
FROM workspaces
WHERE status = 'active' AND deleted_at IS NULL
ORDER BY created_at, id
LIMIT 2
`)
	if err != nil {
		return "", err
	}
	defer rows.Close()

	workspaceIDs := make([]string, 0, 2)
	for rows.Next() {
		var workspaceID string
		if err := rows.Scan(&workspaceID); err != nil {
			return "", err
		}
		workspaceIDs = append(workspaceIDs, workspaceID)
	}
	if err := rows.Err(); err != nil {
		return "", err
	}
	return resolveImplicitWorkspaceID(workspaceIDs)
}

func resolveImplicitWorkspaceID(workspaceIDs []string) (string, error) {
	switch len(workspaceIDs) {
	case 1:
		return workspaceIDs[0], nil
	case 0:
		return "", defaultWorkspaceUnavailable("no_active_workspace")
	default:
		return "", defaultWorkspaceUnavailable("ambiguous_active_workspaces")
	}
}

func defaultWorkspaceUnavailable(reason string) *apperrors.AppError {
	err := apperrors.New(
		"DEFAULT_WORKSPACE_UNAVAILABLE",
		"Workspace mặc định chưa sẵn sàng. Vui lòng liên hệ quản trị viên.",
		503,
	)
	err.Details = map[string]any{"reason": reason}
	return err
}

func (r *Repository) FindUserByID(ctx context.Context, id string) (authdomain.User, error) {
	row := r.pool.QueryRow(ctx, `
SELECT id::text, email::text, username::text, display_name, password_hash, avatar_url, status,
       locale, timezone, email_verified_at, last_seen_at,
       host(registration_ip_address), registration_device_name,
       host(last_ip_address), device_name,
       created_at, updated_at
FROM users
WHERE id = $1::uuid AND deleted_at IS NULL
`, id)
	return scanUser(row)
}

func (r *Repository) FindUserByIdentifier(ctx context.Context, identifier string) (authdomain.User, error) {
	row := r.pool.QueryRow(ctx, `
SELECT id::text, email::text, username::text, display_name, password_hash, avatar_url, status,
       locale, timezone, email_verified_at, last_seen_at,
       host(registration_ip_address), registration_device_name,
       host(last_ip_address), device_name,
       created_at, updated_at
FROM users
WHERE (email = $1 OR username = $1) AND deleted_at IS NULL
`, identifier)
	return scanUser(row)
}

func (r *Repository) UpdateLastLoginInfo(ctx context.Context, params authapp.UpdateLastLoginInfoParams) error {
	_, err := r.pool.Exec(ctx, `
UPDATE users
SET last_seen_at = $2,
    last_ip_address = NULLIF($3, '')::inet,
    device_name = NULLIF($4, ''),
    last_user_agent = NULLIF($5, '')
WHERE id = $1::uuid AND deleted_at IS NULL
`, params.UserID, params.SeenAt, params.IPAddress, params.DeviceName, params.UserAgent)
	return err
}

func (r *Repository) CreateSession(ctx context.Context, params authapp.CreateSessionParams) (authdomain.Session, error) {
	row := r.pool.QueryRow(ctx, `
INSERT INTO user_sessions (user_id, refresh_token_hash, device_name, ip_address, user_agent, expires_at)
VALUES ($1::uuid, $2, NULLIF($3, ''), NULLIF($4, '')::inet, NULLIF($5, ''), $6)
RETURNING id::text, user_id::text, refresh_token_hash, device_name, host(ip_address), user_agent,
          expires_at, revoked_at, created_at, updated_at
`, params.UserID, params.RefreshTokenHash, params.DeviceName, params.IPAddress, params.UserAgent, params.ExpiresAt)
	return scanSession(row)
}

func (r *Repository) FindSessionByRefreshTokenHash(ctx context.Context, hash string) (authdomain.Session, error) {
	row := r.pool.QueryRow(ctx, `
SELECT id::text, user_id::text, refresh_token_hash, device_name, host(ip_address), user_agent,
       expires_at, revoked_at, created_at, updated_at
FROM user_sessions
WHERE refresh_token_hash = $1
`, hash)
	return scanSession(row)
}

func (r *Repository) RotateSessionRefreshToken(ctx context.Context, params authapp.RotateSessionParams) (authdomain.Session, error) {
	row := r.pool.QueryRow(ctx, `
UPDATE user_sessions
SET refresh_token_hash = $3, expires_at = $4, revoked_at = NULL
WHERE id = $1::uuid AND user_id = $2::uuid AND revoked_at IS NULL
RETURNING id::text, user_id::text, refresh_token_hash, device_name, host(ip_address), user_agent,
          expires_at, revoked_at, created_at, updated_at
`, params.SessionID, params.UserID, params.RefreshTokenHash, params.ExpiresAt)
	return scanSession(row)
}

func (r *Repository) RevokeSessionByRefreshTokenHash(ctx context.Context, hash string, revokedAt time.Time) error {
	_, err := r.pool.Exec(ctx, `
UPDATE user_sessions
SET revoked_at = $2
WHERE refresh_token_hash = $1 AND revoked_at IS NULL
`, hash, revokedAt)
	return err
}

func (r *Repository) RevokeSessionByID(ctx context.Context, userID string, sessionID string, revokedAt time.Time) error {
	command, err := r.pool.Exec(ctx, `
UPDATE user_sessions
SET revoked_at = $3
WHERE id = $1::uuid AND user_id = $2::uuid AND revoked_at IS NULL
`, sessionID, userID, revokedAt)
	if err != nil {
		return err
	}
	if command.RowsAffected() == 0 {
		return authdomain.ErrSessionNotFound
	}
	return nil
}

func (r *Repository) RevokeAllSessions(ctx context.Context, userID string, revokedAt time.Time) error {
	_, err := r.pool.Exec(ctx, `
UPDATE user_sessions
SET revoked_at = $2
WHERE user_id = $1::uuid AND revoked_at IS NULL
`, userID, revokedAt)
	return err
}

func (r *Repository) ListSessions(ctx context.Context, userID string) ([]authdomain.Session, error) {
	rows, err := r.pool.Query(ctx, `
SELECT id::text, user_id::text, refresh_token_hash, device_name, host(ip_address), user_agent,
       expires_at, revoked_at, created_at, updated_at
FROM user_sessions
WHERE user_id = $1::uuid
ORDER BY created_at DESC
`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var sessions []authdomain.Session
	for rows.Next() {
		session, err := scanSession(rows)
		if err != nil {
			return nil, err
		}
		sessions = append(sessions, session)
	}
	return sessions, rows.Err()
}

func (r *Repository) RecordAudit(ctx context.Context, event authapp.AuditEvent) error {
	metadata := event.Metadata
	if metadata == nil {
		metadata = map[string]any{}
	}
	metadataBytes, err := json.Marshal(metadata)
	if err != nil {
		return err
	}

	_, err = r.pool.Exec(ctx, `
INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, ip_address, user_agent, metadata)
VALUES (NULLIF($1, '')::uuid, $2, $3, NULLIF($4, '')::uuid, NULLIF($5, '')::inet, NULLIF($6, ''), $7::jsonb)
	`, event.ActorUserID, event.Action, event.EntityType, event.EntityID, event.IPAddress, event.UserAgent, string(metadataBytes))
	return err
}

type rowScanner interface {
	Scan(dest ...any) error
}

func scanUser(row rowScanner) (authdomain.User, error) {
	var user authdomain.User
	var avatarURL sql.NullString
	var emailVerifiedAt sql.NullTime
	var lastSeenAt sql.NullTime
	var registrationIP sql.NullString
	var registrationDevice sql.NullString
	var lastIPAddress sql.NullString
	var deviceName sql.NullString

	err := row.Scan(
		&user.ID,
		&user.Email,
		&user.Username,
		&user.DisplayName,
		&user.PasswordHash,
		&avatarURL,
		&user.Status,
		&user.Locale,
		&user.Timezone,
		&emailVerifiedAt,
		&lastSeenAt,
		&registrationIP,
		&registrationDevice,
		&lastIPAddress,
		&deviceName,
		&user.CreatedAt,
		&user.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return authdomain.User{}, authdomain.ErrUserNotFound
		}
		return authdomain.User{}, err
	}

	user.AvatarURL = nullStringPtr(avatarURL)
	user.EmailVerifiedAt = nullTimePtr(emailVerifiedAt)
	user.LastSeenAt = nullTimePtr(lastSeenAt)
	user.RegistrationIP = nullStringPtr(registrationIP)
	user.RegistrationDev = nullStringPtr(registrationDevice)
	user.LastIPAddress = nullStringPtr(lastIPAddress)
	user.DeviceName = nullStringPtr(deviceName)
	return user, nil
}

func scanSession(row rowScanner) (authdomain.Session, error) {
	var session authdomain.Session
	var deviceName sql.NullString
	var ipAddress sql.NullString
	var userAgent sql.NullString
	var revokedAt sql.NullTime

	err := row.Scan(
		&session.ID,
		&session.UserID,
		&session.RefreshTokenHash,
		&deviceName,
		&ipAddress,
		&userAgent,
		&session.ExpiresAt,
		&revokedAt,
		&session.CreatedAt,
		&session.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return authdomain.Session{}, authdomain.ErrSessionNotFound
		}
		return authdomain.Session{}, err
	}

	session.DeviceName = nullStringPtr(deviceName)
	session.IPAddress = nullStringPtr(ipAddress)
	session.UserAgent = nullStringPtr(userAgent)
	session.RevokedAt = nullTimePtr(revokedAt)
	return session, nil
}

func nullStringPtr(value sql.NullString) *string {
	if !value.Valid {
		return nil
	}
	return &value.String
}

func nullTimePtr(value sql.NullTime) *time.Time {
	if !value.Valid {
		return nil
	}
	return &value.Time
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}

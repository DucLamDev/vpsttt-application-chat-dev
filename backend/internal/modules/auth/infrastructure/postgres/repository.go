package postgres

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"time"

	authapp "github.com/duclamdev/application-chat/backend/internal/modules/auth/application"
	authdomain "github.com/duclamdev/application-chat/backend/internal/modules/auth/domain"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

func (r *Repository) CreateUser(ctx context.Context, params authapp.CreateUserParams) (authdomain.User, error) {
	row := r.pool.QueryRow(ctx, `
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
	return user, nil
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

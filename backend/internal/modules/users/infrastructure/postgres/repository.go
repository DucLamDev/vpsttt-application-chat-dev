package postgres

import (
	"context"
	"database/sql"
	"errors"
	"time"

	usersapp "github.com/duclamdev/application-chat/backend/internal/modules/users/application"
	usersdomain "github.com/duclamdev/application-chat/backend/internal/modules/users/domain"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

func (r *Repository) FindByID(ctx context.Context, id string) (usersdomain.User, error) {
	row := r.pool.QueryRow(ctx, `
SELECT id::text, email::text, username::text, display_name, avatar_url, status,
       locale, timezone, email_verified_at, last_seen_at,
       host(registration_ip_address), registration_device_name,
       host(last_ip_address), device_name,
       created_at, updated_at
FROM users
WHERE id = $1::uuid AND deleted_at IS NULL
`, id)
	return scanUser(row)
}

func (r *Repository) List(ctx context.Context, params usersapp.ListUsersParams) ([]usersdomain.User, error) {
	rows, err := r.pool.Query(ctx, `
SELECT id::text, email::text, username::text, display_name, avatar_url, status,
       locale, timezone, email_verified_at, last_seen_at,
       host(registration_ip_address), registration_device_name,
       host(last_ip_address), device_name,
       created_at, updated_at
FROM users
WHERE deleted_at IS NULL
  AND ($1 = '' OR display_name ILIKE '%' || $1 || '%' OR email::text ILIKE '%' || $1 || '%' OR username::text ILIKE '%' || $1 || '%')
  AND ($2 = '' OR status = $2)
ORDER BY created_at DESC
LIMIT $3
`, params.Query, params.Status, params.Limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	users := make([]usersdomain.User, 0)
	for rows.Next() {
		user, err := scanUser(rows)
		if err != nil {
			return nil, err
		}
		users = append(users, user)
	}
	return users, rows.Err()
}

func (r *Repository) UpdateProfile(ctx context.Context, params usersapp.UpdateProfileParams) (usersdomain.User, error) {
	row := r.pool.QueryRow(ctx, `
UPDATE users
SET display_name = COALESCE($2, display_name),
    avatar_url = COALESCE($3, avatar_url),
    locale = COALESCE($4, locale),
    timezone = COALESCE($5, timezone)
WHERE id = $1::uuid AND deleted_at IS NULL
RETURNING id::text, email::text, username::text, display_name, avatar_url, status,
          locale, timezone, email_verified_at, last_seen_at,
          host(registration_ip_address), registration_device_name,
          host(last_ip_address), device_name,
          created_at, updated_at
`, params.UserID, params.DisplayName, params.AvatarURL, params.Locale, params.Timezone)
	return scanUser(row)
}

func (r *Repository) UpdateUser(ctx context.Context, params usersapp.UpdateUserParams) (usersdomain.User, error) {
	row := r.pool.QueryRow(ctx, `
UPDATE users
SET display_name = COALESCE($2, display_name),
    avatar_url = COALESCE($3, avatar_url),
    locale = COALESCE($4, locale),
    timezone = COALESCE($5, timezone),
    status = COALESCE($6, status)
WHERE id = $1::uuid AND deleted_at IS NULL
RETURNING id::text, email::text, username::text, display_name, avatar_url, status,
          locale, timezone, email_verified_at, last_seen_at,
          host(registration_ip_address), registration_device_name,
          host(last_ip_address), device_name,
          created_at, updated_at
`, params.UserID, params.DisplayName, params.AvatarURL, params.Locale, params.Timezone, params.Status)
	return scanUser(row)
}

func (r *Repository) DeleteUser(ctx context.Context, userID string) error {
	command, err := r.pool.Exec(ctx, `
UPDATE users
SET status = 'disabled', deleted_at = now()
WHERE id = $1::uuid AND deleted_at IS NULL
`, userID)
	if err != nil {
		return err
	}
	if command.RowsAffected() == 0 {
		return usersdomain.ErrUserNotFound
	}
	return nil
}

type rowScanner interface {
	Scan(dest ...any) error
}

func scanUser(row rowScanner) (usersdomain.User, error) {
	var user usersdomain.User
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
			return usersdomain.User{}, usersdomain.ErrUserNotFound
		}
		return usersdomain.User{}, err
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

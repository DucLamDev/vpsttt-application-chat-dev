package postgres

import (
	"context"
	"database/sql"
	"errors"
	"time"

	contactsdomain "github.com/duclamdev/application-chat/backend/internal/modules/contacts/domain"
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

func (r *Repository) ListContacts(ctx context.Context, actorUserID string) ([]contactsdomain.ContactRequest, error) {
	return r.list(ctx, actorUserID, "accepted")
}

func (r *Repository) ListRequests(ctx context.Context, actorUserID string, status string) ([]contactsdomain.ContactRequest, error) {
	if status == "all" {
		status = ""
	}
	return r.list(ctx, actorUserID, status)
}

func (r *Repository) CreateRequest(ctx context.Context, actorUserID string, receiverID string) (contactsdomain.ContactRequest, error) {
	if actorUserID == receiverID {
		return contactsdomain.ContactRequest{}, contactsdomain.ErrCannotContactSelf
	}
	if !r.userExists(ctx, receiverID) {
		return contactsdomain.ContactRequest{}, contactsdomain.ErrUserNotFound
	}

	row := r.pool.QueryRow(ctx, `
INSERT INTO contact_requests (requester_id, receiver_id, status)
VALUES ($1::uuid, $2::uuid, 'pending')
RETURNING id::text
`, actorUserID, receiverID)
	var requestID string
	if err := row.Scan(&requestID); err != nil {
		if isUniqueViolation(err) {
			return r.byPair(ctx, actorUserID, receiverID, actorUserID)
		}
		return contactsdomain.ContactRequest{}, err
	}
	return r.byID(ctx, requestID, actorUserID)
}

func (r *Repository) AcceptRequest(ctx context.Context, actorUserID string, requestID string) (contactsdomain.ContactRequest, error) {
	command, err := r.pool.Exec(ctx, `
UPDATE contact_requests
SET status = 'accepted',
    responded_at = now()
WHERE id = $1::uuid
  AND receiver_id = $2::uuid
  AND status = 'pending'
  AND deleted_at IS NULL
`, requestID, actorUserID)
	if err != nil {
		return contactsdomain.ContactRequest{}, err
	}
	if command.RowsAffected() == 0 {
		return contactsdomain.ContactRequest{}, contactsdomain.ErrContactRequestNotFound
	}
	return r.byID(ctx, requestID, actorUserID)
}

func (r *Repository) RejectRequest(ctx context.Context, actorUserID string, requestID string) (contactsdomain.ContactRequest, error) {
	command, err := r.pool.Exec(ctx, `
UPDATE contact_requests
SET status = 'rejected',
    responded_at = now()
WHERE id = $1::uuid
  AND receiver_id = $2::uuid
  AND status = 'pending'
  AND deleted_at IS NULL
`, requestID, actorUserID)
	if err != nil {
		return contactsdomain.ContactRequest{}, err
	}
	if command.RowsAffected() == 0 {
		return contactsdomain.ContactRequest{}, contactsdomain.ErrContactRequestNotFound
	}
	return r.byID(ctx, requestID, actorUserID)
}

func (r *Repository) CancelRequest(ctx context.Context, actorUserID string, requestID string) (contactsdomain.ContactRequest, error) {
	command, err := r.pool.Exec(ctx, `
UPDATE contact_requests
SET status = 'cancelled',
    deleted_at = now()
WHERE id = $1::uuid
  AND requester_id = $2::uuid
  AND status = 'pending'
  AND deleted_at IS NULL
`, requestID, actorUserID)
	if err != nil {
		return contactsdomain.ContactRequest{}, err
	}
	if command.RowsAffected() == 0 {
		return contactsdomain.ContactRequest{}, contactsdomain.ErrContactRequestNotFound
	}
	row := r.pool.QueryRow(ctx, `
SELECT cr.id::text, cr.requester_id::text, cr.receiver_id::text, cr.status,
       other_user.id::text, other_user.email::text, other_user.username::text, other_user.display_name,
       other_user.avatar_url, other_user.phone_number, other_user.status,
       cr.requested_at, cr.responded_at, cr.created_at, cr.updated_at
FROM contact_requests cr
JOIN users other_user
  ON other_user.id = CASE
      WHEN cr.requester_id = $2::uuid THEN cr.receiver_id
      ELSE cr.requester_id
  END
 AND other_user.deleted_at IS NULL
WHERE cr.id = $1::uuid
  AND (cr.requester_id = $2::uuid OR cr.receiver_id = $2::uuid)
`, requestID, actorUserID)
	return scanContactRequest(row)
}

func (r *Repository) list(ctx context.Context, actorUserID string, status string) ([]contactsdomain.ContactRequest, error) {
	rows, err := r.pool.Query(ctx, `
SELECT cr.id::text, cr.requester_id::text, cr.receiver_id::text, cr.status,
       other_user.id::text, other_user.email::text, other_user.username::text, other_user.display_name,
       other_user.avatar_url, other_user.phone_number, other_user.status,
       cr.requested_at, cr.responded_at, cr.created_at, cr.updated_at
FROM contact_requests cr
JOIN users other_user
  ON other_user.id = CASE
      WHEN cr.requester_id = $1::uuid THEN cr.receiver_id
      ELSE cr.requester_id
  END
 AND other_user.deleted_at IS NULL
WHERE (cr.requester_id = $1::uuid OR cr.receiver_id = $1::uuid)
  AND cr.deleted_at IS NULL
  AND ($2 = '' OR cr.status = $2)
ORDER BY cr.updated_at DESC
`, actorUserID, status)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]contactsdomain.ContactRequest, 0)
	for rows.Next() {
		item, err := scanContactRequest(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (r *Repository) byPair(ctx context.Context, leftUserID string, rightUserID string, actorUserID string) (contactsdomain.ContactRequest, error) {
	row := r.pool.QueryRow(ctx, `
SELECT cr.id::text, cr.requester_id::text, cr.receiver_id::text, cr.status,
       other_user.id::text, other_user.email::text, other_user.username::text, other_user.display_name,
       other_user.avatar_url, other_user.phone_number, other_user.status,
       cr.requested_at, cr.responded_at, cr.created_at, cr.updated_at
FROM contact_requests cr
JOIN users other_user
  ON other_user.id = CASE
      WHEN cr.requester_id = $3::uuid THEN cr.receiver_id
      ELSE cr.requester_id
  END
 AND other_user.deleted_at IS NULL
WHERE cr.deleted_at IS NULL
  AND cr.status IN ('pending', 'accepted')
  AND LEAST(cr.requester_id, cr.receiver_id) = LEAST($1::uuid, $2::uuid)
  AND GREATEST(cr.requester_id, cr.receiver_id) = GREATEST($1::uuid, $2::uuid)
`, leftUserID, rightUserID, actorUserID)
	return scanContactRequest(row)
}

func (r *Repository) byID(ctx context.Context, requestID string, actorUserID string) (contactsdomain.ContactRequest, error) {
	row := r.pool.QueryRow(ctx, `
SELECT cr.id::text, cr.requester_id::text, cr.receiver_id::text, cr.status,
       other_user.id::text, other_user.email::text, other_user.username::text, other_user.display_name,
       other_user.avatar_url, other_user.phone_number, other_user.status,
       cr.requested_at, cr.responded_at, cr.created_at, cr.updated_at
FROM contact_requests cr
JOIN users other_user
  ON other_user.id = CASE
      WHEN cr.requester_id = $2::uuid THEN cr.receiver_id
      ELSE cr.requester_id
  END
 AND other_user.deleted_at IS NULL
WHERE cr.id = $1::uuid
  AND (cr.requester_id = $2::uuid OR cr.receiver_id = $2::uuid)
  AND cr.deleted_at IS NULL
`, requestID, actorUserID)
	return scanContactRequest(row)
}

func (r *Repository) userExists(ctx context.Context, userID string) bool {
	var exists bool
	_ = r.pool.QueryRow(ctx, `
SELECT EXISTS (
    SELECT 1
    FROM users
    WHERE id = $1::uuid
      AND deleted_at IS NULL
      AND status = 'active'
)
`, userID).Scan(&exists)
	return exists
}

type rowScanner interface {
	Scan(dest ...any) error
}

func scanContactRequest(row rowScanner) (contactsdomain.ContactRequest, error) {
	var item contactsdomain.ContactRequest
	var avatarURL sql.NullString
	var phoneNumber sql.NullString
	var respondedAt sql.NullTime
	if err := row.Scan(
		&item.ID,
		&item.RequesterID,
		&item.ReceiverID,
		&item.Status,
		&item.User.ID,
		&item.User.Email,
		&item.User.Username,
		&item.User.DisplayName,
		&avatarURL,
		&phoneNumber,
		&item.User.Status,
		&item.RequestedAt,
		&respondedAt,
		&item.CreatedAt,
		&item.UpdatedAt,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return contactsdomain.ContactRequest{}, contactsdomain.ErrContactRequestNotFound
		}
		return contactsdomain.ContactRequest{}, err
	}
	item.User.AvatarURL = nullStringPtr(avatarURL)
	item.User.PhoneNumber = nullStringPtr(phoneNumber)
	item.RespondedAt = nullTimePtr(respondedAt)
	return item, nil
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

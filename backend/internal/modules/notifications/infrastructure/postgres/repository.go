package postgres

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"time"

	notificationsapp "github.com/duclamdev/application-chat/backend/internal/modules/notifications/application"
	notificationsdomain "github.com/duclamdev/application-chat/backend/internal/modules/notifications/domain"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

func (r *Repository) CreateMentionNotifications(ctx context.Context, params notificationsapp.MentionParams) error {
	for _, userID := range uniqueMentions(params.MentionedUserIDs, params.SenderID) {
		data, err := json.Marshal(map[string]any{
			"event_id":     params.EventID,
			"workspace_id": params.WorkspaceID,
			"channel_id":   params.ChannelID,
			"message_id":   params.MessageID,
			"sender_id":    params.SenderID,
		})
		if err != nil {
			return err
		}
		var notificationID string
		err = r.pool.QueryRow(ctx, `
INSERT INTO notifications (user_id, workspace_id, channel_id, message_id, type, title, body, data)
SELECT $1::uuid, $2::uuid, $3::uuid, $4::uuid, 'mention', 'Bạn được nhắc trong một tin nhắn', '', $5::jsonb
WHERE NOT EXISTS (
    SELECT 1
    FROM notifications
    WHERE user_id = $1::uuid AND data->>'event_id' = $6
)
RETURNING id::text
`, userID, params.WorkspaceID, params.ChannelID, params.MessageID, string(data), params.EventID).Scan(&notificationID)
		if errors.Is(err, pgx.ErrNoRows) {
			continue
		}
		if err != nil {
			return err
		}
		if err := r.createJob(ctx, notificationID, params.WorkspaceID, userID, data); err != nil {
			return err
		}
	}
	return nil
}

func (r *Repository) GetPreference(ctx context.Context, userID string, workspaceID string) (notificationsdomain.NotificationPreference, error) {
	row := r.pool.QueryRow(ctx, `
WITH member AS (
    SELECT $1::uuid AS user_id, $2::uuid AS workspace_id
    WHERE EXISTS (
        SELECT 1
        FROM workspace_members wm
        WHERE wm.user_id = $1::uuid
          AND wm.workspace_id = $2::uuid
          AND wm.status IN ('active', 'muted')
    )
)
SELECT m.user_id::text, m.workspace_id::text,
       COALESCE(np.mode, 'all'),
       COALESCE(np.preview, true),
       COALESCE(np.quiet_hours, false),
       COALESCE(np.quiet_start::text, '22:00'),
       COALESCE(np.quiet_end::text, '07:00'),
       COALESCE(np.created_at, now()),
       COALESCE(np.updated_at, now())
FROM member m
LEFT JOIN notification_preferences np
  ON np.user_id = m.user_id AND np.workspace_id = m.workspace_id
`, userID, workspaceID)
	return scanNotificationPreference(row)
}

func (r *Repository) ListForUser(ctx context.Context, params notificationsapp.ListParams) ([]notificationsdomain.Notification, error) {
	rows, err := r.pool.Query(ctx, `
SELECT id::text, user_id::text, workspace_id::text, channel_id::text, message_id::text,
       type, title, body, data::text, read_at, delivered_at, created_at
FROM notifications
WHERE user_id = $1::uuid
  AND ($2 = '' OR workspace_id = NULLIF($2, '')::uuid)
ORDER BY created_at DESC
LIMIT $3
`, params.UserID, params.WorkspaceID, params.Limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	notifications := make([]notificationsdomain.Notification, 0)
	for rows.Next() {
		notification, err := scanNotification(rows)
		if err != nil {
			return nil, err
		}
		notifications = append(notifications, notification)
	}
	return notifications, rows.Err()
}

func (r *Repository) MarkRead(ctx context.Context, userID string, notificationID string) (notificationsdomain.Notification, error) {
	row := r.pool.QueryRow(ctx, `
UPDATE notifications
SET read_at = COALESCE(read_at, now())
WHERE id = $2::uuid AND user_id = $1::uuid
RETURNING id::text, user_id::text, workspace_id::text, channel_id::text, message_id::text,
          type, title, body, data::text, read_at, delivered_at, created_at
`, userID, notificationID)
	return scanNotification(row)
}

func (r *Repository) MarkAllRead(ctx context.Context, userID string, workspaceID string) error {
	_, err := r.pool.Exec(ctx, `
UPDATE notifications
SET read_at = COALESCE(read_at, now())
WHERE user_id = $1::uuid
  AND ($2 = '' OR workspace_id = NULLIF($2, '')::uuid)
  AND read_at IS NULL
`, userID, workspaceID)
	return err
}

func (r *Repository) UpsertPreference(ctx context.Context, preference notificationsdomain.NotificationPreference) (notificationsdomain.NotificationPreference, error) {
	row := r.pool.QueryRow(ctx, `
WITH member AS (
    SELECT $1::uuid AS user_id, $2::uuid AS workspace_id
    WHERE EXISTS (
        SELECT 1
        FROM workspace_members wm
        WHERE wm.user_id = $1::uuid
          AND wm.workspace_id = $2::uuid
          AND wm.status IN ('active', 'muted')
    )
),
upserted AS (
    INSERT INTO notification_preferences (user_id, workspace_id, mode, preview, quiet_hours, quiet_start, quiet_end)
    SELECT user_id, workspace_id, $3, $4, $5, $6, $7
    FROM member
    ON CONFLICT (user_id, workspace_id) DO UPDATE SET
        mode = EXCLUDED.mode,
        preview = EXCLUDED.preview,
        quiet_hours = EXCLUDED.quiet_hours,
        quiet_start = EXCLUDED.quiet_start,
        quiet_end = EXCLUDED.quiet_end
    RETURNING user_id::text, workspace_id::text, mode, preview, quiet_hours, quiet_start::text, quiet_end::text, created_at, updated_at
)
SELECT user_id, workspace_id, mode, preview, quiet_hours, quiet_start, quiet_end, created_at, updated_at
FROM upserted
`, preference.UserID, preference.WorkspaceID, preference.Mode, preference.Preview, preference.QuietHours, preference.QuietStart, preference.QuietEnd)
	return scanNotificationPreference(row)
}

func (r *Repository) ProcessPendingJobs(ctx context.Context, limit int) (int, error) {
	rows, err := r.pool.Query(ctx, `
WITH picked AS (
    SELECT id
    FROM notification_jobs
    WHERE status = 'pending'
       OR (status = 'failed' AND (next_attempt_at IS NULL OR next_attempt_at <= now()))
    ORDER BY created_at ASC
    LIMIT $1
    FOR UPDATE SKIP LOCKED
),
updated AS (
    UPDATE notification_jobs nj
    SET status = 'sent',
        attempt_count = attempt_count + 1,
        sent_at = now(),
        error = NULL
    FROM picked
    WHERE nj.id = picked.id
    RETURNING nj.notification_id
)
UPDATE notifications n
SET delivered_at = COALESCE(delivered_at, now())
FROM updated
WHERE n.id = updated.notification_id
RETURNING n.id
`, limit)
	if err != nil {
		return 0, err
	}
	defer rows.Close()

	count := 0
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return 0, err
		}
		count++
	}
	return count, rows.Err()
}

func (r *Repository) createJob(ctx context.Context, notificationID string, workspaceID string, userID string, payload []byte) error {
	_, err := r.pool.Exec(ctx, `
INSERT INTO notification_jobs (notification_id, workspace_id, user_id, channel, payload)
VALUES ($1::uuid, $2::uuid, $3::uuid, 'desktop', $4::jsonb)
`, notificationID, workspaceID, userID, string(payload))
	return err
}

type rowScanner interface {
	Scan(dest ...any) error
}

func scanNotificationPreference(row rowScanner) (notificationsdomain.NotificationPreference, error) {
	var preference notificationsdomain.NotificationPreference
	if err := row.Scan(
		&preference.UserID,
		&preference.WorkspaceID,
		&preference.Mode,
		&preference.Preview,
		&preference.QuietHours,
		&preference.QuietStart,
		&preference.QuietEnd,
		&preference.CreatedAt,
		&preference.UpdatedAt,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return notificationsdomain.NotificationPreference{}, notificationsdomain.ErrNotificationPreferenceUnavailable
		}
		return notificationsdomain.NotificationPreference{}, err
	}
	return preference, nil
}

func scanNotification(row rowScanner) (notificationsdomain.Notification, error) {
	var notification notificationsdomain.Notification
	var workspaceID sql.NullString
	var channelID sql.NullString
	var messageID sql.NullString
	var data string
	var readAt sql.NullTime
	var deliveredAt sql.NullTime
	if err := row.Scan(
		&notification.ID,
		&notification.UserID,
		&workspaceID,
		&channelID,
		&messageID,
		&notification.Type,
		&notification.Title,
		&notification.Body,
		&data,
		&readAt,
		&deliveredAt,
		&notification.CreatedAt,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return notificationsdomain.Notification{}, notificationsdomain.ErrNotificationNotFound
		}
		return notificationsdomain.Notification{}, err
	}
	notification.WorkspaceID = nullStringPtr(workspaceID)
	notification.ChannelID = nullStringPtr(channelID)
	notification.MessageID = nullStringPtr(messageID)
	notification.Data = []byte(data)
	notification.ReadAt = nullTimePtr(readAt)
	notification.DeliveredAt = nullTimePtr(deliveredAt)
	return notification, nil
}

func uniqueMentions(ids []string, senderID string) []string {
	seen := map[string]bool{}
	result := make([]string, 0, len(ids))
	for _, id := range ids {
		if id == "" || id == senderID || seen[id] {
			continue
		}
		seen[id] = true
		result = append(result, id)
	}
	return result
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

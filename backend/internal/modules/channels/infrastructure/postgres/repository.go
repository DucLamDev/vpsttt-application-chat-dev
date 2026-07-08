package postgres

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	channelsapp "github.com/duclamdev/application-chat/backend/internal/modules/channels/application"
	channelsdomain "github.com/duclamdev/application-chat/backend/internal/modules/channels/domain"
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

func (r *Repository) CreateChannel(ctx context.Context, params channelsapp.CreateChannelParams) (channelsdomain.Channel, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return channelsdomain.Channel{}, err
	}
	defer func() {
		_ = tx.Rollback(ctx)
	}()

	row := tx.QueryRow(ctx, `
INSERT INTO channels (workspace_id, department_id, slug, name, description, type, created_by)
VALUES ($1::uuid, NULLIF($2, '')::uuid, $3, $4, NULLIF($5, ''), $6, $7::uuid)
RETURNING id::text, workspace_id::text, department_id::text, slug::text, name, description, type, status, created_by::text, created_at, updated_at, archived_at
`, params.WorkspaceID, params.DepartmentID, params.Slug, params.Name, params.Description, params.Type, params.CreatedBy)
	channel, err := scanChannel(row)
	if err != nil {
		if isUniqueViolation(err) {
			return channelsdomain.Channel{}, channelsdomain.ErrChannelConflict
		}
		return channelsdomain.Channel{}, err
	}

	if _, err := tx.Exec(ctx, `
INSERT INTO channel_members (channel_id, user_id, status)
VALUES ($1::uuid, $2::uuid, 'active')
ON CONFLICT (channel_id, user_id)
DO UPDATE SET status = 'active'
`, channel.ID, params.CreatedBy); err != nil {
		return channelsdomain.Channel{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return channelsdomain.Channel{}, err
	}
	return channel, nil
}

func (r *Repository) FindChannel(ctx context.Context, workspaceID string, channelID string) (channelsdomain.Channel, error) {
	row := r.pool.QueryRow(ctx, `
SELECT id::text, workspace_id::text, department_id::text, slug::text, name, description, type, status, created_by::text, created_at, updated_at, archived_at
FROM channels
WHERE workspace_id = $1::uuid AND id = $2::uuid AND deleted_at IS NULL
`, workspaceID, channelID)
	return scanChannel(row)
}

func (r *Repository) ListChannels(ctx context.Context, workspaceID string) ([]channelsdomain.Channel, error) {
	rows, err := r.pool.Query(ctx, `
SELECT id::text, workspace_id::text, department_id::text, slug::text, name, description, type, status, created_by::text, created_at, updated_at, archived_at
FROM channels
WHERE workspace_id = $1::uuid AND deleted_at IS NULL
ORDER BY type, name
`, workspaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var channels []channelsdomain.Channel
	for rows.Next() {
		channel, err := scanChannel(rows)
		if err != nil {
			return nil, err
		}
		channels = append(channels, channel)
	}
	return channels, rows.Err()
}

func (r *Repository) UpdateChannel(ctx context.Context, params channelsapp.UpdateChannelParams) (channelsdomain.Channel, error) {
	row := r.pool.QueryRow(ctx, `
UPDATE channels
SET department_id = COALESCE(NULLIF($3, '')::uuid, department_id),
    name = COALESCE($4, name),
    description = COALESCE($5, description)
WHERE workspace_id = $1::uuid AND id = $2::uuid AND deleted_at IS NULL
RETURNING id::text, workspace_id::text, department_id::text, slug::text, name, description, type, status, created_by::text, created_at, updated_at, archived_at
`, params.WorkspaceID, params.ChannelID, params.DepartmentID, params.Name, params.Description)
	return scanChannel(row)
}

func (r *Repository) ArchiveChannel(ctx context.Context, workspaceID string, channelID string) error {
	command, err := r.pool.Exec(ctx, `
UPDATE channels
SET status = 'archived', archived_at = now()
WHERE workspace_id = $1::uuid AND id = $2::uuid AND deleted_at IS NULL
`, workspaceID, channelID)
	if err != nil {
		return err
	}
	if command.RowsAffected() == 0 {
		return channelsdomain.ErrChannelNotFound
	}
	return nil
}

func (r *Repository) ListMembers(ctx context.Context, workspaceID string, channelID string) ([]channelsdomain.Member, error) {
	rows, err := r.pool.Query(ctx, `
SELECT cm.channel_id::text, cm.user_id::text, u.email::text, u.username::text, u.display_name,
       cm.status, cm.last_read_at, cm.last_read_message_id::text, cm.joined_at, cm.created_at, cm.updated_at
FROM channel_members cm
JOIN channels c ON c.id = cm.channel_id AND c.deleted_at IS NULL
JOIN users u ON u.id = cm.user_id AND u.deleted_at IS NULL
WHERE c.workspace_id = $1::uuid AND c.id = $2::uuid
ORDER BY u.display_name
`, workspaceID, channelID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var members []channelsdomain.Member
	for rows.Next() {
		member, err := scanMember(rows)
		if err != nil {
			return nil, err
		}
		members = append(members, member)
	}
	return members, rows.Err()
}

func (r *Repository) AddMember(ctx context.Context, params channelsapp.AddMemberParams) (channelsdomain.Member, error) {
	command, err := r.pool.Exec(ctx, `
INSERT INTO channel_members (channel_id, user_id, status)
SELECT c.id, $3::uuid, 'active'
FROM channels c
JOIN workspace_members wm
  ON wm.workspace_id = c.workspace_id AND wm.user_id = $3::uuid AND wm.status = 'active'
WHERE c.workspace_id = $1::uuid AND c.id = $2::uuid AND c.deleted_at IS NULL
ON CONFLICT (channel_id, user_id)
DO UPDATE SET status = 'active'
`, params.WorkspaceID, params.ChannelID, params.UserID)
	if err != nil {
		return channelsdomain.Member{}, err
	}
	if command.RowsAffected() == 0 {
		return channelsdomain.Member{}, channelsdomain.ErrMemberNotFound
	}
	return r.member(ctx, params.WorkspaceID, params.ChannelID, params.UserID)
}

func (r *Repository) UpdateMemberStatus(ctx context.Context, params channelsapp.UpdateMemberStatusParams) (channelsdomain.Member, error) {
	command, err := r.pool.Exec(ctx, `
UPDATE channel_members cm
SET status = $4
FROM channels c
WHERE c.id = cm.channel_id
  AND c.workspace_id = $1::uuid
  AND c.id = $2::uuid
  AND cm.user_id = $3::uuid
`, params.WorkspaceID, params.ChannelID, params.UserID, params.Status)
	if err != nil {
		return channelsdomain.Member{}, err
	}
	if command.RowsAffected() == 0 {
		return channelsdomain.Member{}, channelsdomain.ErrMemberNotFound
	}
	return r.member(ctx, params.WorkspaceID, params.ChannelID, params.UserID)
}

func (r *Repository) UpdateReadState(ctx context.Context, params channelsapp.UpdateReadStateParams) (channelsdomain.Member, error) {
	command, err := r.pool.Exec(ctx, `
UPDATE channel_members cm
SET last_read_at = now(),
    last_read_message_id = NULLIF($4, '')::uuid
FROM channels c
WHERE c.id = cm.channel_id
  AND c.workspace_id = $1::uuid
  AND c.id = $2::uuid
  AND cm.user_id = $3::uuid
`, params.WorkspaceID, params.ChannelID, params.UserID, params.LastReadMessageID)
	if err != nil {
		return channelsdomain.Member{}, err
	}
	if command.RowsAffected() == 0 {
		return channelsdomain.Member{}, channelsdomain.ErrMemberNotFound
	}
	return r.member(ctx, params.WorkspaceID, params.ChannelID, params.UserID)
}

func (r *Repository) CreateOrGetDirectConversation(ctx context.Context, params channelsapp.CreateDirectParams) (channelsdomain.DirectConversation, error) {
	existing, err := r.directByKey(ctx, params.WorkspaceID, params.ParticipantKey)
	if err == nil {
		return existing, nil
	}
	if err != nil && !errors.Is(err, pgx.ErrNoRows) && !errors.Is(err, channelsdomain.ErrChannelNotFound) {
		return channelsdomain.DirectConversation{}, err
	}

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return channelsdomain.DirectConversation{}, err
	}
	defer func() {
		_ = tx.Rollback(ctx)
	}()

	channelName := "Direct message"
	if params.ConversationType == "group" {
		channelName = "Group direct message"
	}
	var channelID string
	if err := tx.QueryRow(ctx, `
INSERT INTO channels (workspace_id, name, type, status, created_by)
VALUES ($1::uuid, $2, 'direct', 'active', $3::uuid)
RETURNING id::text
`, params.WorkspaceID, channelName, params.CreatedBy).Scan(&channelID); err != nil {
		return channelsdomain.DirectConversation{}, err
	}

	var directID string
	if err := tx.QueryRow(ctx, `
INSERT INTO direct_conversations (workspace_id, channel_id, participant_key, conversation_type, created_by)
VALUES ($1::uuid, $2::uuid, $3, $4, $5::uuid)
RETURNING id::text
`, params.WorkspaceID, channelID, params.ParticipantKey, params.ConversationType, params.CreatedBy).Scan(&directID); err != nil {
		if isUniqueViolation(err) {
			return r.directByKey(ctx, params.WorkspaceID, params.ParticipantKey)
		}
		return channelsdomain.DirectConversation{}, err
	}

	for _, userID := range params.ParticipantIDs {
		if _, err := tx.Exec(ctx, `
INSERT INTO direct_conversation_members (direct_conversation_id, user_id)
SELECT $1::uuid, wm.user_id
FROM workspace_members wm
WHERE wm.workspace_id = $2::uuid AND wm.user_id = $3::uuid AND wm.status = 'active'
ON CONFLICT DO NOTHING
`, directID, params.WorkspaceID, userID); err != nil {
			return channelsdomain.DirectConversation{}, err
		}
		if _, err := tx.Exec(ctx, `
INSERT INTO channel_members (channel_id, user_id, status)
SELECT $1::uuid, wm.user_id, 'active'
FROM workspace_members wm
WHERE wm.workspace_id = $2::uuid AND wm.user_id = $3::uuid AND wm.status = 'active'
ON CONFLICT (channel_id, user_id) DO UPDATE SET status = 'active'
`, channelID, params.WorkspaceID, userID); err != nil {
			return channelsdomain.DirectConversation{}, err
		}
	}

	var insertedCount int
	if err := tx.QueryRow(ctx, `
SELECT count(*)
FROM direct_conversation_members
WHERE direct_conversation_id = $1::uuid
`, directID).Scan(&insertedCount); err != nil {
		return channelsdomain.DirectConversation{}, err
	}
	if insertedCount != len(params.ParticipantIDs) {
		return channelsdomain.DirectConversation{}, channelsdomain.ErrMemberNotFound
	}

	if err := tx.Commit(ctx); err != nil {
		return channelsdomain.DirectConversation{}, err
	}
	return r.directByID(ctx, directID)
}

func (r *Repository) ListDirectConversations(ctx context.Context, workspaceID string, userID string) ([]channelsdomain.DirectConversation, error) {
	rows, err := r.pool.Query(ctx, `
SELECT dc.id::text, dc.workspace_id::text, dc.channel_id::text, dc.participant_key, dc.conversation_type,
       dc.created_by::text, dc.created_at, dc.updated_at
FROM direct_conversations dc
JOIN direct_conversation_members dcm ON dcm.direct_conversation_id = dc.id AND dcm.user_id = $2::uuid
WHERE dc.workspace_id = $1::uuid AND dc.archived_at IS NULL
ORDER BY dc.updated_at DESC
`, workspaceID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var conversations []channelsdomain.DirectConversation
	for rows.Next() {
		conversation, err := scanDirect(rows)
		if err != nil {
			return nil, err
		}
		conversation.ParticipantIDs, err = r.directParticipantIDs(ctx, conversation.ID)
		if err != nil {
			return nil, err
		}
		conversations = append(conversations, conversation)
	}
	return conversations, rows.Err()
}

func (r *Repository) RecordAudit(ctx context.Context, event channelsapp.AuditEvent) error {
	metadata := event.Metadata
	if metadata == nil {
		metadata = map[string]any{}
	}
	metadataBytes, err := json.Marshal(metadata)
	if err != nil {
		return err
	}
	_, err = r.pool.Exec(ctx, `
INSERT INTO audit_logs (workspace_id, actor_user_id, action, entity_type, entity_id, metadata)
VALUES (NULLIF($1, '')::uuid, NULLIF($2, '')::uuid, $3, $4, NULLIF($5, '')::uuid, $6::jsonb)
`, event.WorkspaceID, event.ActorUserID, event.Action, event.EntityType, event.EntityID, string(metadataBytes))
	return err
}

func (r *Repository) member(ctx context.Context, workspaceID string, channelID string, userID string) (channelsdomain.Member, error) {
	row := r.pool.QueryRow(ctx, `
SELECT cm.channel_id::text, cm.user_id::text, u.email::text, u.username::text, u.display_name,
       cm.status, cm.last_read_at, cm.last_read_message_id::text, cm.joined_at, cm.created_at, cm.updated_at
FROM channel_members cm
JOIN channels c ON c.id = cm.channel_id AND c.deleted_at IS NULL
JOIN users u ON u.id = cm.user_id AND u.deleted_at IS NULL
WHERE c.workspace_id = $1::uuid AND c.id = $2::uuid AND cm.user_id = $3::uuid
`, workspaceID, channelID, userID)
	return scanMember(row)
}

func (r *Repository) directByKey(ctx context.Context, workspaceID string, participantKey string) (channelsdomain.DirectConversation, error) {
	row := r.pool.QueryRow(ctx, `
SELECT id::text, workspace_id::text, channel_id::text, participant_key, conversation_type,
       created_by::text, created_at, updated_at
FROM direct_conversations
WHERE workspace_id = $1::uuid AND participant_key = $2 AND archived_at IS NULL
`, workspaceID, participantKey)
	conversation, err := scanDirect(row)
	if err != nil {
		return channelsdomain.DirectConversation{}, err
	}
	conversation.ParticipantIDs, err = r.directParticipantIDs(ctx, conversation.ID)
	return conversation, err
}

func (r *Repository) directByID(ctx context.Context, directID string) (channelsdomain.DirectConversation, error) {
	row := r.pool.QueryRow(ctx, `
SELECT id::text, workspace_id::text, channel_id::text, participant_key, conversation_type,
       created_by::text, created_at, updated_at
FROM direct_conversations
WHERE id = $1::uuid
`, directID)
	conversation, err := scanDirect(row)
	if err != nil {
		return channelsdomain.DirectConversation{}, err
	}
	conversation.ParticipantIDs, err = r.directParticipantIDs(ctx, conversation.ID)
	return conversation, err
}

func (r *Repository) directParticipantIDs(ctx context.Context, directID string) ([]string, error) {
	rows, err := r.pool.Query(ctx, `
SELECT user_id::text
FROM direct_conversation_members
WHERE direct_conversation_id = $1::uuid
ORDER BY user_id::text
`, directID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

type rowScanner interface {
	Scan(dest ...any) error
}

func scanChannel(row rowScanner) (channelsdomain.Channel, error) {
	var channel channelsdomain.Channel
	var departmentID sql.NullString
	var slug sql.NullString
	var description sql.NullString
	var createdBy sql.NullString
	var archivedAt sql.NullTime
	if err := row.Scan(
		&channel.ID,
		&channel.WorkspaceID,
		&departmentID,
		&slug,
		&channel.Name,
		&description,
		&channel.Type,
		&channel.Status,
		&createdBy,
		&channel.CreatedAt,
		&channel.UpdatedAt,
		&archivedAt,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return channelsdomain.Channel{}, channelsdomain.ErrChannelNotFound
		}
		return channelsdomain.Channel{}, err
	}
	channel.DepartmentID = nullStringPtr(departmentID)
	channel.Slug = nullStringPtr(slug)
	channel.Description = nullStringPtr(description)
	channel.CreatedBy = nullStringPtr(createdBy)
	channel.ArchivedAt = nullTimePtr(archivedAt)
	return channel, nil
}

func scanMember(row rowScanner) (channelsdomain.Member, error) {
	var member channelsdomain.Member
	var lastReadAt sql.NullTime
	var lastReadMessageID sql.NullString
	if err := row.Scan(
		&member.ChannelID,
		&member.UserID,
		&member.Email,
		&member.Username,
		&member.DisplayName,
		&member.Status,
		&lastReadAt,
		&lastReadMessageID,
		&member.JoinedAt,
		&member.CreatedAt,
		&member.UpdatedAt,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return channelsdomain.Member{}, channelsdomain.ErrMemberNotFound
		}
		return channelsdomain.Member{}, err
	}
	member.LastReadAt = nullTimePtr(lastReadAt)
	member.LastReadMessageID = nullStringPtr(lastReadMessageID)
	return member, nil
}

func scanDirect(row rowScanner) (channelsdomain.DirectConversation, error) {
	var conversation channelsdomain.DirectConversation
	var createdBy sql.NullString
	if err := row.Scan(
		&conversation.ID,
		&conversation.WorkspaceID,
		&conversation.ChannelID,
		&conversation.ParticipantKey,
		&conversation.ConversationType,
		&createdBy,
		&conversation.CreatedAt,
		&conversation.UpdatedAt,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return channelsdomain.DirectConversation{}, fmt.Errorf("%w", channelsdomain.ErrChannelNotFound)
		}
		return channelsdomain.DirectConversation{}, err
	}
	conversation.CreatedBy = nullStringPtr(createdBy)
	return conversation, nil
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

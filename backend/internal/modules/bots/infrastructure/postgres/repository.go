package postgres

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"

	botsapp "github.com/duclamdev/application-chat/backend/internal/modules/bots/application"
	botsdomain "github.com/duclamdev/application-chat/backend/internal/modules/bots/domain"
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

func (r *Repository) CreateBot(ctx context.Context, params botsapp.CreateBotParams) (botsdomain.Bot, error) {
	row := r.pool.QueryRow(ctx, `
INSERT INTO bots (workspace_id, slug, name, description, avatar_url, created_by, settings)
VALUES ($1::uuid, $2, $3, NULLIF($4, ''), NULLIF($5, ''), $6::uuid, $7::jsonb)
RETURNING id::text, workspace_id::text, slug::text, name, description, avatar_url, status,
          created_by::text, settings::text, created_at, updated_at
`, params.WorkspaceID, params.Slug, params.Name, params.Description, params.AvatarURL, params.CreatedBy, string(params.Settings))
	bot, err := scanBot(row)
	if isUniqueViolation(err) {
		return botsdomain.Bot{}, botsdomain.ErrBotAlreadyExists
	}
	return bot, err
}

func (r *Repository) ListBots(ctx context.Context, workspaceID string) ([]botsdomain.Bot, error) {
	rows, err := r.pool.Query(ctx, `
SELECT id::text, workspace_id::text, slug::text, name, description, avatar_url, status,
       created_by::text, settings::text, created_at, updated_at
FROM bots
WHERE workspace_id = $1::uuid AND deleted_at IS NULL
ORDER BY name, slug
`, workspaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	bots := make([]botsdomain.Bot, 0)
	for rows.Next() {
		bot, err := scanBot(rows)
		if err != nil {
			return nil, err
		}
		bots = append(bots, bot)
	}
	return bots, rows.Err()
}

func (r *Repository) InstallBot(ctx context.Context, params botsapp.InstallBotParams) (botsdomain.Installation, error) {
	row := r.pool.QueryRow(ctx, `
INSERT INTO bot_installations (bot_id, workspace_id, channel_id, config)
SELECT b.id, b.workspace_id, NULLIF($3, '')::uuid, $4::jsonb
FROM bots b
WHERE b.id = $2::uuid
  AND b.workspace_id = $1::uuid
  AND b.status = 'active'
  AND b.deleted_at IS NULL
  AND (
      $3 = ''
      OR EXISTS (
          SELECT 1
          FROM channels c
          WHERE c.id = $3::uuid
            AND c.workspace_id = b.workspace_id
            AND c.deleted_at IS NULL
            AND c.status = 'active'
      )
  )
RETURNING id::text, bot_id::text, workspace_id::text, channel_id::text, status, config::text, created_at, updated_at
`, params.WorkspaceID, params.BotID, params.ChannelID, string(params.Config))
	installation, err := scanInstallation(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return botsdomain.Installation{}, botsdomain.ErrBotNotFound
	}
	if isUniqueViolation(err) {
		return botsdomain.Installation{}, botsdomain.ErrBotAlreadyInstalled
	}
	return installation, err
}

func (r *Repository) ListInstallations(ctx context.Context, workspaceID string, botID string) ([]botsdomain.Installation, error) {
	rows, err := r.pool.Query(ctx, `
SELECT id::text, bot_id::text, workspace_id::text, channel_id::text, status, config::text, created_at, updated_at
FROM bot_installations
WHERE workspace_id = $1::uuid
  AND ($2 = '' OR bot_id = NULLIF($2, '')::uuid)
ORDER BY created_at DESC
`, workspaceID, botID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	installations := make([]botsdomain.Installation, 0)
	for rows.Next() {
		installation, err := scanInstallation(rows)
		if err != nil {
			return nil, err
		}
		installations = append(installations, installation)
	}
	return installations, rows.Err()
}

func (r *Repository) SendBotMessage(ctx context.Context, params botsapp.SendBotMessageParams) (botsdomain.BotMessage, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return botsdomain.BotMessage{}, err
	}
	defer func() {
		_ = tx.Rollback(ctx)
	}()

	metadata, err := mergeMetadata(params.Metadata, map[string]any{"bot_id": params.BotID})
	if err != nil {
		return botsdomain.BotMessage{}, err
	}

	row := tx.QueryRow(ctx, `
INSERT INTO messages (workspace_id, channel_id, sender_id, kind, body, metadata)
SELECT c.workspace_id, c.id, NULL, 'bot', $4, $5::jsonb
FROM channels c
WHERE c.workspace_id = $1::uuid
  AND c.id = $3::uuid
  AND c.deleted_at IS NULL
  AND c.status = 'active'
  AND EXISTS (
      SELECT 1
      FROM bots b
      WHERE b.id = $2::uuid
        AND b.workspace_id = c.workspace_id
        AND b.status = 'active'
        AND b.deleted_at IS NULL
  )
  AND EXISTS (
      SELECT 1
      FROM bot_installations bi
      WHERE bi.bot_id = $2::uuid
        AND bi.workspace_id = c.workspace_id
        AND bi.status = 'active'
        AND (bi.channel_id IS NULL OR bi.channel_id = c.id)
  )
RETURNING id::text, workspace_id::text, channel_id::text, kind, body, metadata::text, created_at
`, params.WorkspaceID, params.BotID, params.ChannelID, params.Body, string(metadata))
	message, err := scanBotMessage(row, params.BotID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return botsdomain.BotMessage{}, botsdomain.ErrBotNotInstalled
		}
		return botsdomain.BotMessage{}, err
	}

	if err := upsertSearchDocument(ctx, tx, message); err != nil {
		return botsdomain.BotMessage{}, err
	}
	if err := insertOutbox(ctx, tx, "message", message.ID, "MessageCreated", map[string]any{
		"workspace_id":       message.WorkspaceID,
		"channel_id":         message.ChannelID,
		"message_id":         message.ID,
		"sender_id":          "",
		"bot_id":             params.BotID,
		"mentioned_user_ids": []string{},
	}); err != nil {
		return botsdomain.BotMessage{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return botsdomain.BotMessage{}, err
	}
	return message, nil
}

type commandExecutor interface {
	Exec(ctx context.Context, sql string, arguments ...any) (pgconn.CommandTag, error)
}

func upsertSearchDocument(ctx context.Context, exec commandExecutor, message botsdomain.BotMessage) error {
	metadata, err := json.Marshal(map[string]any{
		"channel_id": message.ChannelID,
		"bot_id":     message.BotID,
		"kind":       message.Kind,
	})
	if err != nil {
		return err
	}
	_, err = exec.Exec(ctx, `
INSERT INTO search_documents (workspace_id, source_type, source_id, title, body, metadata)
VALUES ($1::uuid, 'message', $2::uuid, '', $3, $4::jsonb)
ON CONFLICT (workspace_id, source_type, source_id)
DO UPDATE SET body = EXCLUDED.body,
              metadata = EXCLUDED.metadata
`, message.WorkspaceID, message.ID, message.Body, string(metadata))
	return err
}

func insertOutbox(ctx context.Context, exec commandExecutor, aggregateType string, aggregateID string, eventType string, payload map[string]any) error {
	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	_, err = exec.Exec(ctx, `
INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, payload)
VALUES ($1, $2::uuid, $3, $4::jsonb)
`, aggregateType, aggregateID, eventType, string(payloadBytes))
	return err
}

func mergeMetadata(raw []byte, extra map[string]any) ([]byte, error) {
	metadata := map[string]any{}
	if len(raw) > 0 {
		if err := json.Unmarshal(raw, &metadata); err != nil {
			return nil, err
		}
	}
	for key, value := range extra {
		metadata[key] = value
	}
	return json.Marshal(metadata)
}

type rowScanner interface {
	Scan(dest ...any) error
}

func scanBot(row rowScanner) (botsdomain.Bot, error) {
	var bot botsdomain.Bot
	var description sql.NullString
	var avatarURL sql.NullString
	var createdBy sql.NullString
	var settings string
	if err := row.Scan(
		&bot.ID,
		&bot.WorkspaceID,
		&bot.Slug,
		&bot.Name,
		&description,
		&avatarURL,
		&bot.Status,
		&createdBy,
		&settings,
		&bot.CreatedAt,
		&bot.UpdatedAt,
	); err != nil {
		return botsdomain.Bot{}, err
	}
	bot.Description = nullStringPtr(description)
	bot.AvatarURL = nullStringPtr(avatarURL)
	bot.CreatedBy = nullStringPtr(createdBy)
	bot.Settings = []byte(settings)
	return bot, nil
}

func scanInstallation(row rowScanner) (botsdomain.Installation, error) {
	var installation botsdomain.Installation
	var channelID sql.NullString
	var config string
	if err := row.Scan(
		&installation.ID,
		&installation.BotID,
		&installation.WorkspaceID,
		&channelID,
		&installation.Status,
		&config,
		&installation.CreatedAt,
		&installation.UpdatedAt,
	); err != nil {
		return botsdomain.Installation{}, err
	}
	installation.ChannelID = nullStringPtr(channelID)
	installation.Config = []byte(config)
	return installation, nil
}

func scanBotMessage(row rowScanner, botID string) (botsdomain.BotMessage, error) {
	var message botsdomain.BotMessage
	var metadata string
	if err := row.Scan(
		&message.ID,
		&message.WorkspaceID,
		&message.ChannelID,
		&message.Kind,
		&message.Body,
		&metadata,
		&message.CreatedAt,
	); err != nil {
		return botsdomain.BotMessage{}, err
	}
	message.BotID = botID
	message.Metadata = []byte(metadata)
	return message, nil
}

func nullStringPtr(value sql.NullString) *string {
	if !value.Valid {
		return nil
	}
	return &value.String
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}

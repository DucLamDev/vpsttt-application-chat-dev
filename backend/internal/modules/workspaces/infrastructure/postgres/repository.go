package postgres

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"time"

	workspacesapp "github.com/duclamdev/application-chat/backend/internal/modules/workspaces/application"
	workspacesdomain "github.com/duclamdev/application-chat/backend/internal/modules/workspaces/domain"
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

func (r *Repository) CreateWorkspace(ctx context.Context, params workspacesapp.CreateWorkspaceParams) (workspacesdomain.Workspace, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return workspacesdomain.Workspace{}, err
	}
	defer func() {
		_ = tx.Rollback(ctx)
	}()

	row := tx.QueryRow(ctx, `
INSERT INTO workspaces (slug, name, description, owner_id)
VALUES ($1, $2, NULLIF($3, ''), $4::uuid)
RETURNING id::text, slug::text, name, description, owner_id::text, plan, status, created_at, updated_at
`, params.Slug, params.Name, params.Description, params.OwnerID)
	workspace, err := scanWorkspace(row)
	if err != nil {
		if isUniqueViolation(err) {
			return workspacesdomain.Workspace{}, workspacesdomain.ErrWorkspaceConflict
		}
		return workspacesdomain.Workspace{}, err
	}

	if _, err := tx.Exec(ctx, `
INSERT INTO workspace_members (workspace_id, user_id, status, joined_at)
VALUES ($1::uuid, $2::uuid, 'active', now())
ON CONFLICT (workspace_id, user_id)
DO UPDATE SET status = 'active', joined_at = COALESCE(workspace_members.joined_at, now())
`, workspace.ID, params.OwnerID); err != nil {
		return workspacesdomain.Workspace{}, err
	}

	if _, err := tx.Exec(ctx, `
INSERT INTO workspace_member_roles (workspace_id, user_id, role_id, assigned_by)
SELECT $1::uuid, $2::uuid, id, $2::uuid
FROM roles
WHERE workspace_id IS NULL AND code = 'workspace_owner' AND deleted_at IS NULL
ON CONFLICT DO NOTHING
`, workspace.ID, params.OwnerID); err != nil {
		return workspacesdomain.Workspace{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return workspacesdomain.Workspace{}, err
	}
	return workspace, nil
}

func (r *Repository) FindWorkspace(ctx context.Context, workspaceID string) (workspacesdomain.Workspace, error) {
	row := r.pool.QueryRow(ctx, `
SELECT id::text, slug::text, name, description, owner_id::text, plan, status, created_at, updated_at
FROM workspaces
WHERE id = $1::uuid AND deleted_at IS NULL
`, workspaceID)
	return scanWorkspace(row)
}

func (r *Repository) ListWorkspacesForUser(ctx context.Context, userID string) ([]workspacesdomain.Workspace, error) {
	rows, err := r.pool.Query(ctx, `
SELECT DISTINCT w.id::text, w.slug::text, w.name, w.description, w.owner_id::text, w.plan, w.status, w.created_at, w.updated_at
FROM workspaces w
LEFT JOIN workspace_members wm
  ON wm.workspace_id = w.id AND wm.user_id = $1::uuid AND wm.status = 'active'
WHERE w.deleted_at IS NULL
  AND (w.owner_id = $1::uuid OR wm.user_id IS NOT NULL)
ORDER BY w.created_at DESC
`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var workspaces []workspacesdomain.Workspace
	for rows.Next() {
		workspace, err := scanWorkspace(rows)
		if err != nil {
			return nil, err
		}
		workspaces = append(workspaces, workspace)
	}
	return workspaces, rows.Err()
}

func (r *Repository) UpdateWorkspace(ctx context.Context, params workspacesapp.UpdateWorkspaceParams) (workspacesdomain.Workspace, error) {
	row := r.pool.QueryRow(ctx, `
UPDATE workspaces
SET name = COALESCE($2, name),
    description = COALESCE($3, description)
WHERE id = $1::uuid AND deleted_at IS NULL
RETURNING id::text, slug::text, name, description, owner_id::text, plan, status, created_at, updated_at
`, params.WorkspaceID, params.Name, params.Description)
	return scanWorkspace(row)
}

func (r *Repository) ArchiveWorkspace(ctx context.Context, workspaceID string) error {
	command, err := r.pool.Exec(ctx, `
UPDATE workspaces
SET status = 'archived', deleted_at = now()
WHERE id = $1::uuid AND deleted_at IS NULL
`, workspaceID)
	if err != nil {
		return err
	}
	if command.RowsAffected() == 0 {
		return workspacesdomain.ErrWorkspaceNotFound
	}
	return nil
}

func (r *Repository) ListMembers(ctx context.Context, workspaceID string) ([]workspacesdomain.Member, error) {
	rows, err := r.pool.Query(ctx, `
SELECT wm.id::text, wm.workspace_id::text, wm.user_id::text, u.email::text, u.username::text, u.display_name,
       wm.status, wm.title, wm.joined_at, wm.created_at, wm.updated_at
FROM workspace_members wm
JOIN users u ON u.id = wm.user_id AND u.deleted_at IS NULL
WHERE wm.workspace_id = $1::uuid
ORDER BY wm.created_at DESC
`, workspaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var members []workspacesdomain.Member
	for rows.Next() {
		member, err := scanMember(rows)
		if err != nil {
			return nil, err
		}
		members = append(members, member)
	}
	return members, rows.Err()
}

func (r *Repository) AddMember(ctx context.Context, params workspacesapp.AddMemberParams) (workspacesdomain.Member, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return workspacesdomain.Member{}, err
	}
	defer func() {
		_ = tx.Rollback(ctx)
	}()

	if _, err := tx.Exec(ctx, `
INSERT INTO workspace_members (workspace_id, user_id, status, title, joined_at)
VALUES ($1::uuid, $2::uuid, 'active', NULLIF($3, ''), now())
ON CONFLICT (workspace_id, user_id)
DO UPDATE SET status = 'active', title = EXCLUDED.title, joined_at = COALESCE(workspace_members.joined_at, now())
`, params.WorkspaceID, params.UserID, params.Title); err != nil {
		return workspacesdomain.Member{}, err
	}

	command, err := tx.Exec(ctx, `
INSERT INTO workspace_member_roles (workspace_id, user_id, role_id, assigned_by)
SELECT $1::uuid, $2::uuid, r.id, $4::uuid
FROM roles r
WHERE r.code = $3
  AND r.deleted_at IS NULL
  AND (r.workspace_id IS NULL OR r.workspace_id = $1::uuid)
ORDER BY (r.workspace_id IS NULL), r.created_at DESC
LIMIT 1
ON CONFLICT (workspace_id, user_id, role_id)
DO UPDATE SET assigned_by = workspace_member_roles.assigned_by
`, params.WorkspaceID, params.UserID, params.RoleCode, params.AssignedBy)
	if err != nil {
		return workspacesdomain.Member{}, err
	}
	if command.RowsAffected() == 0 {
		return workspacesdomain.Member{}, workspacesdomain.ErrRoleNotFound
	}

	if err := tx.Commit(ctx); err != nil {
		return workspacesdomain.Member{}, err
	}
	return r.member(ctx, params.WorkspaceID, params.UserID)
}

func (r *Repository) UpdateMemberStatus(ctx context.Context, params workspacesapp.UpdateMemberStatusParams) (workspacesdomain.Member, error) {
	row := r.pool.QueryRow(ctx, `
UPDATE workspace_members
SET status = $3
WHERE workspace_id = $1::uuid AND user_id = $2::uuid
RETURNING id::text, workspace_id::text, user_id::text, ''::text, ''::text, ''::text, status, title, joined_at, created_at, updated_at
`, params.WorkspaceID, params.UserID, params.Status)
	member, err := scanMember(row)
	if err != nil {
		return workspacesdomain.Member{}, err
	}
	return r.member(ctx, member.WorkspaceID, member.UserID)
}

func (r *Repository) UpsertSetting(ctx context.Context, params workspacesapp.UpsertSettingParams) (workspacesdomain.Setting, error) {
	row := r.pool.QueryRow(ctx, `
INSERT INTO workspace_settings (workspace_id, key, value, value_type, description, updated_by)
VALUES ($1::uuid, $2, $3::jsonb, $4, NULLIF($5, ''), $6::uuid)
ON CONFLICT (workspace_id, key)
DO UPDATE SET value = EXCLUDED.value,
              value_type = EXCLUDED.value_type,
              description = EXCLUDED.description,
              updated_by = EXCLUDED.updated_by
RETURNING workspace_id::text, key, value, value_type, description, updated_by::text, created_at, updated_at
`, params.WorkspaceID, params.Key, string(params.Value), params.ValueType, params.Description, params.UpdatedBy)
	return scanSetting(row)
}

func (r *Repository) ListSettings(ctx context.Context, workspaceID string) ([]workspacesdomain.Setting, error) {
	rows, err := r.pool.Query(ctx, `
SELECT workspace_id::text, key, value, value_type, description, updated_by::text, created_at, updated_at
FROM workspace_settings
WHERE workspace_id = $1::uuid
ORDER BY key
`, workspaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var settings []workspacesdomain.Setting
	for rows.Next() {
		setting, err := scanSetting(rows)
		if err != nil {
			return nil, err
		}
		settings = append(settings, setting)
	}
	return settings, rows.Err()
}

func (r *Repository) CreateInvite(ctx context.Context, params workspacesapp.CreateInviteParams) (workspacesdomain.Invite, error) {
	row := r.pool.QueryRow(ctx, `
WITH selected_role AS (
    SELECT id
    FROM roles
    WHERE code = $3
      AND deleted_at IS NULL
      AND (workspace_id IS NULL OR workspace_id = $1::uuid)
    ORDER BY (workspace_id IS NULL), created_at DESC
    LIMIT 1
)
INSERT INTO workspace_invites (workspace_id, email, role_id, token_hash, invited_by, expires_at)
SELECT
    $1::uuid,
    $2,
    selected_role.id,
    $4,
    $5::uuid,
    $6
FROM selected_role
RETURNING id::text, workspace_id::text, email::text, role_id::text, invited_by::text,
          expires_at, accepted_at, revoked_at, created_at
`, params.WorkspaceID, params.Email, params.RoleCode, params.TokenHash, params.InvitedBy, params.ExpiresAt)
	invite, err := scanInvite(row)
	if errors.Is(err, workspacesdomain.ErrInviteNotFound) {
		return workspacesdomain.Invite{}, workspacesdomain.ErrRoleNotFound
	}
	return invite, err
}

func (r *Repository) ListInvites(ctx context.Context, workspaceID string) ([]workspacesdomain.Invite, error) {
	rows, err := r.pool.Query(ctx, `
SELECT id::text, workspace_id::text, email::text, role_id::text, invited_by::text,
       expires_at, accepted_at, revoked_at, created_at
FROM workspace_invites
WHERE workspace_id = $1::uuid
ORDER BY created_at DESC
`, workspaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var invites []workspacesdomain.Invite
	for rows.Next() {
		invite, err := scanInvite(rows)
		if err != nil {
			return nil, err
		}
		invites = append(invites, invite)
	}
	return invites, rows.Err()
}

func (r *Repository) RecordAudit(ctx context.Context, event workspacesapp.AuditEvent) error {
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

func (r *Repository) member(ctx context.Context, workspaceID string, userID string) (workspacesdomain.Member, error) {
	row := r.pool.QueryRow(ctx, `
SELECT wm.id::text, wm.workspace_id::text, wm.user_id::text, u.email::text, u.username::text, u.display_name,
       wm.status, wm.title, wm.joined_at, wm.created_at, wm.updated_at
FROM workspace_members wm
JOIN users u ON u.id = wm.user_id AND u.deleted_at IS NULL
WHERE wm.workspace_id = $1::uuid AND wm.user_id = $2::uuid
`, workspaceID, userID)
	return scanMember(row)
}

type rowScanner interface {
	Scan(dest ...any) error
}

func scanWorkspace(row rowScanner) (workspacesdomain.Workspace, error) {
	var workspace workspacesdomain.Workspace
	var description sql.NullString
	var ownerID sql.NullString
	if err := row.Scan(
		&workspace.ID,
		&workspace.Slug,
		&workspace.Name,
		&description,
		&ownerID,
		&workspace.Plan,
		&workspace.Status,
		&workspace.CreatedAt,
		&workspace.UpdatedAt,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return workspacesdomain.Workspace{}, workspacesdomain.ErrWorkspaceNotFound
		}
		return workspacesdomain.Workspace{}, err
	}
	workspace.Description = nullStringPtr(description)
	workspace.OwnerID = nullStringPtr(ownerID)
	return workspace, nil
}

func scanMember(row rowScanner) (workspacesdomain.Member, error) {
	var member workspacesdomain.Member
	var title sql.NullString
	var joinedAt sql.NullTime
	if err := row.Scan(
		&member.ID,
		&member.WorkspaceID,
		&member.UserID,
		&member.Email,
		&member.Username,
		&member.DisplayName,
		&member.Status,
		&title,
		&joinedAt,
		&member.CreatedAt,
		&member.UpdatedAt,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return workspacesdomain.Member{}, workspacesdomain.ErrMemberNotFound
		}
		return workspacesdomain.Member{}, err
	}
	member.Title = nullStringPtr(title)
	member.JoinedAt = nullTimePtr(joinedAt)
	return member, nil
}

func scanSetting(row rowScanner) (workspacesdomain.Setting, error) {
	var setting workspacesdomain.Setting
	var value []byte
	var description sql.NullString
	var updatedBy sql.NullString
	if err := row.Scan(
		&setting.WorkspaceID,
		&setting.Key,
		&value,
		&setting.ValueType,
		&description,
		&updatedBy,
		&setting.CreatedAt,
		&setting.UpdatedAt,
	); err != nil {
		return workspacesdomain.Setting{}, err
	}
	setting.Value = value
	setting.Description = nullStringPtr(description)
	setting.UpdatedBy = nullStringPtr(updatedBy)
	return setting, nil
}

func scanInvite(row rowScanner) (workspacesdomain.Invite, error) {
	var invite workspacesdomain.Invite
	var roleID sql.NullString
	var invitedBy sql.NullString
	var acceptedAt sql.NullTime
	var revokedAt sql.NullTime
	if err := row.Scan(
		&invite.ID,
		&invite.WorkspaceID,
		&invite.Email,
		&roleID,
		&invitedBy,
		&invite.ExpiresAt,
		&acceptedAt,
		&revokedAt,
		&invite.CreatedAt,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return workspacesdomain.Invite{}, workspacesdomain.ErrInviteNotFound
		}
		return workspacesdomain.Invite{}, err
	}
	invite.RoleID = nullStringPtr(roleID)
	invite.InvitedBy = nullStringPtr(invitedBy)
	invite.AcceptedAt = nullTimePtr(acceptedAt)
	invite.RevokedAt = nullTimePtr(revokedAt)
	return invite, nil
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

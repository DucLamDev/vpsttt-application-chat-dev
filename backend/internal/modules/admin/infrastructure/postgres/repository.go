package postgres

import (
	"context"

	adminapp "github.com/duclamdev/application-chat/backend/internal/modules/admin/application"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

func (r *Repository) DashboardStats(ctx context.Context, workspaceID string) (adminapp.DashboardStats, error) {
	var stats adminapp.DashboardStats
	err := r.pool.QueryRow(ctx, `
SELECT
    $1::text,
    (SELECT count(*) FROM workspace_members WHERE workspace_id = $1::uuid AND status = 'active'),
    (SELECT count(*) FROM channels WHERE workspace_id = $1::uuid AND deleted_at IS NULL),
    (SELECT count(*) FROM messages WHERE workspace_id = $1::uuid AND deleted_at IS NULL),
    (SELECT count(*) FROM files WHERE workspace_id = $1::uuid AND deleted_at IS NULL),
    (SELECT count(*) FROM bots WHERE workspace_id = $1::uuid AND deleted_at IS NULL),
    (SELECT count(*) FROM incoming_webhooks WHERE workspace_id = $1::uuid),
    (SELECT count(*) FROM outgoing_webhooks WHERE workspace_id = $1::uuid),
    (SELECT count(*) FROM audit_logs WHERE workspace_id = $1::uuid),
    (SELECT count(*) FROM backup_jobs WHERE workspace_id = $1::uuid OR workspace_id IS NULL)
`, workspaceID).Scan(
		&stats.WorkspaceID,
		&stats.ActiveMembers,
		&stats.Channels,
		&stats.Messages,
		&stats.Files,
		&stats.Bots,
		&stats.IncomingWebhooks,
		&stats.OutgoingWebhooks,
		&stats.AuditLogs,
		&stats.BackupJobs,
	)
	if err != nil {
		return adminapp.DashboardStats{}, err
	}
	return stats, nil
}

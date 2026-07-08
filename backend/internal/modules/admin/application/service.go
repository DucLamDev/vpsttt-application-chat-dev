package application

import (
	"context"
	"strings"
	"time"

	apperrors "github.com/duclamdev/application-chat/backend/internal/shared/errors"
)

const PermissionViewAdmin = "admin.view"

type PermissionChecker interface {
	HasWorkspacePermission(ctx context.Context, userID string, workspaceID string, permissionCode string) (bool, error)
}

type Repository interface {
	DashboardStats(ctx context.Context, workspaceID string) (DashboardStats, error)
}

type Service struct {
	repo    Repository
	checker PermissionChecker
	now     func() time.Time
}

type DashboardStats struct {
	WorkspaceID      string
	ActiveMembers    int64
	Channels         int64
	Messages         int64
	Files            int64
	Bots             int64
	IncomingWebhooks int64
	OutgoingWebhooks int64
	AuditLogs        int64
	BackupJobs       int64
}

type DashboardStatsDTO struct {
	WorkspaceID      string `json:"workspace_id"`
	ActiveMembers    int64  `json:"active_members"`
	Channels         int64  `json:"channels"`
	Messages         int64  `json:"messages"`
	Files            int64  `json:"files"`
	Bots             int64  `json:"bots"`
	IncomingWebhooks int64  `json:"incoming_webhooks"`
	OutgoingWebhooks int64  `json:"outgoing_webhooks"`
	AuditLogs        int64  `json:"audit_logs"`
	BackupJobs       int64  `json:"backup_jobs"`
	GeneratedAt      string `json:"generated_at"`
}

func NewService(repo Repository, checker PermissionChecker) *Service {
	return &Service{repo: repo, checker: checker, now: func() time.Time { return time.Now().UTC() }}
}

func (s *Service) Dashboard(ctx context.Context, actorUserID string, workspaceID string) (DashboardStatsDTO, error) {
	if err := s.EnsureAdminPermission(ctx, actorUserID, workspaceID); err != nil {
		return DashboardStatsDTO{}, err
	}
	stats, err := s.repo.DashboardStats(ctx, strings.TrimSpace(workspaceID))
	if err != nil {
		return DashboardStatsDTO{}, err
	}
	return DashboardStatsDTO{
		WorkspaceID:      stats.WorkspaceID,
		ActiveMembers:    stats.ActiveMembers,
		Channels:         stats.Channels,
		Messages:         stats.Messages,
		Files:            stats.Files,
		Bots:             stats.Bots,
		IncomingWebhooks: stats.IncomingWebhooks,
		OutgoingWebhooks: stats.OutgoingWebhooks,
		AuditLogs:        stats.AuditLogs,
		BackupJobs:       stats.BackupJobs,
		GeneratedAt:      s.now().Format(time.RFC3339),
	}, nil
}

func (s *Service) EnsureAdminPermission(ctx context.Context, userID string, workspaceID string) error {
	if s.checker == nil {
		return nil
	}
	allowed, err := s.checker.HasWorkspacePermission(ctx, strings.TrimSpace(userID), strings.TrimSpace(workspaceID), PermissionViewAdmin)
	if err != nil {
		return err
	}
	if !allowed {
		return apperrors.Forbidden("Bạn không có quyền xem trang quản trị.")
	}
	return nil
}

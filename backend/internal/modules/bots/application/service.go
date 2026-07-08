package application

import (
	"context"
	"encoding/json"
	"errors"
	"regexp"
	"strings"
	"time"

	botsdomain "github.com/duclamdev/application-chat/backend/internal/modules/bots/domain"
	apperrors "github.com/duclamdev/application-chat/backend/internal/shared/errors"
)

var botSlugPattern = regexp.MustCompile(`^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$`)

type PermissionChecker interface {
	HasWorkspacePermission(ctx context.Context, userID string, workspaceID string, permissionCode string) (bool, error)
}

type Repository interface {
	CreateBot(ctx context.Context, params CreateBotParams) (botsdomain.Bot, error)
	ListBots(ctx context.Context, workspaceID string) ([]botsdomain.Bot, error)
	InstallBot(ctx context.Context, params InstallBotParams) (botsdomain.Installation, error)
	ListInstallations(ctx context.Context, workspaceID string, botID string) ([]botsdomain.Installation, error)
	SendBotMessage(ctx context.Context, params SendBotMessageParams) (botsdomain.BotMessage, error)
}

type Service struct {
	repo    Repository
	checker PermissionChecker
}

type CreateBotInput struct {
	ActorUserID string
	WorkspaceID string
	Slug        string
	Name        string
	Description string
	AvatarURL   string
	Settings    json.RawMessage
}

type CreateBotParams struct {
	WorkspaceID string
	Slug        string
	Name        string
	Description string
	AvatarURL   string
	CreatedBy   string
	Settings    []byte
}

type InstallBotInput struct {
	ActorUserID string
	WorkspaceID string
	BotID       string
	ChannelID   string
	Config      json.RawMessage
}

type InstallBotParams struct {
	WorkspaceID string
	BotID       string
	ChannelID   string
	Config      []byte
}

type SendBotMessageInput struct {
	ActorUserID string
	WorkspaceID string
	BotID       string
	ChannelID   string
	Body        string
	Metadata    json.RawMessage
}

type SendBotMessageParams struct {
	WorkspaceID string
	BotID       string
	ChannelID   string
	Body        string
	Metadata    []byte
}

type BotDTO struct {
	ID          string          `json:"id"`
	WorkspaceID string          `json:"workspace_id"`
	Slug        string          `json:"slug"`
	Name        string          `json:"name"`
	Description *string         `json:"description,omitempty"`
	AvatarURL   *string         `json:"avatar_url,omitempty"`
	Status      string          `json:"status"`
	CreatedBy   *string         `json:"created_by,omitempty"`
	Settings    json.RawMessage `json:"settings"`
	CreatedAt   string          `json:"created_at"`
	UpdatedAt   string          `json:"updated_at"`
}

type InstallationDTO struct {
	ID          string          `json:"id"`
	BotID       string          `json:"bot_id"`
	WorkspaceID string          `json:"workspace_id"`
	ChannelID   *string         `json:"channel_id,omitempty"`
	Status      string          `json:"status"`
	Config      json.RawMessage `json:"config"`
	CreatedAt   string          `json:"created_at"`
	UpdatedAt   string          `json:"updated_at"`
}

type BotMessageDTO struct {
	ID          string          `json:"id"`
	WorkspaceID string          `json:"workspace_id"`
	ChannelID   string          `json:"channel_id"`
	BotID       string          `json:"bot_id"`
	Kind        string          `json:"kind"`
	Body        string          `json:"body"`
	Metadata    json.RawMessage `json:"metadata"`
	CreatedAt   string          `json:"created_at"`
}

func NewService(repo Repository, checker PermissionChecker) *Service {
	return &Service{repo: repo, checker: checker}
}

func (s *Service) CreateBot(ctx context.Context, input CreateBotInput) (BotDTO, error) {
	if err := s.ensureManagePermission(ctx, input.ActorUserID, input.WorkspaceID); err != nil {
		return BotDTO{}, err
	}
	slug := strings.ToLower(strings.TrimSpace(input.Slug))
	name := strings.TrimSpace(input.Name)
	if !botSlugPattern.MatchString(slug) {
		return BotDTO{}, apperrors.BadRequest("VALIDATION_ERROR", "Slug bot phải dài 3-63 ký tự và chỉ gồm chữ thường, số hoặc dấu gạch ngang.")
	}
	if name == "" || len([]rune(name)) > 120 {
		return BotDTO{}, apperrors.BadRequest("VALIDATION_ERROR", "Tên bot phải dài từ 1 đến 120 ký tự.")
	}
	settings, err := normalizeJSON(input.Settings, "Settings bot không phải JSON hợp lệ.")
	if err != nil {
		return BotDTO{}, err
	}
	bot, err := s.repo.CreateBot(ctx, CreateBotParams{
		WorkspaceID: strings.TrimSpace(input.WorkspaceID),
		Slug:        slug,
		Name:        name,
		Description: strings.TrimSpace(input.Description),
		AvatarURL:   strings.TrimSpace(input.AvatarURL),
		CreatedBy:   strings.TrimSpace(input.ActorUserID),
		Settings:    settings,
	})
	if err != nil {
		return BotDTO{}, mapBotError(err)
	}
	return toBotDTO(bot), nil
}

func (s *Service) ListBots(ctx context.Context, actorUserID string, workspaceID string) ([]BotDTO, error) {
	if err := s.ensureManagePermission(ctx, actorUserID, workspaceID); err != nil {
		return nil, err
	}
	bots, err := s.repo.ListBots(ctx, strings.TrimSpace(workspaceID))
	if err != nil {
		return nil, err
	}
	return toBotDTOs(bots), nil
}

func (s *Service) InstallBot(ctx context.Context, input InstallBotInput) (InstallationDTO, error) {
	if err := s.ensureManagePermission(ctx, input.ActorUserID, input.WorkspaceID); err != nil {
		return InstallationDTO{}, err
	}
	config, err := normalizeJSON(input.Config, "Config cài đặt bot không phải JSON hợp lệ.")
	if err != nil {
		return InstallationDTO{}, err
	}
	installation, err := s.repo.InstallBot(ctx, InstallBotParams{
		WorkspaceID: strings.TrimSpace(input.WorkspaceID),
		BotID:       strings.TrimSpace(input.BotID),
		ChannelID:   strings.TrimSpace(input.ChannelID),
		Config:      config,
	})
	if err != nil {
		return InstallationDTO{}, mapBotError(err)
	}
	return toInstallationDTO(installation), nil
}

func (s *Service) ListInstallations(ctx context.Context, actorUserID string, workspaceID string, botID string) ([]InstallationDTO, error) {
	if err := s.ensureManagePermission(ctx, actorUserID, workspaceID); err != nil {
		return nil, err
	}
	installations, err := s.repo.ListInstallations(ctx, strings.TrimSpace(workspaceID), strings.TrimSpace(botID))
	if err != nil {
		return nil, err
	}
	return toInstallationDTOs(installations), nil
}

func (s *Service) SendMessage(ctx context.Context, input SendBotMessageInput) (BotMessageDTO, error) {
	if err := s.ensureManagePermission(ctx, input.ActorUserID, input.WorkspaceID); err != nil {
		return BotMessageDTO{}, err
	}
	body := strings.TrimSpace(input.Body)
	if body == "" || len([]rune(body)) > 8000 {
		return BotMessageDTO{}, apperrors.BadRequest("VALIDATION_ERROR", "Nội dung bot message phải dài từ 1 đến 8000 ký tự.")
	}
	metadata, err := normalizeJSON(input.Metadata, "Metadata bot message không phải JSON hợp lệ.")
	if err != nil {
		return BotMessageDTO{}, err
	}
	message, err := s.repo.SendBotMessage(ctx, SendBotMessageParams{
		WorkspaceID: strings.TrimSpace(input.WorkspaceID),
		BotID:       strings.TrimSpace(input.BotID),
		ChannelID:   strings.TrimSpace(input.ChannelID),
		Body:        body,
		Metadata:    metadata,
	})
	if err != nil {
		return BotMessageDTO{}, mapBotError(err)
	}
	return toBotMessageDTO(message), nil
}

func (s *Service) ensureManagePermission(ctx context.Context, userID string, workspaceID string) error {
	allowed, err := s.checker.HasWorkspacePermission(ctx, strings.TrimSpace(userID), strings.TrimSpace(workspaceID), "bot.manage")
	if err != nil {
		return err
	}
	if !allowed {
		return apperrors.Forbidden("Bạn không có quyền quản lý bot.")
	}
	return nil
}

func normalizeJSON(value json.RawMessage, message string) ([]byte, error) {
	if len(value) == 0 || strings.TrimSpace(string(value)) == "" || strings.TrimSpace(string(value)) == "null" {
		return []byte(`{}`), nil
	}
	if !json.Valid(value) {
		return nil, apperrors.BadRequest("VALIDATION_ERROR", message)
	}
	return []byte(value), nil
}

func mapBotError(err error) error {
	if errors.Is(err, botsdomain.ErrBotNotFound) {
		return apperrors.NotFound("BOT_NOT_FOUND", "Không tìm thấy bot.")
	}
	if errors.Is(err, botsdomain.ErrBotAlreadyExists) {
		return apperrors.Conflict("BOT_ALREADY_EXISTS", "Bot đã tồn tại trong workspace.")
	}
	if errors.Is(err, botsdomain.ErrBotAlreadyInstalled) {
		return apperrors.Conflict("BOT_ALREADY_INSTALLED", "Bot đã được cài đặt.")
	}
	if errors.Is(err, botsdomain.ErrBotNotInstalled) {
		return apperrors.BadRequest("BOT_NOT_INSTALLED", "Bot chưa được cài đặt vào kênh.")
	}
	return err
}

func toBotDTOs(bots []botsdomain.Bot) []BotDTO {
	dtos := make([]BotDTO, 0, len(bots))
	for _, bot := range bots {
		dtos = append(dtos, toBotDTO(bot))
	}
	return dtos
}

func toBotDTO(bot botsdomain.Bot) BotDTO {
	settings := json.RawMessage(bot.Settings)
	if len(settings) == 0 {
		settings = json.RawMessage(`{}`)
	}
	return BotDTO{
		ID:          bot.ID,
		WorkspaceID: bot.WorkspaceID,
		Slug:        bot.Slug,
		Name:        bot.Name,
		Description: bot.Description,
		AvatarURL:   bot.AvatarURL,
		Status:      bot.Status,
		CreatedBy:   bot.CreatedBy,
		Settings:    settings,
		CreatedAt:   formatTime(bot.CreatedAt),
		UpdatedAt:   formatTime(bot.UpdatedAt),
	}
}

func toInstallationDTOs(installations []botsdomain.Installation) []InstallationDTO {
	dtos := make([]InstallationDTO, 0, len(installations))
	for _, installation := range installations {
		dtos = append(dtos, toInstallationDTO(installation))
	}
	return dtos
}

func toInstallationDTO(installation botsdomain.Installation) InstallationDTO {
	config := json.RawMessage(installation.Config)
	if len(config) == 0 {
		config = json.RawMessage(`{}`)
	}
	return InstallationDTO{
		ID:          installation.ID,
		BotID:       installation.BotID,
		WorkspaceID: installation.WorkspaceID,
		ChannelID:   installation.ChannelID,
		Status:      installation.Status,
		Config:      config,
		CreatedAt:   formatTime(installation.CreatedAt),
		UpdatedAt:   formatTime(installation.UpdatedAt),
	}
}

func toBotMessageDTO(message botsdomain.BotMessage) BotMessageDTO {
	metadata := json.RawMessage(message.Metadata)
	if len(metadata) == 0 {
		metadata = json.RawMessage(`{}`)
	}
	return BotMessageDTO{
		ID:          message.ID,
		WorkspaceID: message.WorkspaceID,
		ChannelID:   message.ChannelID,
		BotID:       message.BotID,
		Kind:        message.Kind,
		Body:        message.Body,
		Metadata:    metadata,
		CreatedAt:   formatTime(message.CreatedAt),
	}
}

func formatTime(value time.Time) string {
	return value.UTC().Format(time.RFC3339)
}

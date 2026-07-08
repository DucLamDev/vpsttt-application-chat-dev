package application

import (
	"context"
	"errors"
	"regexp"
	"sort"
	"strings"
	"time"

	channelsdomain "github.com/duclamdev/application-chat/backend/internal/modules/channels/domain"
	apperrors "github.com/duclamdev/application-chat/backend/internal/shared/errors"
)

var channelSlugPattern = regexp.MustCompile(`^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$`)

type PermissionChecker interface {
	HasWorkspacePermission(ctx context.Context, userID string, workspaceID string, permissionCode string) (bool, error)
}

type Repository interface {
	CreateChannel(ctx context.Context, params CreateChannelParams) (channelsdomain.Channel, error)
	FindChannel(ctx context.Context, workspaceID string, channelID string) (channelsdomain.Channel, error)
	ListChannels(ctx context.Context, workspaceID string) ([]channelsdomain.Channel, error)
	UpdateChannel(ctx context.Context, params UpdateChannelParams) (channelsdomain.Channel, error)
	ArchiveChannel(ctx context.Context, workspaceID string, channelID string) error
	ListMembers(ctx context.Context, workspaceID string, channelID string) ([]channelsdomain.Member, error)
	AddMember(ctx context.Context, params AddMemberParams) (channelsdomain.Member, error)
	UpdateMemberStatus(ctx context.Context, params UpdateMemberStatusParams) (channelsdomain.Member, error)
	UpdateReadState(ctx context.Context, params UpdateReadStateParams) (channelsdomain.Member, error)
	CreateOrGetDirectConversation(ctx context.Context, params CreateDirectParams) (channelsdomain.DirectConversation, error)
	ListDirectConversations(ctx context.Context, workspaceID string, userID string) ([]channelsdomain.DirectConversation, error)
	RecordAudit(ctx context.Context, event AuditEvent) error
}

type Service struct {
	repo    Repository
	checker PermissionChecker
}

type CreateChannelInput struct {
	ActorUserID  string
	WorkspaceID  string
	DepartmentID string
	Slug         string
	Name         string
	Description  string
	Type         string
}

type CreateChannelParams struct {
	WorkspaceID  string
	DepartmentID string
	Slug         string
	Name         string
	Description  string
	Type         string
	CreatedBy    string
}

type UpdateChannelInput struct {
	ActorUserID  string
	WorkspaceID  string
	ChannelID    string
	DepartmentID *string
	Name         *string
	Description  *string
}

type UpdateChannelParams struct {
	WorkspaceID  string
	ChannelID    string
	DepartmentID *string
	Name         *string
	Description  *string
}

type AddMemberInput struct {
	ActorUserID string
	WorkspaceID string
	ChannelID   string
	UserID      string
}

type AddMemberParams struct {
	WorkspaceID string
	ChannelID   string
	UserID      string
}

type UpdateMemberStatusInput struct {
	ActorUserID string
	WorkspaceID string
	ChannelID   string
	UserID      string
	Status      string
}

type UpdateMemberStatusParams struct {
	WorkspaceID string
	ChannelID   string
	UserID      string
	Status      string
}

type UpdateReadStateInput struct {
	ActorUserID       string
	WorkspaceID       string
	ChannelID         string
	LastReadMessageID string
}

type UpdateReadStateParams struct {
	WorkspaceID       string
	ChannelID         string
	UserID            string
	LastReadMessageID string
}

type CreateDirectInput struct {
	ActorUserID    string
	WorkspaceID    string
	ParticipantIDs []string
}

type CreateDirectParams struct {
	WorkspaceID      string
	ParticipantKey   string
	ParticipantIDs   []string
	ConversationType string
	CreatedBy        string
}

type AuditEvent struct {
	ActorUserID string
	WorkspaceID string
	Action      string
	EntityType  string
	EntityID    string
	Metadata    map[string]any
}

type ChannelDTO struct {
	ID           string  `json:"id"`
	WorkspaceID  string  `json:"workspace_id"`
	DepartmentID *string `json:"department_id,omitempty"`
	Slug         *string `json:"slug,omitempty"`
	Name         string  `json:"name"`
	Description  *string `json:"description,omitempty"`
	Type         string  `json:"type"`
	Status       string  `json:"status"`
	CreatedBy    *string `json:"created_by,omitempty"`
	CreatedAt    string  `json:"created_at"`
	UpdatedAt    string  `json:"updated_at"`
	ArchivedAt   *string `json:"archived_at,omitempty"`
}

type MemberDTO struct {
	ChannelID         string  `json:"channel_id"`
	UserID            string  `json:"user_id"`
	Email             string  `json:"email"`
	Username          string  `json:"username"`
	DisplayName       string  `json:"display_name"`
	Status            string  `json:"status"`
	LastReadAt        *string `json:"last_read_at,omitempty"`
	LastReadMessageID *string `json:"last_read_message_id,omitempty"`
	JoinedAt          string  `json:"joined_at"`
	CreatedAt         string  `json:"created_at"`
	UpdatedAt         string  `json:"updated_at"`
}

type DirectConversationDTO struct {
	ID               string   `json:"id"`
	WorkspaceID      string   `json:"workspace_id"`
	ChannelID        string   `json:"channel_id"`
	ParticipantKey   string   `json:"participant_key"`
	ConversationType string   `json:"conversation_type"`
	ParticipantIDs   []string `json:"participant_ids"`
	CreatedAt        string   `json:"created_at"`
	UpdatedAt        string   `json:"updated_at"`
}

func NewService(repo Repository, checker PermissionChecker) *Service {
	return &Service{repo: repo, checker: checker}
}

func (s *Service) Create(ctx context.Context, input CreateChannelInput) (ChannelDTO, error) {
	if err := s.ensurePermission(ctx, input.ActorUserID, input.WorkspaceID, "channel.create"); err != nil {
		return ChannelDTO{}, err
	}
	input.Type = strings.TrimSpace(input.Type)
	if input.Type == "" {
		input.Type = "public"
	}
	if input.Type != "public" && input.Type != "private" {
		return ChannelDTO{}, apperrors.BadRequest("VALIDATION_ERROR", "Loại kênh không hợp lệ.")
	}
	input.Slug = strings.ToLower(strings.TrimSpace(input.Slug))
	input.Name = strings.TrimSpace(input.Name)
	if !channelSlugPattern.MatchString(input.Slug) {
		return ChannelDTO{}, apperrors.BadRequest("VALIDATION_ERROR", "Slug kênh không hợp lệ.")
	}
	if input.Name == "" {
		return ChannelDTO{}, apperrors.BadRequest("VALIDATION_ERROR", "Tên kênh không được để trống.")
	}
	channel, err := s.repo.CreateChannel(ctx, CreateChannelParams{
		WorkspaceID:  strings.TrimSpace(input.WorkspaceID),
		DepartmentID: strings.TrimSpace(input.DepartmentID),
		Slug:         input.Slug,
		Name:         input.Name,
		Description:  strings.TrimSpace(input.Description),
		Type:         input.Type,
		CreatedBy:    strings.TrimSpace(input.ActorUserID),
	})
	if err != nil {
		if errors.Is(err, channelsdomain.ErrChannelConflict) {
			return ChannelDTO{}, apperrors.Conflict("CHANNEL_ALREADY_EXISTS", "Slug kênh đã tồn tại.")
		}
		return ChannelDTO{}, err
	}
	_ = s.repo.RecordAudit(ctx, AuditEvent{ActorUserID: input.ActorUserID, WorkspaceID: input.WorkspaceID, Action: "channel.create", EntityType: "channel", EntityID: channel.ID})
	return toChannelDTO(channel), nil
}

func (s *Service) Get(ctx context.Context, actorUserID string, workspaceID string, channelID string) (ChannelDTO, error) {
	if err := s.ensureWorkspaceAccess(ctx, actorUserID, workspaceID); err != nil {
		return ChannelDTO{}, err
	}
	channel, err := s.repo.FindChannel(ctx, strings.TrimSpace(workspaceID), strings.TrimSpace(channelID))
	if err != nil {
		return ChannelDTO{}, mapChannelError(err)
	}
	return toChannelDTO(channel), nil
}

func (s *Service) List(ctx context.Context, actorUserID string, workspaceID string) ([]ChannelDTO, error) {
	if err := s.ensureWorkspaceAccess(ctx, actorUserID, workspaceID); err != nil {
		return nil, err
	}
	channels, err := s.repo.ListChannels(ctx, strings.TrimSpace(workspaceID))
	if err != nil {
		return nil, err
	}
	dtos := make([]ChannelDTO, 0, len(channels))
	for _, channel := range channels {
		dtos = append(dtos, toChannelDTO(channel))
	}
	return dtos, nil
}

func (s *Service) Update(ctx context.Context, input UpdateChannelInput) (ChannelDTO, error) {
	if err := s.ensurePermission(ctx, input.ActorUserID, input.WorkspaceID, "channel.manage"); err != nil {
		return ChannelDTO{}, err
	}
	channel, err := s.repo.UpdateChannel(ctx, UpdateChannelParams{
		WorkspaceID:  strings.TrimSpace(input.WorkspaceID),
		ChannelID:    strings.TrimSpace(input.ChannelID),
		DepartmentID: cleanOptional(input.DepartmentID),
		Name:         cleanOptional(input.Name),
		Description:  cleanOptional(input.Description),
	})
	if err != nil {
		return ChannelDTO{}, mapChannelError(err)
	}
	return toChannelDTO(channel), nil
}

func (s *Service) Archive(ctx context.Context, actorUserID string, workspaceID string, channelID string) error {
	if err := s.ensurePermission(ctx, actorUserID, workspaceID, "channel.delete"); err != nil {
		return err
	}
	if err := s.repo.ArchiveChannel(ctx, strings.TrimSpace(workspaceID), strings.TrimSpace(channelID)); err != nil {
		return mapChannelError(err)
	}
	return nil
}

func (s *Service) ListMembers(ctx context.Context, actorUserID string, workspaceID string, channelID string) ([]MemberDTO, error) {
	if err := s.ensureWorkspaceAccess(ctx, actorUserID, workspaceID); err != nil {
		return nil, err
	}
	members, err := s.repo.ListMembers(ctx, strings.TrimSpace(workspaceID), strings.TrimSpace(channelID))
	if err != nil {
		return nil, err
	}
	return toMemberDTOs(members), nil
}

func (s *Service) AddMember(ctx context.Context, input AddMemberInput) (MemberDTO, error) {
	if err := s.ensurePermission(ctx, input.ActorUserID, input.WorkspaceID, "channel.manage"); err != nil {
		return MemberDTO{}, err
	}
	member, err := s.repo.AddMember(ctx, AddMemberParams{
		WorkspaceID: strings.TrimSpace(input.WorkspaceID),
		ChannelID:   strings.TrimSpace(input.ChannelID),
		UserID:      strings.TrimSpace(input.UserID),
	})
	if err != nil {
		return MemberDTO{}, mapMemberError(err)
	}
	return toMemberDTO(member), nil
}

func (s *Service) UpdateMemberStatus(ctx context.Context, input UpdateMemberStatusInput) (MemberDTO, error) {
	if err := s.ensurePermission(ctx, input.ActorUserID, input.WorkspaceID, "channel.manage"); err != nil {
		return MemberDTO{}, err
	}
	status := strings.TrimSpace(input.Status)
	if status != "active" && status != "muted" && status != "left" && status != "removed" {
		return MemberDTO{}, apperrors.BadRequest("VALIDATION_ERROR", "Trạng thái thành viên kênh không hợp lệ.")
	}
	member, err := s.repo.UpdateMemberStatus(ctx, UpdateMemberStatusParams{
		WorkspaceID: strings.TrimSpace(input.WorkspaceID),
		ChannelID:   strings.TrimSpace(input.ChannelID),
		UserID:      strings.TrimSpace(input.UserID),
		Status:      status,
	})
	if err != nil {
		return MemberDTO{}, mapMemberError(err)
	}
	return toMemberDTO(member), nil
}

func (s *Service) UpdateReadState(ctx context.Context, input UpdateReadStateInput) (MemberDTO, error) {
	if err := s.ensureWorkspaceAccess(ctx, input.ActorUserID, input.WorkspaceID); err != nil {
		return MemberDTO{}, err
	}
	member, err := s.repo.UpdateReadState(ctx, UpdateReadStateParams{
		WorkspaceID:       strings.TrimSpace(input.WorkspaceID),
		ChannelID:         strings.TrimSpace(input.ChannelID),
		UserID:            strings.TrimSpace(input.ActorUserID),
		LastReadMessageID: strings.TrimSpace(input.LastReadMessageID),
	})
	if err != nil {
		return MemberDTO{}, mapMemberError(err)
	}
	return toMemberDTO(member), nil
}

func (s *Service) CreateDirect(ctx context.Context, input CreateDirectInput) (DirectConversationDTO, error) {
	if err := s.ensurePermission(ctx, input.ActorUserID, input.WorkspaceID, "message.send"); err != nil {
		return DirectConversationDTO{}, err
	}
	participantIDs := normalizeParticipants(input.ActorUserID, input.ParticipantIDs)
	if len(participantIDs) < 2 {
		return DirectConversationDTO{}, apperrors.BadRequest("VALIDATION_ERROR", "Direct message cần ít nhất 2 thành viên.")
	}
	conversationType := "group"
	if len(participantIDs) == 2 {
		conversationType = "one_to_one"
	}
	conversation, err := s.repo.CreateOrGetDirectConversation(ctx, CreateDirectParams{
		WorkspaceID:      strings.TrimSpace(input.WorkspaceID),
		ParticipantKey:   strings.Join(participantIDs, ":"),
		ParticipantIDs:   participantIDs,
		ConversationType: conversationType,
		CreatedBy:        strings.TrimSpace(input.ActorUserID),
	})
	if err != nil {
		if errors.Is(err, channelsdomain.ErrMemberNotFound) {
			return DirectConversationDTO{}, apperrors.BadRequest("INVALID_PARTICIPANTS", "Một hoặc nhiều thành viên chưa thuộc workspace.")
		}
		return DirectConversationDTO{}, err
	}
	return toDirectDTO(conversation), nil
}

func (s *Service) ListDirects(ctx context.Context, actorUserID string, workspaceID string) ([]DirectConversationDTO, error) {
	if err := s.ensureWorkspaceAccess(ctx, actorUserID, workspaceID); err != nil {
		return nil, err
	}
	conversations, err := s.repo.ListDirectConversations(ctx, strings.TrimSpace(workspaceID), strings.TrimSpace(actorUserID))
	if err != nil {
		return nil, err
	}
	dtos := make([]DirectConversationDTO, 0, len(conversations))
	for _, conversation := range conversations {
		dtos = append(dtos, toDirectDTO(conversation))
	}
	return dtos, nil
}

func (s *Service) ensureWorkspaceAccess(ctx context.Context, userID string, workspaceID string) error {
	allowed, err := s.checker.HasWorkspacePermission(ctx, strings.TrimSpace(userID), strings.TrimSpace(workspaceID), "message.send")
	if err != nil {
		return err
	}
	if !allowed {
		return apperrors.Forbidden("Bạn không thuộc workspace này.")
	}
	return nil
}

func (s *Service) ensurePermission(ctx context.Context, userID string, workspaceID string, permission string) error {
	allowed, err := s.checker.HasWorkspacePermission(ctx, strings.TrimSpace(userID), strings.TrimSpace(workspaceID), permission)
	if err != nil {
		return err
	}
	if !allowed {
		return apperrors.Forbidden("Bạn không có quyền thực hiện thao tác này.")
	}
	return nil
}

func normalizeParticipants(actorUserID string, ids []string) []string {
	seen := map[string]bool{}
	result := make([]string, 0, len(ids)+1)
	for _, id := range append(ids, actorUserID) {
		id = strings.TrimSpace(id)
		if id == "" || seen[id] {
			continue
		}
		seen[id] = true
		result = append(result, id)
	}
	sort.Strings(result)
	return result
}

func cleanOptional(value *string) *string {
	if value == nil {
		return nil
	}
	cleaned := strings.TrimSpace(*value)
	return &cleaned
}

func mapChannelError(err error) error {
	if errors.Is(err, channelsdomain.ErrChannelNotFound) {
		return apperrors.NotFound("CHANNEL_NOT_FOUND", "Không tìm thấy kênh.")
	}
	return err
}

func mapMemberError(err error) error {
	if errors.Is(err, channelsdomain.ErrMemberNotFound) {
		return apperrors.NotFound("CHANNEL_MEMBER_NOT_FOUND", "Không tìm thấy thành viên kênh.")
	}
	return err
}

func toChannelDTO(channel channelsdomain.Channel) ChannelDTO {
	return ChannelDTO{
		ID:           channel.ID,
		WorkspaceID:  channel.WorkspaceID,
		DepartmentID: channel.DepartmentID,
		Slug:         channel.Slug,
		Name:         channel.Name,
		Description:  channel.Description,
		Type:         channel.Type,
		Status:       channel.Status,
		CreatedBy:    channel.CreatedBy,
		CreatedAt:    formatTime(channel.CreatedAt),
		UpdatedAt:    formatTime(channel.UpdatedAt),
		ArchivedAt:   formatOptionalTime(channel.ArchivedAt),
	}
}

func toMemberDTOs(members []channelsdomain.Member) []MemberDTO {
	dtos := make([]MemberDTO, 0, len(members))
	for _, member := range members {
		dtos = append(dtos, toMemberDTO(member))
	}
	return dtos
}

func toMemberDTO(member channelsdomain.Member) MemberDTO {
	return MemberDTO{
		ChannelID:         member.ChannelID,
		UserID:            member.UserID,
		Email:             member.Email,
		Username:          member.Username,
		DisplayName:       member.DisplayName,
		Status:            member.Status,
		LastReadAt:        formatOptionalTime(member.LastReadAt),
		LastReadMessageID: member.LastReadMessageID,
		JoinedAt:          formatTime(member.JoinedAt),
		CreatedAt:         formatTime(member.CreatedAt),
		UpdatedAt:         formatTime(member.UpdatedAt),
	}
}

func toDirectDTO(conversation channelsdomain.DirectConversation) DirectConversationDTO {
	return DirectConversationDTO{
		ID:               conversation.ID,
		WorkspaceID:      conversation.WorkspaceID,
		ChannelID:        conversation.ChannelID,
		ParticipantKey:   conversation.ParticipantKey,
		ConversationType: conversation.ConversationType,
		ParticipantIDs:   conversation.ParticipantIDs,
		CreatedAt:        formatTime(conversation.CreatedAt),
		UpdatedAt:        formatTime(conversation.UpdatedAt),
	}
}

func formatOptionalTime(value *time.Time) *string {
	if value == nil {
		return nil
	}
	formatted := formatTime(*value)
	return &formatted
}

func formatTime(value time.Time) string {
	return value.UTC().Format(time.RFC3339)
}

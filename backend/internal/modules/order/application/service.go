package application

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/duclamdev/application-chat/backend/internal/shared/botauto"
	apperrors "github.com/duclamdev/application-chat/backend/internal/shared/errors"
)

var (
	ErrOrderBotTargetNotFound = errors.New("order bot target not found")
	ErrOrderChannelNotFound   = errors.New("order bot channel not found")
)

const (
	PermissionOrderView    = "order.view"
	PermissionOrderBilling = "order.billing"

	defaultSupportBotSlug = "cskh-bot"
	defaultTicketBotSlug  = "ticket-bot"
	defaultPaymentBotSlug = "thanh-toan-bot"
	defaultRenewalBotSlug = "gia-han-bot"
	defaultAlertBotSlug   = "server-alert-bot"

	defaultSupportChannelSlug = "ticket"
	defaultPaymentChannelSlug = "ke-toan"
	defaultRenewalChannelSlug = "gia-han"
	defaultAlertChannelSlug   = "server-alert"
)

var (
	uuidPattern        = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)
	emailPattern       = regexp.MustCompile(`(?i)[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}`)
	labeledIntPattern  = regexp.MustCompile(`(?i)(user[_\s-]*id|uid|id|số ngày|so ngay|days?|ngày|ngay|số tiền|so tien|amount)\s*[:=]\s*([0-9][0-9\.\,\s]*[kKmM]?)`)
	plainDaysPattern   = regexp.MustCompile(`(?i)\b([0-9]{1,3})\s*(ngày|ngay|days?)\b`)
	amountHintPattern  = regexp.MustCompile(`(?i)(nạp|nap|qr|thanh toán|thanh toan|số tiền|so tien|amount|ck|chuyển khoản|chuyen khoan)`)
	serviceTypePattern = regexp.MustCompile(`(?i)(loại dịch vụ|loai dich vu|service[_\s-]*type|dịch vụ|dich vu)\s*[:=]\s*([^\n\r]+)`)
)

type PermissionChecker interface {
	HasWorkspacePermission(ctx context.Context, userID string, workspaceID string, permissionCode string) (bool, error)
}

type Client interface {
	Configured() bool
	WalletBalance(ctx context.Context, input UserLookupRequest) (WalletBalanceEnvelope, error)
	CreateDepositQR(ctx context.Context, input WalletDepositQRRequest) (WalletDepositQREnvelope, error)
	ServicesExpiring(ctx context.Context, input ServicesExpiringRequest) (ServicesExpiringEnvelope, error)
}

type Repository interface {
	ChannelByID(ctx context.Context, workspaceID string, channelID string) (ChannelDTO, error)
	SendBotMessage(ctx context.Context, params SendBotMessageParams) (BotMessageDTO, error)
}

type Service struct {
	client  Client
	repo    Repository
	checker PermissionChecker
	now     func() time.Time
}

type UserLookupRequest struct {
	Email  string `json:"email,omitempty"`
	UserID int    `json:"user_id,omitempty"`
}

type WalletBalanceInput struct {
	ActorUserID   string
	WorkspaceID   string
	Email         string `json:"email,omitempty"`
	UserID        int    `json:"user_id,omitempty"`
	ChannelID     string `json:"channel_id,omitempty"`
	PostToChannel *bool  `json:"post_to_channel,omitempty"`
}

type WalletDepositQRInput struct {
	ActorUserID    string
	WorkspaceID    string
	Email          string `json:"email,omitempty"`
	Amount         int    `json:"amount,omitempty"`
	ExpiresMinutes int    `json:"expires_minutes,omitempty"`
	ChannelID      string `json:"channel_id,omitempty"`
	PostToChannel  *bool  `json:"post_to_channel,omitempty"`
}

type ServicesExpiringInput struct {
	ActorUserID    string
	WorkspaceID    string
	Email          string `json:"email,omitempty"`
	UserID         int    `json:"user_id,omitempty"`
	Days           int    `json:"days,omitempty"`
	IncludeExpired bool   `json:"include_expired,omitempty"`
	ServiceType    string `json:"service_type,omitempty"`
	ChannelID      string `json:"channel_id,omitempty"`
	PostToChannel  *bool  `json:"post_to_channel,omitempty"`
}

type WalletDepositQRRequest struct {
	Email          string `json:"email"`
	Amount         int    `json:"amount"`
	ExpiresMinutes int    `json:"expires_minutes,omitempty"`
}

type ServicesExpiringRequest struct {
	Email          string `json:"email,omitempty"`
	UserID         int    `json:"user_id,omitempty"`
	Days           int    `json:"days,omitempty"`
	IncludeExpired bool   `json:"include_expired"`
	ServiceType    string `json:"service_type,omitempty"`
}

type SendBotMessageParams struct {
	WorkspaceID string
	BotSlug     string
	ChannelID   string
	ChannelSlug string
	Body        string
	Metadata    []byte
}

type ChannelDTO struct {
	ID          string
	WorkspaceID string
	Slug        string
	Name        string
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

type StatusDTO struct {
	Configured bool   `json:"configured"`
	BaseURL    string `json:"base_url,omitempty"`
}

type WalletBalanceResult struct {
	Data       WalletBalanceData `json:"data"`
	BotMessage *BotMessageDTO    `json:"bot_message,omitempty"`
}

type WalletDepositQRResult struct {
	Data       WalletDepositQRData `json:"data"`
	BotMessage *BotMessageDTO      `json:"bot_message,omitempty"`
}

type ServicesExpiringResult struct {
	Data       ServicesExpiringData `json:"data"`
	BotMessage *BotMessageDTO       `json:"bot_message,omitempty"`
}

type WalletBalanceEnvelope struct {
	OK      bool              `json:"ok"`
	Status  string            `json:"status,omitempty"`
	Message string            `json:"message,omitempty"`
	Data    WalletBalanceData `json:"data"`
}

type WalletBalanceData struct {
	UserID     int            `json:"user_id,omitempty"`
	Email      string         `json:"email,omitempty"`
	Name       string         `json:"name,omitempty"`
	Balance    float64        `json:"balance,omitempty"`
	BalanceVND int            `json:"balance_vnd,omitempty"`
	Money      float64        `json:"money,omitempty"`
	Agency     string         `json:"agency,omitempty"`
	Services   map[string]int `json:"services,omitempty"`
}

type WalletDepositQREnvelope struct {
	OK      bool                `json:"ok"`
	Status  string              `json:"status,omitempty"`
	Message string              `json:"message,omitempty"`
	Data    WalletDepositQRData `json:"data"`
}

type WalletDepositQRData struct {
	RequestID         int               `json:"request_id,omitempty"`
	Reference         string            `json:"reference,omitempty"`
	Email             string            `json:"email,omitempty"`
	UserID            int               `json:"user_id,omitempty"`
	Name              string            `json:"name,omitempty"`
	Amount            int               `json:"amount,omitempty"`
	Currency          string            `json:"currency,omitempty"`
	Status            string            `json:"status,omitempty"`
	QRURL             string            `json:"qr_url,omitempty"`
	Bank              WalletDepositBank `json:"bank,omitempty"`
	TransferContent   string            `json:"transfer_content,omitempty"`
	UserBalanceBefore float64           `json:"user_balance_before,omitempty"`
	ExpiresAt         string            `json:"expires_at,omitempty"`
}

type WalletDepositBank struct {
	BankCode         string `json:"bank_code,omitempty"`
	BIN              string `json:"bin,omitempty"`
	AccountNumber    string `json:"account_number,omitempty"`
	AccountName      string `json:"account_name,omitempty"`
	TransferContent  string `json:"transfer_content,omitempty"`
	RequestedAmount  int    `json:"requested_amount,omitempty"`
	AutoCheck        bool   `json:"auto_check,omitempty"`
}

type ServicesExpiringEnvelope struct {
	OK      bool                 `json:"ok"`
	Status  string               `json:"status,omitempty"`
	Message string               `json:"message,omitempty"`
	Data    ServicesExpiringData `json:"data"`
}

type ServicesExpiringData struct {
	User           ExpiringUserSummary       `json:"user,omitempty"`
	Days           int                       `json:"days,omitempty"`
	IncludeExpired bool                      `json:"include_expired,omitempty"`
	ServiceType    string                    `json:"service_type,omitempty"`
	Summary        ServicesExpiringSummary   `json:"summary,omitempty"`
	Items          []ServiceExpiringItem     `json:"items,omitempty"`
}

type ExpiringUserSummary struct {
	UserID  int     `json:"user_id,omitempty"`
	Email   string  `json:"email,omitempty"`
	Name    string  `json:"name,omitempty"`
	Balance float64 `json:"balance,omitempty"`
}

type ServicesExpiringSummary struct {
	Total        int            `json:"total,omitempty"`
	Expired      int            `json:"expired,omitempty"`
	Expiring     int            `json:"expiring,omitempty"`
	AutoRenewOff int            `json:"auto_renew_off,omitempty"`
	ByType       map[string]int `json:"by_type,omitempty"`
}

type ServiceExpiringItem struct {
	ServiceTypeKey         string `json:"service_type_key,omitempty"`
	ServiceType            string `json:"service_type,omitempty"`
	ServiceID              int    `json:"service_id,omitempty"`
	Name                   string `json:"name,omitempty"`
	Meta                   string `json:"meta,omitempty"`
	Status                 string `json:"status,omitempty"`
	StatusLabel            string `json:"status_label,omitempty"`
	ExpiresAt              string `json:"expires_at,omitempty"`
	DaysRemaining          int    `json:"days_remaining,omitempty"`
	AutoExtend             *int   `json:"autoextend,omitempty"`
	Route                  string `json:"route,omitempty"`
	RenewalTransferContent string `json:"renewal_transfer_content,omitempty"`
}

func NewService(client Client, repo Repository, checker PermissionChecker) *Service {
	return &Service{
		client:  client,
		repo:    repo,
		checker: checker,
		now:     func() time.Time { return time.Now().UTC() },
	}
}

func (s *Service) Status(ctx context.Context, actorUserID string, workspaceID string) (StatusDTO, error) {
	if err := s.ensurePermission(ctx, actorUserID, workspaceID, PermissionOrderView); err != nil {
		return StatusDTO{}, err
	}
	return StatusDTO{Configured: s.client != nil && s.client.Configured()}, nil
}

func (s *Service) HandleMessage(ctx context.Context, input botauto.MessageInput) ([]botauto.BotMessage, error) {
	workspaceID := strings.TrimSpace(input.WorkspaceID)
	channelID := strings.TrimSpace(input.ChannelID)
	body := strings.TrimSpace(input.Body)
	if s == nil {
		slog.Warn("Order bot auto responder chua duoc khoi tao",
			"workspace_id", workspaceID,
			"channel_id", channelID,
			"message_id", input.MessageID,
		)
		return nil, nil
	}
	if s.repo == nil {
		slog.Warn("Order bot repository chua duoc cau hinh",
			"workspace_id", workspaceID,
			"channel_id", channelID,
			"message_id", input.MessageID,
		)
		return nil, nil
	}
	if body == "" {
		slog.Debug("Order bot bo qua tin nhan rong",
			"workspace_id", workspaceID,
			"channel_id", channelID,
			"message_id", input.MessageID,
		)
		return nil, nil
	}
	slog.Debug("Order bot nhan tin hieu auto responder",
		"workspace_id", workspaceID,
		"channel_id", channelID,
		"message_id", input.MessageID,
		"body_len", len([]rune(body)),
	)
	channel, err := s.repo.ChannelByID(ctx, workspaceID, channelID)
	if err != nil {
		slog.Warn("Order bot khong lay duoc thong tin kenh",
			"workspace_id", workspaceID,
			"channel_id", channelID,
			"message_id", input.MessageID,
			"error", err,
		)
		return nil, nil
	}

	command := parseAutoBotCommand(input.Body)
	channelSlug := strings.TrimSpace(channel.Slug)
	fields := append([]any{
		"workspace_id", workspaceID,
		"channel_id", channelID,
		"channel_slug", channelSlug,
		"message_id", input.MessageID,
	}, autoBotCommandLogFields(command)...)
	slog.Info("Order bot kiem tra kenh va intent", fields...)
	switch channelSlug {
	case defaultRenewalChannelSlug:
		return s.handleRenewalAutoMessage(ctx, input, command)
	case defaultPaymentChannelSlug:
		return s.handlePaymentAutoMessage(ctx, input, command)
	case defaultSupportChannelSlug:
		return s.handleTicketAutoMessage(ctx, input, command)
	case defaultAlertChannelSlug:
		return s.handleAlertAutoMessage(ctx, input, command)
	default:
		slog.Debug("Order bot bo qua kenh khong thuoc bot order",
			"workspace_id", workspaceID,
			"channel_id", channelID,
			"channel_slug", channelSlug,
			"message_id", input.MessageID,
		)
		return nil, nil
	}
}

func (s *Service) handleRenewalAutoMessage(ctx context.Context, input botauto.MessageInput, command autoBotCommand) ([]botauto.BotMessage, error) {
	if command.IsHelp || !command.HasLookup {
		fields := append([]any{
			"workspace_id", input.WorkspaceID,
			"channel_id", input.ChannelID,
			"message_id", input.MessageID,
		}, autoBotCommandLogFields(command)...)
		slog.Info("Gia Han Bot gui huong dan vi thieu lookup hoac nguoi dung hoi help", fields...)
		return s.postAutoGuide(ctx, input, defaultRenewalBotSlug, defaultRenewalChannelSlug, "auto_help_gia_han", renewalBotGuide())
	}
	fields := append([]any{
		"workspace_id", input.WorkspaceID,
		"channel_id", input.ChannelID,
		"message_id", input.MessageID,
	}, autoBotCommandLogFields(command)...)
	slog.Info("Gia Han Bot bat dau tra cuu dich vu sap het han", fields...)
	result, err := s.ServicesExpiring(ctx, ServicesExpiringInput{
		ActorUserID:    input.ActorUserID,
		WorkspaceID:    input.WorkspaceID,
		Email:          command.Email,
		UserID:         command.UserID,
		Days:           command.Days,
		IncludeExpired: command.IncludeExpired,
		ServiceType:    command.ServiceType,
		ChannelID:      input.ChannelID,
	})
	if err != nil {
		return s.postAutoError(ctx, input, defaultRenewalBotSlug, defaultRenewalChannelSlug, "Gia Hạn Bot", err, renewalBotGuide())
	}
	return autoBotMessages(result.BotMessage), nil
}

func (s *Service) handlePaymentAutoMessage(ctx context.Context, input botauto.MessageInput, command autoBotCommand) ([]botauto.BotMessage, error) {
	if command.IsHelp {
		return s.postAutoGuide(ctx, input, defaultPaymentBotSlug, defaultPaymentChannelSlug, "auto_help_payment", paymentBotGuide())
	}
	if !command.PaymentIntent && !command.HasAmount {
		return nil, nil
	}
	if command.Email == "" || command.Amount < 1000 {
		return s.postAutoGuide(ctx, input, defaultPaymentBotSlug, defaultPaymentChannelSlug, "auto_help_payment", paymentBotGuide())
	}
	result, err := s.CreateDepositQR(ctx, WalletDepositQRInput{
		ActorUserID:    input.ActorUserID,
		WorkspaceID:    input.WorkspaceID,
		Email:          command.Email,
		Amount:         command.Amount,
		ExpiresMinutes: command.ExpiresMinutes,
		ChannelID:      input.ChannelID,
	})
	if err != nil {
		return s.postAutoError(ctx, input, defaultPaymentBotSlug, defaultPaymentChannelSlug, "Thanh Toán Bot", err, paymentBotGuide())
	}
	return autoBotMessages(result.BotMessage), nil
}

func (s *Service) handleTicketAutoMessage(ctx context.Context, input botauto.MessageInput, command autoBotCommand) ([]botauto.BotMessage, error) {
	if command.IsHelp {
		return s.postAutoGuide(ctx, input, defaultTicketBotSlug, defaultSupportChannelSlug, "auto_help_ticket", ticketBotGuide())
	}
	if command.HasLookup && command.WalletIntent {
		result, err := s.WalletBalance(ctx, WalletBalanceInput{
			ActorUserID: input.ActorUserID,
			WorkspaceID: input.WorkspaceID,
			Email:       command.Email,
			UserID:      command.UserID,
			ChannelID:   input.ChannelID,
		})
		if err != nil {
			return s.postAutoError(ctx, input, defaultSupportBotSlug, defaultSupportChannelSlug, "CSKH Bot", err, ticketBotGuide())
		}
		return autoBotMessages(result.BotMessage), nil
	}
	if command.TicketIntent {
		return s.postAutoText(ctx, input, defaultTicketBotSlug, defaultSupportChannelSlug, formatTicketTriageMessage(input.Body, command), map[string]any{
			"source":             "vpsttt_order",
			"action":             "ticket_triage",
			"trigger_message_id": input.MessageID,
			"email":              command.Email,
			"user_id":            command.UserID,
		})
	}
	return nil, nil
}

func (s *Service) handleAlertAutoMessage(ctx context.Context, input botauto.MessageInput, command autoBotCommand) ([]botauto.BotMessage, error) {
	if command.IsHelp {
		return s.postAutoGuide(ctx, input, defaultAlertBotSlug, defaultAlertChannelSlug, "auto_help_alert", alertBotGuide())
	}
	if !command.AlertIntent {
		return nil, nil
	}
	return s.postAutoText(ctx, input, defaultAlertBotSlug, defaultAlertChannelSlug, formatServerAlertMessage(input.Body), map[string]any{
		"source":             "vpsttt_order",
		"action":             "server_alert_triage",
		"trigger_message_id": input.MessageID,
	})
}

func (s *Service) WalletBalance(ctx context.Context, input WalletBalanceInput) (WalletBalanceResult, error) {
	if err := s.ensurePermission(ctx, input.ActorUserID, input.WorkspaceID, PermissionOrderView); err != nil {
		return WalletBalanceResult{}, err
	}
	if err := s.ensureConfigured(); err != nil {
		return WalletBalanceResult{}, err
	}
	lookup, err := normalizeLookup(input.Email, input.UserID)
	if err != nil {
		return WalletBalanceResult{}, err
	}
	if err := validateOptionalChannelID(input.ChannelID); err != nil {
		return WalletBalanceResult{}, err
	}
	envelope, err := s.client.WalletBalance(ctx, lookup)
	if err != nil {
		return WalletBalanceResult{}, err
	}
	if err := ensureRemoteOK(envelope.OK, envelope.Status, envelope.Message); err != nil {
		return WalletBalanceResult{}, err
	}

	result := WalletBalanceResult{Data: envelope.Data}
	if shouldPost(input.PostToChannel) {
		message, err := s.postBotMessage(ctx, input.WorkspaceID, defaultSupportBotSlug, input.ChannelID, defaultSupportChannelSlug, formatWalletBalanceMessage(envelope.Data), map[string]any{
			"source":  "vpsttt_order",
			"action":  "wallet_balance",
			"email":   lookup.Email,
			"user_id": lookup.UserID,
		})
		if err != nil {
			return WalletBalanceResult{}, err
		}
		result.BotMessage = &message
	}
	return result, nil
}

func (s *Service) CreateDepositQR(ctx context.Context, input WalletDepositQRInput) (WalletDepositQRResult, error) {
	if err := s.ensurePermission(ctx, input.ActorUserID, input.WorkspaceID, PermissionOrderBilling); err != nil {
		return WalletDepositQRResult{}, err
	}
	if err := s.ensureConfigured(); err != nil {
		return WalletDepositQRResult{}, err
	}
	email := normalizeEmail(input.Email)
	if email == "" {
		return WalletDepositQRResult{}, apperrors.BadRequest("VALIDATION_ERROR", "Email khách hàng là bắt buộc.")
	}
	if input.Amount < 1000 {
		return WalletDepositQRResult{}, apperrors.BadRequest("VALIDATION_ERROR", "Số tiền nạp ví tối thiểu là 1.000 VND.")
	}
	expiresMinutes := input.ExpiresMinutes
	if expiresMinutes == 0 {
		expiresMinutes = 1440
	}
	if expiresMinutes < 5 || expiresMinutes > 43200 {
		return WalletDepositQRResult{}, apperrors.BadRequest("VALIDATION_ERROR", "Thời hạn QR phải từ 5 đến 43.200 phút.")
	}
	if err := validateOptionalChannelID(input.ChannelID); err != nil {
		return WalletDepositQRResult{}, err
	}

	envelope, err := s.client.CreateDepositQR(ctx, WalletDepositQRRequest{
		Email:          email,
		Amount:         input.Amount,
		ExpiresMinutes: expiresMinutes,
	})
	if err != nil {
		return WalletDepositQRResult{}, err
	}
	if err := ensureRemoteOK(envelope.OK, envelope.Status, envelope.Message); err != nil {
		return WalletDepositQRResult{}, err
	}

	result := WalletDepositQRResult{Data: envelope.Data}
	if shouldPost(input.PostToChannel) {
		message, err := s.postBotMessage(ctx, input.WorkspaceID, defaultPaymentBotSlug, input.ChannelID, defaultPaymentChannelSlug, formatDepositQRMessage(envelope.Data), map[string]any{
			"source":    "vpsttt_order",
			"action":    "wallet_deposit_qr",
			"email":     email,
			"amount":    input.Amount,
			"reference": envelope.Data.Reference,
		})
		if err != nil {
			return WalletDepositQRResult{}, err
		}
		result.BotMessage = &message
	}
	return result, nil
}

func (s *Service) ServicesExpiring(ctx context.Context, input ServicesExpiringInput) (ServicesExpiringResult, error) {
	if err := s.ensurePermission(ctx, input.ActorUserID, input.WorkspaceID, PermissionOrderView); err != nil {
		return ServicesExpiringResult{}, err
	}
	if err := s.ensureConfigured(); err != nil {
		return ServicesExpiringResult{}, err
	}
	lookup, err := normalizeLookup(input.Email, input.UserID)
	if err != nil {
		return ServicesExpiringResult{}, err
	}
	days := input.Days
	if days == 0 {
		days = 7
	}
	if days < 0 || days > 365 {
		return ServicesExpiringResult{}, apperrors.BadRequest("VALIDATION_ERROR", "Số ngày lọc dịch vụ phải từ 0 đến 365.")
	}
	serviceType := normalizeServiceType(input.ServiceType)
	if strings.TrimSpace(input.ServiceType) != "" && serviceType == "" {
		return ServicesExpiringResult{}, apperrors.BadRequest("VALIDATION_ERROR", "Loại dịch vụ không hợp lệ.")
	}
	if serviceType == "" {
		serviceType = "all"
	}
	if err := validateOptionalChannelID(input.ChannelID); err != nil {
		return ServicesExpiringResult{}, err
	}

	envelope, err := s.client.ServicesExpiring(ctx, ServicesExpiringRequest{
		Email:          lookup.Email,
		UserID:         lookup.UserID,
		Days:           days,
		IncludeExpired: input.IncludeExpired,
		ServiceType:    serviceType,
	})
	if err != nil {
		return ServicesExpiringResult{}, err
	}
	if err := ensureRemoteOK(envelope.OK, envelope.Status, envelope.Message); err != nil {
		return ServicesExpiringResult{}, err
	}

	result := ServicesExpiringResult{Data: envelope.Data}
	if shouldPost(input.PostToChannel) {
		message, err := s.postBotMessage(ctx, input.WorkspaceID, defaultRenewalBotSlug, input.ChannelID, defaultRenewalChannelSlug, formatExpiringServicesMessage(envelope.Data), map[string]any{
			"source":       "vpsttt_order",
			"action":       "services_expiring",
			"email":        lookup.Email,
			"user_id":      lookup.UserID,
			"days":         days,
			"service_type": serviceType,
		})
		if err != nil {
			return ServicesExpiringResult{}, err
		}
		result.BotMessage = &message
	}
	return result, nil
}

type autoBotCommand struct {
	Email          string
	UserID         int
	Days           int
	IncludeExpired bool
	ServiceType    string
	Amount         int
	ExpiresMinutes int
	IsHelp         bool
	HasLookup      bool
	HasAmount      bool
	WalletIntent   bool
	PaymentIntent  bool
	TicketIntent   bool
	AlertIntent    bool
}

func parseAutoBotCommand(body string) autoBotCommand {
	body = strings.TrimSpace(body)
	lower := strings.ToLower(body)
	plain := normalizeText(lower)
	command := autoBotCommand{
		Email:          strings.ToLower(emailPattern.FindString(body)),
		Days:           7,
		ServiceType:    "all",
		ExpiresMinutes: 1440,
		IsHelp:         containsAny(plain, "help", "huong dan", "cach dung", "/bot", "/help"),
		IncludeExpired: containsAny(plain, "include_expired true", "include expired true", "gom het han", "bao gom het han", "ca het han"),
		WalletIntent:   containsAny(plain, "tra vi", "so du", "wallet", "balance", "kiem tra vi"),
		PaymentIntent:  amountHintPattern.MatchString(lower) || containsAny(plain, "nap vi", "tao qr", "thanh toan", "chuyen khoan", "qr"),
		TicketIntent:   containsAny(plain, "ticket", "ho tro", "khach", "loi", "khong truy cap", "khong vao duoc", "vps", "hosting", "domain", "proxy"),
		AlertIntent:    containsAny(plain, "alert", "canh bao", "server", "down", "mat ping", "ping", "port", "cpu", "ram", "disk", "service", "timeout", "critical"),
	}

	for _, match := range labeledIntPattern.FindAllStringSubmatch(body, -1) {
		if len(match) != 3 {
			continue
		}
		label := normalizeText(match[1])
		value := parseHumanInt(match[2])
		if value <= 0 {
			continue
		}
		switch {
		case containsAny(label, "user", "uid") || label == "id":
			command.UserID = value
		case containsAny(label, "ngay", "day"):
			command.Days = value
		case containsAny(label, "tien", "amount"):
			command.Amount = value
			command.HasAmount = true
		}
	}

	if command.Days == 7 {
		if match := plainDaysPattern.FindStringSubmatch(body); len(match) == 3 {
			if value := parseHumanInt(match[1]); value >= 0 {
				command.Days = value
			}
		}
	}
	if match := serviceTypePattern.FindStringSubmatch(body); len(match) == 3 {
		if value := normalizeServiceTypeAlias(match[2]); value != "" {
			command.ServiceType = value
		}
	}
	if command.Amount == 0 && command.PaymentIntent {
		command.Amount = firstMoneyValue(body)
		command.HasAmount = command.Amount > 0
	}
	command.HasLookup = command.Email != "" || command.UserID > 0
	return command
}

func autoBotCommandLogFields(command autoBotCommand) []any {
	return []any{
		"email", maskLogEmail(command.Email),
		"user_id", command.UserID,
		"days", command.Days,
		"service_type", command.ServiceType,
		"amount", command.Amount,
		"has_lookup", command.HasLookup,
		"has_amount", command.HasAmount,
		"is_help", command.IsHelp,
		"wallet_intent", command.WalletIntent,
		"payment_intent", command.PaymentIntent,
		"ticket_intent", command.TicketIntent,
		"alert_intent", command.AlertIntent,
	}
}

func maskLogEmail(email string) string {
	email = strings.TrimSpace(strings.ToLower(email))
	if email == "" {
		return ""
	}
	parts := strings.SplitN(email, "@", 2)
	if len(parts) != 2 {
		return "***"
	}
	local := []rune(parts[0])
	if len(local) <= 2 {
		return "**@" + parts[1]
	}
	return string(local[:2]) + "***@" + parts[1]
}

func (s *Service) postAutoGuide(ctx context.Context, input botauto.MessageInput, botSlug string, channelSlug string, action string, body string) ([]botauto.BotMessage, error) {
	return s.postAutoText(ctx, input, botSlug, channelSlug, body, map[string]any{
		"source":             "vpsttt_order",
		"action":             action,
		"trigger_message_id": input.MessageID,
	})
}

func (s *Service) postAutoError(ctx context.Context, input botauto.MessageInput, botSlug string, channelSlug string, botName string, err error, guide string) ([]botauto.BotMessage, error) {
	slog.Warn("Order bot tao phan hoi loi",
		"workspace_id", input.WorkspaceID,
		"channel_id", input.ChannelID,
		"message_id", input.MessageID,
		"bot_slug", botSlug,
		"target_channel_slug", channelSlug,
		"bot_name", botName,
		"error", err,
	)
	body := "[" + botName + "] Mình chưa xử lý được yêu cầu này.\n"
	body += "Lý do: " + strings.TrimSpace(err.Error()) + "\n\n"
	body += guide
	return s.postAutoText(ctx, input, botSlug, channelSlug, body, map[string]any{
		"source":             "vpsttt_order",
		"action":             "auto_error",
		"trigger_message_id": input.MessageID,
	})
}

func (s *Service) postAutoText(ctx context.Context, input botauto.MessageInput, botSlug string, channelSlug string, body string, metadata map[string]any) ([]botauto.BotMessage, error) {
	action := any(nil)
	if metadata != nil {
		action = metadata["action"]
	}
	slog.Info("Order bot chuan bi gui phan hoi",
		"workspace_id", input.WorkspaceID,
		"channel_id", input.ChannelID,
		"message_id", input.MessageID,
		"bot_slug", botSlug,
		"target_channel_slug", channelSlug,
		"body_len", len([]rune(body)),
		"action", action,
	)
	message, err := s.postBotMessage(ctx, input.WorkspaceID, botSlug, input.ChannelID, channelSlug, body, metadata)
	if err != nil {
		slog.Warn("Order bot gui phan hoi that bai",
			"workspace_id", input.WorkspaceID,
			"channel_id", input.ChannelID,
			"message_id", input.MessageID,
			"bot_slug", botSlug,
			"target_channel_slug", channelSlug,
			"error", err,
		)
		return nil, err
	}
	return autoBotMessages(&message), nil
}

func autoBotMessages(message *BotMessageDTO) []botauto.BotMessage {
	if message == nil {
		return nil
	}
	return []botauto.BotMessage{{
		ID:          message.ID,
		WorkspaceID: message.WorkspaceID,
		ChannelID:   message.ChannelID,
		BotID:       message.BotID,
		Kind:        message.Kind,
		Body:        message.Body,
		Metadata:    message.Metadata,
		CreatedAt:   message.CreatedAt,
	}}
}

func renewalBotGuide() string {
	return strings.TrimSpace(`[Gia Hạn Bot] Mình tự động kiểm tra dịch vụ sắp hết hạn khi bạn gửi theo mẫu:
Email: khach@example.com
Số ngày: 7
Loại dịch vụ: Tất cả

Loại dịch vụ hỗ trợ: Tất cả, VPS, Proxy, Hosting, S3, Drive, WAF, Domain, Separate.`)
}

func paymentBotGuide() string {
	return strings.TrimSpace(`[Thanh Toán Bot] Mình tự động tạo QR nạp ví khi bạn gửi theo mẫu:
Email: khach@example.com
Số tiền: 200000

Số tiền tối thiểu là 1.000 VND. QR mặc định hết hạn sau 24 giờ.`)
}

func ticketBotGuide() string {
	return strings.TrimSpace(`[Ticket Bot] Mình tự động phân loại ticket khi bạn gửi nội dung lỗi của khách.

Ví dụ:
Khách: Nguyễn Văn A
Email: khach@example.com
Lỗi: VPS không truy cập được SSH

Nếu muốn tra ví khách hàng, gửi: Tra ví email@example.com`)
}

func alertBotGuide() string {
	return strings.TrimSpace(`[Server Alert Bot] Mình tự động phân tích cảnh báo vận hành.

Ví dụ:
Server: vps-01
Lỗi: mất ping 3 phút
Port: 22 timeout
Mức độ: critical`)
}

func formatTicketTriageMessage(body string, command autoBotCommand) string {
	priority := "P3 - Bình thường"
	if containsAny(normalizeText(body), "down", "mat ping", "khong truy cap", "khong vao duoc", "critical", "khach vip", "mat du lieu") {
		priority = "P1 - Cần xử lý ngay"
	} else if containsAny(normalizeText(body), "loi", "timeout", "cham", "khong gui duoc", "khong nhan duoc") {
		priority = "P2 - Ưu tiên cao"
	}
	customer := firstNonEmpty(command.Email, "chưa rõ")
	return strings.TrimSpace(fmt.Sprintf(`[Ticket Bot] Đã tự phân loại yêu cầu hỗ trợ
Khách: %s
Mức ưu tiên: %s
Tóm tắt: %s

Checklist gợi ý:
- Xác nhận dịch vụ/tài khoản khách.
- Kiểm tra log gần nhất và trạng thái dịch vụ liên quan.
- Nếu là sự cố server, chuyển tiếp sang #server-alert hoặc #ky-thuat.
- Cập nhật kết quả xử lý lại trong thread ticket.`, customer, priority, compactSummary(body, 180)))
}

func formatServerAlertMessage(body string) string {
	plain := normalizeText(body)
	severity := "Warning"
	if containsAny(plain, "critical", "down", "mat ping", "timeout", "port 22", "het disk", "full disk") {
		severity = "Critical"
	}
	signals := make([]string, 0, 4)
	if containsAny(plain, "ping", "mat ping") {
		signals = append(signals, "network/ping")
	}
	if containsAny(plain, "port", "timeout") {
		signals = append(signals, "port/service")
	}
	if containsAny(plain, "cpu", "ram", "memory", "disk") {
		signals = append(signals, "resource")
	}
	if len(signals) == 0 {
		signals = append(signals, "general")
	}
	return strings.TrimSpace(fmt.Sprintf(`[Server Alert Bot] Đã nhận cảnh báo vận hành
Mức độ: %s
Dấu hiệu: %s
Tóm tắt: %s

Checklist gợi ý:
- Kiểm tra ping/traceroute và SSH.
- Kiểm tra tải hệ thống: CPU, RAM, disk, network.
- Kiểm tra dịch vụ liên quan bằng systemctl/docker logs.
- Nếu ảnh hưởng khách hàng, báo #ticket và cập nhật tiến độ xử lý.`, severity, strings.Join(signals, ", "), compactSummary(body, 180)))
}

func normalizeServiceTypeAlias(value string) string {
	value = normalizeText(strings.TrimSpace(value))
	value = strings.Trim(value, " .,:;|")
	switch {
	case value == "", strings.HasPrefix(value, "tat ca"), value == "all":
		return "all"
	case strings.HasPrefix(value, "vps"):
		return "vps"
	case strings.HasPrefix(value, "proxy"):
		return "proxy"
	case strings.HasPrefix(value, "hosting"):
		return "hosting"
	case strings.HasPrefix(value, "s3"):
		return "s3"
	case strings.HasPrefix(value, "drive"):
		return "drive"
	case strings.HasPrefix(value, "waf"):
		return "waf"
	case strings.HasPrefix(value, "domain"):
		return "domain"
	case strings.HasPrefix(value, "separate"):
		return "separate"
	default:
		return ""
	}
}

func firstMoneyValue(body string) int {
	best := 0
	for _, match := range regexp.MustCompile(`(?i)\b[0-9][0-9\.\,\s]*[kKmM]?\b`).FindAllString(body, -1) {
		value := parseHumanInt(match)
		if value > best {
			best = value
		}
	}
	return best
}

func parseHumanInt(value string) int {
	value = strings.TrimSpace(value)
	multiplier := 1
	lower := strings.ToLower(value)
	if strings.HasSuffix(lower, "k") {
		multiplier = 1000
		value = value[:len(value)-1]
	} else if strings.HasSuffix(lower, "m") {
		multiplier = 1000000
		value = value[:len(value)-1]
	}
	value = strings.NewReplacer(".", "", ",", "", " ", "").Replace(value)
	parsed, err := strconv.Atoi(value)
	if err != nil {
		return 0
	}
	return parsed * multiplier
}

func compactSummary(value string, limit int) string {
	value = strings.Join(strings.Fields(value), " ")
	if len([]rune(value)) <= limit {
		return value
	}
	runes := []rune(value)
	return string(runes[:limit]) + "..."
}

func containsAny(value string, needles ...string) bool {
	for _, needle := range needles {
		if strings.Contains(value, needle) {
			return true
		}
	}
	return false
}

func normalizeText(value string) string {
	value = strings.ToLower(value)
	return strings.NewReplacer(
		"à", "a", "á", "a", "ạ", "a", "ả", "a", "ã", "a", "â", "a", "ầ", "a", "ấ", "a", "ậ", "a", "ẩ", "a", "ẫ", "a", "ă", "a", "ằ", "a", "ắ", "a", "ặ", "a", "ẳ", "a", "ẵ", "a",
		"è", "e", "é", "e", "ẹ", "e", "ẻ", "e", "ẽ", "e", "ê", "e", "ề", "e", "ế", "e", "ệ", "e", "ể", "e", "ễ", "e",
		"ì", "i", "í", "i", "ị", "i", "ỉ", "i", "ĩ", "i",
		"ò", "o", "ó", "o", "ọ", "o", "ỏ", "o", "õ", "o", "ô", "o", "ồ", "o", "ố", "o", "ộ", "o", "ổ", "o", "ỗ", "o", "ơ", "o", "ờ", "o", "ớ", "o", "ợ", "o", "ở", "o", "ỡ", "o",
		"ù", "u", "ú", "u", "ụ", "u", "ủ", "u", "ũ", "u", "ư", "u", "ừ", "u", "ứ", "u", "ự", "u", "ử", "u", "ữ", "u",
		"ỳ", "y", "ý", "y", "ỵ", "y", "ỷ", "y", "ỹ", "y",
		"đ", "d",
	).Replace(value)
}

func (s *Service) ensurePermission(ctx context.Context, userID string, workspaceID string, permissionCode string) error {
	if s.checker == nil {
		return nil
	}
	allowed, err := s.checker.HasWorkspacePermission(ctx, strings.TrimSpace(userID), strings.TrimSpace(workspaceID), permissionCode)
	if err != nil {
		return err
	}
	if !allowed {
		return apperrors.Forbidden("Bạn không có quyền sử dụng bot order VPSTTT.")
	}
	return nil
}

func (s *Service) ensureConfigured() error {
	if s.client == nil || !s.client.Configured() {
		return apperrors.Internal("Chưa cấu hình ORDER_INTERNAL_API_KEY cho bot order VPSTTT.")
	}
	return nil
}

func (s *Service) postBotMessage(ctx context.Context, workspaceID string, botSlug string, channelID string, channelSlug string, body string, metadata map[string]any) (BotMessageDTO, error) {
	slog.Info("Order bot bat dau postBotMessage",
		"workspace_id", strings.TrimSpace(workspaceID),
		"channel_id", strings.TrimSpace(channelID),
		"bot_slug", botSlug,
		"target_channel_slug", channelSlug,
	)
	if s.repo == nil {
		return BotMessageDTO{}, apperrors.Internal("Order bot repository chưa được cấu hình.")
	}
	if metadata == nil {
		metadata = map[string]any{}
	}
	metadata["generated_at"] = s.now().Format(time.RFC3339)
	rawMetadata, err := json.Marshal(metadata)
	if err != nil {
		return BotMessageDTO{}, err
	}
	slog.Info("Order bot insert message vao database",
		"workspace_id", strings.TrimSpace(workspaceID),
		"channel_id", strings.TrimSpace(channelID),
		"bot_slug", botSlug,
		"target_channel_slug", channelSlug,
		"action", metadata["action"],
	)
	message, err := s.repo.SendBotMessage(ctx, SendBotMessageParams{
		WorkspaceID: strings.TrimSpace(workspaceID),
		BotSlug:     botSlug,
		ChannelID:   strings.TrimSpace(channelID),
		ChannelSlug: channelSlug,
		Body:        body,
		Metadata:    rawMetadata,
	})
	if errors.Is(err, ErrOrderBotTargetNotFound) {
		slog.Warn("Order bot khong tim thay bot hoac bot_installation cho kenh dich",
			"workspace_id", strings.TrimSpace(workspaceID),
			"channel_id", strings.TrimSpace(channelID),
			"bot_slug", botSlug,
			"target_channel_slug", channelSlug,
		)
		return BotMessageDTO{}, apperrors.BadRequest("ORDER_BOT_NOT_INSTALLED", "Bot order chưa được cài vào kênh đích.")
	}
	if err != nil {
		slog.Warn("Order bot insert message vao database that bai",
			"workspace_id", strings.TrimSpace(workspaceID),
			"channel_id", strings.TrimSpace(channelID),
			"bot_slug", botSlug,
			"target_channel_slug", channelSlug,
			"error", err,
		)
		return BotMessageDTO{}, err
	}
	slog.Info("Order bot insert message vao database thanh cong",
		"workspace_id", message.WorkspaceID,
		"channel_id", message.ChannelID,
		"message_id", message.ID,
		"bot_id", message.BotID,
		"bot_slug", botSlug,
	)
	return message, nil
}

func normalizeLookup(email string, userID int) (UserLookupRequest, error) {
	email = normalizeEmail(email)
	if email == "" && userID <= 0 {
		return UserLookupRequest{}, apperrors.BadRequest("VALIDATION_ERROR", "Cần truyền email hoặc user_id khách hàng.")
	}
	if userID < 0 {
		return UserLookupRequest{}, apperrors.BadRequest("VALIDATION_ERROR", "user_id không hợp lệ.")
	}
	return UserLookupRequest{Email: email, UserID: userID}, nil
}

func normalizeEmail(email string) string {
	email = strings.ToLower(strings.TrimSpace(email))
	if strings.ContainsAny(email, "\r\n\t") || len(email) > 254 {
		return ""
	}
	return email
}

func normalizeServiceType(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	switch value {
	case "", "all", "vps", "proxy", "hosting", "s3", "drive", "waf", "domain", "separate":
		return value
	default:
		return ""
	}
}

func validateOptionalChannelID(channelID string) error {
	channelID = strings.TrimSpace(channelID)
	if channelID == "" {
		return nil
	}
	if !uuidPattern.MatchString(channelID) {
		return apperrors.BadRequest("VALIDATION_ERROR", "channel_id không hợp lệ.")
	}
	return nil
}

func shouldPost(value *bool) bool {
	return value == nil || *value
}

func ensureRemoteOK(ok bool, status string, message string) error {
	if ok || strings.EqualFold(status, "success") {
		return nil
	}
	if strings.TrimSpace(message) == "" {
		message = "Order API trả về lỗi."
	}
	return apperrors.BadRequest("ORDER_API_ERROR", message)
}

func formatWalletBalanceMessage(data WalletBalanceData) string {
	var builder strings.Builder
	builder.WriteString("[CSKH Bot] Tra cứu ví khách hàng\n")
	builder.WriteString("Khách: " + customerLine(data.Name, data.Email, data.UserID) + "\n")
	builder.WriteString("Số dư ví: " + formatVND(balanceAmount(data.BalanceVND, data.Balance, data.Money)) + "\n")
	if data.Agency != "" {
		builder.WriteString("Đại lý: " + data.Agency + "\n")
	}
	if len(data.Services) > 0 {
		builder.WriteString("Dịch vụ: " + formatServicesMap(data.Services) + "\n")
	}
	return strings.TrimSpace(builder.String())
}

func formatDepositQRMessage(data WalletDepositQRData) string {
	var builder strings.Builder
	builder.WriteString("[Thanh Toán Bot] QR nạp ví\n")
	builder.WriteString("Khách: " + customerLine(data.Name, data.Email, data.UserID) + "\n")
	builder.WriteString("Số tiền: " + formatVND(data.Amount) + "\n")
	if data.Reference != "" {
		builder.WriteString("Mã tham chiếu: " + data.Reference + "\n")
	}
	transferContent := firstNonEmpty(data.TransferContent, data.Bank.TransferContent)
	if transferContent != "" {
		builder.WriteString("Nội dung CK: " + transferContent + "\n")
	}
	if data.Bank.BankCode != "" || data.Bank.AccountNumber != "" {
		builder.WriteString("Ngân hàng: " + strings.TrimSpace(data.Bank.BankCode+" "+data.Bank.AccountNumber) + "\n")
	}
	if data.Bank.AccountName != "" {
		builder.WriteString("Chủ TK: " + data.Bank.AccountName + "\n")
	}
	if data.QRURL != "" {
		builder.WriteString("QR: " + data.QRURL + "\n")
	}
	if data.ExpiresAt != "" {
		builder.WriteString("Hết hạn: " + data.ExpiresAt + "\n")
	}
	return strings.TrimSpace(builder.String())
}

func formatExpiringServicesMessage(data ServicesExpiringData) string {
	var builder strings.Builder
	builder.WriteString("[Gia Hạn Bot] Dịch vụ sắp hết hạn\n")
	builder.WriteString("Khách: " + customerLine(data.User.Name, data.User.Email, data.User.UserID) + "\n")
	if data.Days > 0 {
		builder.WriteString("Khoảng kiểm tra: " + strconv.Itoa(data.Days) + " ngày\n")
	}
	builder.WriteString(fmt.Sprintf(
		"Tổng: %d | Hết hạn: %d | Sắp hết hạn: %d | Auto-renew tắt: %d\n",
		data.Summary.Total,
		data.Summary.Expired,
		data.Summary.Expiring,
		data.Summary.AutoRenewOff,
	))
	if len(data.Summary.ByType) > 0 {
		builder.WriteString("Theo loại: " + formatServicesMap(data.Summary.ByType) + "\n")
	}
	if len(data.Items) == 0 {
		builder.WriteString("Không có dịch vụ phù hợp bộ lọc.")
		return strings.TrimSpace(builder.String())
	}
	builder.WriteString("Danh sách cần chú ý:\n")
	limit := len(data.Items)
	if limit > 10 {
		limit = 10
	}
	for index := 0; index < limit; index++ {
		item := data.Items[index]
		builder.WriteString("- " + expiringItemLine(item) + "\n")
	}
	if len(data.Items) > limit {
		builder.WriteString("... và " + strconv.Itoa(len(data.Items)-limit) + " dịch vụ khác.\n")
	}
	return strings.TrimSpace(builder.String())
}

func expiringItemLine(item ServiceExpiringItem) string {
	name := firstNonEmpty(item.Name, item.Meta, "Dịch vụ")
	serviceType := firstNonEmpty(item.ServiceType, strings.ToUpper(item.ServiceTypeKey), "SERVICE")
	parts := []string{fmt.Sprintf("%s #%d %s", serviceType, item.ServiceID, name)}
	if item.DaysRemaining < 0 {
		parts = append(parts, "đã hết hạn "+strconv.Itoa(-item.DaysRemaining)+" ngày")
	} else {
		parts = append(parts, "còn "+strconv.Itoa(item.DaysRemaining)+" ngày")
	}
	if item.ExpiresAt != "" {
		parts = append(parts, "hết hạn "+item.ExpiresAt)
	}
	if item.RenewalTransferContent != "" {
		parts = append(parts, "ND gia hạn: "+item.RenewalTransferContent)
	}
	return strings.Join(parts, " | ")
}

func customerLine(name string, email string, userID int) string {
	parts := make([]string, 0, 3)
	if strings.TrimSpace(name) != "" {
		parts = append(parts, strings.TrimSpace(name))
	}
	if strings.TrimSpace(email) != "" {
		parts = append(parts, strings.TrimSpace(email))
	}
	if userID > 0 {
		parts = append(parts, "#"+strconv.Itoa(userID))
	}
	if len(parts) == 0 {
		return "Không rõ"
	}
	return strings.Join(parts, " - ")
}

func balanceAmount(balanceVND int, balance float64, money float64) int {
	if balanceVND != 0 {
		return balanceVND
	}
	if balance != 0 {
		return int(balance)
	}
	return int(money)
}

func formatVND(amount int) string {
	sign := ""
	if amount < 0 {
		sign = "-"
		amount = -amount
	}
	raw := strconv.Itoa(amount)
	var chunks []string
	for len(raw) > 3 {
		chunks = append([]string{raw[len(raw)-3:]}, chunks...)
		raw = raw[:len(raw)-3]
	}
	chunks = append([]string{raw}, chunks...)
	return sign + strings.Join(chunks, ".") + " VND"
}

func formatServicesMap(values map[string]int) string {
	keys := make([]string, 0, len(values))
	for key := range values {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	parts := make([]string, 0, len(keys))
	for _, key := range keys {
		parts = append(parts, strings.ToUpper(key)+" "+strconv.Itoa(values[key]))
	}
	return strings.Join(parts, " · ")
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

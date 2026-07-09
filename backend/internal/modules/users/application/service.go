package application

import (
	"context"
	"errors"
	"strings"
	"time"

	usersdomain "github.com/duclamdev/application-chat/backend/internal/modules/users/domain"
	apperrors "github.com/duclamdev/application-chat/backend/internal/shared/errors"
	"github.com/duclamdev/application-chat/backend/internal/shared/pagination"
)

type Repository interface {
	FindByID(ctx context.Context, id string) (usersdomain.User, error)
	List(ctx context.Context, params ListUsersParams) ([]usersdomain.User, error)
	UpdateProfile(ctx context.Context, params UpdateProfileParams) (usersdomain.User, error)
	UpdateUser(ctx context.Context, params UpdateUserParams) (usersdomain.User, error)
	DeleteUser(ctx context.Context, userID string) error
}

type Service struct {
	repo Repository
}

type ListUsersParams struct {
	Query  string
	Status string
	Limit  int
}

type UpdateProfileParams struct {
	UserID      string
	DisplayName *string
	AvatarURL   *string
	PhoneNumber *string
	Locale      *string
	Timezone    *string
}

type UpdateUserParams struct {
	UserID      string
	DisplayName *string
	AvatarURL   *string
	PhoneNumber *string
	Locale      *string
	Timezone    *string
	Status      *string
}

type UpdateProfileInput struct {
	UserID      string
	DisplayName *string
	AvatarURL   *string
	PhoneNumber *string
	Locale      *string
	Timezone    *string
}

type UpdateUserInput struct {
	UserID      string
	DisplayName *string
	AvatarURL   *string
	PhoneNumber *string
	Locale      *string
	Timezone    *string
	Status      *string
}

type UserDTO struct {
	ID              string  `json:"id"`
	Email           string  `json:"email"`
	Username        string  `json:"username"`
	DisplayName     string  `json:"display_name"`
	AvatarURL       *string `json:"avatar_url,omitempty"`
	PhoneNumber     *string `json:"phone_number,omitempty"`
	Status          string  `json:"status"`
	Locale          string  `json:"locale"`
	Timezone        string  `json:"timezone"`
	EmailVerifiedAt *string `json:"email_verified_at,omitempty"`
	LastSeenAt      *string `json:"last_seen_at,omitempty"`
	RegistrationIP  *string `json:"registration_ip_address,omitempty"`
	RegistrationDev *string `json:"registration_device_name,omitempty"`
	LastIPAddress   *string `json:"last_ip_address,omitempty"`
	DeviceName      *string `json:"device_name,omitempty"`
	CreatedAt       string  `json:"created_at"`
	UpdatedAt       string  `json:"updated_at"`
}

func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) Me(ctx context.Context, userID string) (UserDTO, error) {
	return s.Get(ctx, userID)
}

func (s *Service) Get(ctx context.Context, userID string) (UserDTO, error) {
	user, err := s.repo.FindByID(ctx, strings.TrimSpace(userID))
	if err != nil {
		if errors.Is(err, usersdomain.ErrUserNotFound) {
			return UserDTO{}, apperrors.NotFound("USER_NOT_FOUND", "Không tìm thấy người dùng.")
		}
		return UserDTO{}, err
	}
	return toDTO(user), nil
}

func (s *Service) List(ctx context.Context, params ListUsersParams) ([]UserDTO, pagination.Meta, error) {
	params.Query = strings.TrimSpace(params.Query)
	params.Status = strings.TrimSpace(params.Status)
	params.Limit = pagination.NormalizeLimit(params.Limit)

	users, err := s.repo.List(ctx, params)
	if err != nil {
		return nil, pagination.Meta{}, err
	}

	dtos := make([]UserDTO, 0, len(users))
	for _, user := range users {
		dtos = append(dtos, toDTO(user))
	}
	return dtos, pagination.Meta{HasMore: len(users) == params.Limit}, nil
}

func (s *Service) UpdateMe(ctx context.Context, input UpdateProfileInput) (UserDTO, error) {
	displayName, avatarURL, phoneNumber, locale, timezone, err := validateProfile(input.DisplayName, input.AvatarURL, input.PhoneNumber, input.Locale, input.Timezone)
	if err != nil {
		return UserDTO{}, err
	}
	user, err := s.repo.UpdateProfile(ctx, UpdateProfileParams{
		UserID:      strings.TrimSpace(input.UserID),
		DisplayName: displayName,
		AvatarURL:   avatarURL,
		PhoneNumber: phoneNumber,
		Locale:      locale,
		Timezone:    timezone,
	})
	if err != nil {
		if errors.Is(err, usersdomain.ErrUserNotFound) {
			return UserDTO{}, apperrors.NotFound("USER_NOT_FOUND", "Không tìm thấy người dùng.")
		}
		return UserDTO{}, err
	}
	return toDTO(user), nil
}

func (s *Service) Update(ctx context.Context, input UpdateUserInput) (UserDTO, error) {
	displayName, avatarURL, phoneNumber, locale, timezone, err := validateProfile(input.DisplayName, input.AvatarURL, input.PhoneNumber, input.Locale, input.Timezone)
	if err != nil {
		return UserDTO{}, err
	}
	status := cleanOptional(input.Status)
	if status != nil {
		switch *status {
		case "active", "invited", "locked", "disabled":
		default:
			return UserDTO{}, apperrors.BadRequest("VALIDATION_ERROR", "Trạng thái user không hợp lệ.")
		}
	}
	user, err := s.repo.UpdateUser(ctx, UpdateUserParams{
		UserID:      strings.TrimSpace(input.UserID),
		DisplayName: displayName,
		AvatarURL:   avatarURL,
		PhoneNumber: phoneNumber,
		Locale:      locale,
		Timezone:    timezone,
		Status:      status,
	})
	if err != nil {
		if errors.Is(err, usersdomain.ErrUserNotFound) {
			return UserDTO{}, apperrors.NotFound("USER_NOT_FOUND", "Không tìm thấy người dùng.")
		}
		return UserDTO{}, err
	}
	return toDTO(user), nil
}

func (s *Service) Delete(ctx context.Context, userID string) error {
	if err := s.repo.DeleteUser(ctx, strings.TrimSpace(userID)); err != nil {
		if errors.Is(err, usersdomain.ErrUserNotFound) {
			return apperrors.NotFound("USER_NOT_FOUND", "Không tìm thấy người dùng.")
		}
		return err
	}
	return nil
}

func validateProfile(displayNameInput *string, avatarURLInput *string, phoneNumberInput *string, localeInput *string, timezoneInput *string) (*string, *string, *string, *string, *string, error) {
	displayName := cleanOptional(displayNameInput)
	avatarURL := cleanOptional(avatarURLInput)
	phoneNumber := cleanOptional(phoneNumberInput)
	locale := cleanOptional(localeInput)
	timezone := cleanOptional(timezoneInput)

	if displayName != nil {
		value := *displayName
		if value == "" || len([]rune(value)) > 120 {
			return nil, nil, nil, nil, nil, apperrors.BadRequest("VALIDATION_ERROR", "Tên hiển thị phải dài từ 1 đến 120 ký tự.")
		}
	}
	if phoneNumber != nil {
		value := *phoneNumber
		if len([]rune(value)) > 32 {
			return nil, nil, nil, nil, nil, apperrors.BadRequest("VALIDATION_ERROR", "Số điện thoại không được vượt quá 32 ký tự.")
		}
	}
	if locale != nil {
		value := *locale
		if value == "" || len([]rune(value)) > 20 {
			return nil, nil, nil, nil, nil, apperrors.BadRequest("VALIDATION_ERROR", "Locale không hợp lệ.")
		}
	}
	if timezone != nil {
		value := *timezone
		if value == "" || len([]rune(value)) > 80 {
			return nil, nil, nil, nil, nil, apperrors.BadRequest("VALIDATION_ERROR", "Timezone không hợp lệ.")
		}
	}
	return displayName, avatarURL, phoneNumber, locale, timezone, nil
}

func cleanOptional(value *string) *string {
	if value == nil {
		return nil
	}
	cleaned := strings.TrimSpace(*value)
	return &cleaned
}

func toDTO(user usersdomain.User) UserDTO {
	return UserDTO{
		ID:              user.ID,
		Email:           user.Email,
		Username:        user.Username,
		DisplayName:     user.DisplayName,
		AvatarURL:       user.AvatarURL,
		PhoneNumber:     user.PhoneNumber,
		Status:          user.Status,
		Locale:          user.Locale,
		Timezone:        user.Timezone,
		EmailVerifiedAt: formatOptionalTime(user.EmailVerifiedAt),
		LastSeenAt:      formatOptionalTime(user.LastSeenAt),
		RegistrationIP:  user.RegistrationIP,
		RegistrationDev: user.RegistrationDev,
		LastIPAddress:   user.LastIPAddress,
		DeviceName:      user.DeviceName,
		CreatedAt:       formatTime(user.CreatedAt),
		UpdatedAt:       formatTime(user.UpdatedAt),
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

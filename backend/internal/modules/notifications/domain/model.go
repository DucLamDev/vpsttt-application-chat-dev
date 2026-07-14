package domain

import (
	"errors"
	"time"
)

var ErrNotificationNotFound = errors.New("không tìm thấy thông báo")

var ErrNotificationPreferenceUnavailable = errors.New("notification preference unavailable")

type Notification struct {
	ID          string
	UserID      string
	WorkspaceID *string
	ChannelID   *string
	MessageID   *string
	Type        string
	Title       string
	Body        string
	Data        []byte
	ReadAt      *time.Time
	DeliveredAt *time.Time
	CreatedAt   time.Time
}

type NotificationPreference struct {
	UserID      string
	WorkspaceID string
	Mode        string
	Preview     bool
	QuietHours  bool
	QuietStart  string
	QuietEnd    string
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

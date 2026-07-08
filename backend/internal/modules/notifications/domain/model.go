package domain

import (
	"errors"
	"time"
)

var ErrNotificationNotFound = errors.New("không tìm thấy thông báo")

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

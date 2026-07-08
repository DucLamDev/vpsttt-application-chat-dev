package domain

import (
	"errors"
	"time"
)

var (
	ErrBotNotFound         = errors.New("không tìm thấy bot")
	ErrBotAlreadyExists    = errors.New("bot đã tồn tại")
	ErrBotAlreadyInstalled = errors.New("bot đã được cài đặt")
	ErrBotNotInstalled     = errors.New("bot chưa được cài đặt vào kênh")
)

type Bot struct {
	ID          string
	WorkspaceID string
	Slug        string
	Name        string
	Description *string
	AvatarURL   *string
	Status      string
	CreatedBy   *string
	Settings    []byte
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

type Installation struct {
	ID          string
	BotID       string
	WorkspaceID string
	ChannelID   *string
	Status      string
	Config      []byte
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

type BotMessage struct {
	ID          string
	WorkspaceID string
	ChannelID   string
	BotID       string
	Kind        string
	Body        string
	Metadata    []byte
	CreatedAt   time.Time
}

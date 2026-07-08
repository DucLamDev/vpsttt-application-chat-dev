package application

import (
	"context"
	"testing"

	botsdomain "github.com/duclamdev/application-chat/backend/internal/modules/bots/domain"
	apperrors "github.com/duclamdev/application-chat/backend/internal/shared/errors"
)

type fakeBotChecker struct {
	allowed bool
}

func (c fakeBotChecker) HasWorkspacePermission(context.Context, string, string, string) (bool, error) {
	return c.allowed, nil
}

type fakeBotRepo struct {
	createCalled bool
}

func (r *fakeBotRepo) CreateBot(context.Context, CreateBotParams) (botsdomain.Bot, error) {
	r.createCalled = true
	return botsdomain.Bot{}, nil
}

func (r *fakeBotRepo) ListBots(context.Context, string) ([]botsdomain.Bot, error) {
	return nil, nil
}

func (r *fakeBotRepo) InstallBot(context.Context, InstallBotParams) (botsdomain.Installation, error) {
	return botsdomain.Installation{}, nil
}

func (r *fakeBotRepo) ListInstallations(context.Context, string, string) ([]botsdomain.Installation, error) {
	return nil, nil
}

func (r *fakeBotRepo) SendBotMessage(context.Context, SendBotMessageParams) (botsdomain.BotMessage, error) {
	return botsdomain.BotMessage{}, nil
}

func TestCreateBotRejectsInvalidSlugBeforeRepository(t *testing.T) {
	repo := &fakeBotRepo{}
	service := NewService(repo, fakeBotChecker{allowed: true})

	_, err := service.CreateBot(context.Background(), CreateBotInput{
		ActorUserID: "user-1",
		WorkspaceID: "workspace-1",
		Slug:        "Bot X",
		Name:        "Bot X",
	})
	if err == nil {
		t.Fatal("CreateBot() phải trả lỗi slug không hợp lệ")
	}
	if repo.createCalled {
		t.Fatal("CreateBot() không được gọi repository khi validation lỗi")
	}
	if appErr, ok := err.(*apperrors.AppError); !ok || appErr.Code != "VALIDATION_ERROR" {
		t.Fatalf("lỗi = %#v, muốn VALIDATION_ERROR", err)
	}
}

func TestSendMessageRejectsEmptyBody(t *testing.T) {
	service := NewService(&fakeBotRepo{}, fakeBotChecker{allowed: true})

	_, err := service.SendMessage(context.Background(), SendBotMessageInput{
		ActorUserID: "user-1",
		WorkspaceID: "workspace-1",
		BotID:       "bot-1",
		ChannelID:   "channel-1",
		Body:        "   ",
	})
	if err == nil {
		t.Fatal("SendMessage() phải trả lỗi khi body rỗng")
	}
}

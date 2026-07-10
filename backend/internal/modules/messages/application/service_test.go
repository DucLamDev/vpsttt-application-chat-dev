package application

import (
	"context"
	"reflect"
	"testing"
	"time"

	messagesdomain "github.com/duclamdev/application-chat/backend/internal/modules/messages/domain"
	apperrors "github.com/duclamdev/application-chat/backend/internal/shared/errors"
)

type testPermissionChecker struct {
	allowed bool
}

func (c testPermissionChecker) HasWorkspacePermission(context.Context, string, string, string) (bool, error) {
	return c.allowed, nil
}

type emptyMessageRepo struct{}

func (r emptyMessageRepo) Send(context.Context, SendParams) (messagesdomain.Message, error) {
	panic("không được gọi")
}

func (r emptyMessageRepo) Get(context.Context, MessageRef) (messagesdomain.Message, error) {
	panic("không được gọi")
}

func (r emptyMessageRepo) List(context.Context, ListParams) ([]messagesdomain.Message, error) {
	panic("không được gọi")
}

func (r emptyMessageRepo) ListThread(context.Context, ThreadParams) ([]messagesdomain.Message, error) {
	panic("không được gọi")
}

func (r emptyMessageRepo) Search(context.Context, SearchParams) ([]messagesdomain.Message, error) {
	panic("không được gọi")
}

func (r emptyMessageRepo) Forward(context.Context, ForwardParams) (messagesdomain.Message, error) {
	panic("không được gọi")
}

func (r emptyMessageRepo) Update(context.Context, UpdateParams) (messagesdomain.Message, error) {
	panic("không được gọi")
}

func (r emptyMessageRepo) Delete(context.Context, DeleteParams) error {
	panic("không được gọi")
}

func (r emptyMessageRepo) ListPins(context.Context, ListPinsParams) ([]messagesdomain.Message, error) {
	panic("không được gọi")
}

func (r emptyMessageRepo) Pin(context.Context, PinParams) (messagesdomain.Message, error) {
	panic("không được gọi")
}

func (r emptyMessageRepo) Unpin(context.Context, PinParams) error {
	panic("không được gọi")
}

func (r emptyMessageRepo) AddReaction(context.Context, ReactionParams) (messagesdomain.Message, error) {
	panic("không được gọi")
}

func (r emptyMessageRepo) RemoveReaction(context.Context, ReactionParams) (messagesdomain.Message, error) {
	panic("không được gọi")
}

type otherUserMessageRepo struct {
	emptyMessageRepo
}

func (r otherUserMessageRepo) Get(context.Context, MessageRef) (messagesdomain.Message, error) {
	senderID := "user-a"
	return messagesdomain.Message{
		ID:          "message-1",
		WorkspaceID: "workspace-1",
		ChannelID:   "channel-1",
		SenderID:    &senderID,
		Body:        "Tin nhắn của A",
	}, nil
}

func (r otherUserMessageRepo) Update(context.Context, UpdateParams) (messagesdomain.Message, error) {
	panic("không được sửa tin nhắn của người khác")
}

func TestNormalizeMentionsDeduplicatesExplicitAndBodyMentions(t *testing.T) {
	body := "Chào <@22222222-2222-2222-2222-222222222222> và <@11111111-1111-1111-1111-111111111111>"
	got := normalizeMentions(body, []string{
		" 22222222-2222-2222-2222-222222222222 ",
		"33333333-3333-3333-3333-333333333333",
	})

	want := []string{
		"11111111-1111-1111-1111-111111111111",
		"22222222-2222-2222-2222-222222222222",
		"33333333-3333-3333-3333-333333333333",
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("normalizeMentions() = %#v, muốn %#v", got, want)
	}
}

func TestUpdateRejectsEditingOtherUsersMessage(t *testing.T) {
	service := NewService(otherUserMessageRepo{}, testPermissionChecker{allowed: true})

	_, err := service.Update(context.Background(), UpdateInput{
		ActorUserID: "user-b",
		WorkspaceID: "workspace-1",
		ChannelID:   "channel-1",
		MessageID:   "message-1",
		Body:        "B sửa tin nhắn của A",
	})
	if err == nil {
		t.Fatal("Update() phải từ chối khi người dùng sửa tin nhắn của người khác")
	}

	appErr, ok := err.(*apperrors.AppError)
	if !ok {
		t.Fatalf("lỗi = %T, muốn AppError", err)
	}
	if appErr.Code != "FORBIDDEN" {
		t.Fatalf("mã lỗi = %q, muốn FORBIDDEN", appErr.Code)
	}
}

func TestSendRejectsEmptyTextMessage(t *testing.T) {
	service := NewService(emptyMessageRepo{}, testPermissionChecker{allowed: true})

	_, err := service.Send(context.Background(), SendInput{
		ActorUserID: "user-1",
		WorkspaceID: "workspace-1",
		ChannelID:   "channel-1",
		Body:        "   ",
	})
	if err == nil {
		t.Fatal("Send() phải trả lỗi khi nội dung rỗng")
	}

	appErr, ok := err.(*apperrors.AppError)
	if !ok {
		t.Fatalf("lỗi = %T, muốn AppError", err)
	}
	if appErr.Code != "VALIDATION_ERROR" {
		t.Fatalf("mã lỗi = %q", appErr.Code)
	}
}

func TestParseSearchDateUsesExclusiveEndDate(t *testing.T) {
	got, err := parseSearchDate("2026-07-10", true)
	if err != nil {
		t.Fatalf("parseSearchDate() trả lỗi: %v", err)
	}
	want := time.Date(2026, 7, 11, 0, 0, 0, 0, time.UTC)
	if got == nil || !got.Equal(want) {
		t.Fatalf("parseSearchDate() = %v, muốn %v", got, want)
	}
}

func TestForwardRequiresTargetChannel(t *testing.T) {
	service := NewService(emptyMessageRepo{}, testPermissionChecker{allowed: true})
	_, err := service.Forward(context.Background(), ForwardInput{
		ActorUserID: "user-1",
		WorkspaceID: "workspace-1",
		ChannelID:   "channel-1",
		MessageID:   "message-1",
	})
	if err == nil {
		t.Fatal("Forward() phải yêu cầu target channel")
	}
}

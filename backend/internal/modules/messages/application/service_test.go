package application

import (
	"context"
	"reflect"
	"testing"

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

func (r emptyMessageRepo) Update(context.Context, UpdateParams) (messagesdomain.Message, error) {
	panic("không được gọi")
}

func (r emptyMessageRepo) Delete(context.Context, DeleteParams) error {
	panic("không được gọi")
}

func (r emptyMessageRepo) AddReaction(context.Context, ReactionParams) (messagesdomain.Message, error) {
	panic("không được gọi")
}

func (r emptyMessageRepo) RemoveReaction(context.Context, ReactionParams) (messagesdomain.Message, error) {
	panic("không được gọi")
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

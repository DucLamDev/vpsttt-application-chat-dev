package application

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	notificationsdomain "github.com/duclamdev/application-chat/backend/internal/modules/notifications/domain"
	outboxdomain "github.com/duclamdev/application-chat/backend/internal/modules/outbox/domain"
)

type fakeNotificationRepo struct {
	mentionParams MentionParams
	mentionCalled bool
}

func (r *fakeNotificationRepo) CreateMentionNotifications(_ context.Context, params MentionParams) error {
	r.mentionParams = params
	r.mentionCalled = true
	return nil
}

func (r *fakeNotificationRepo) ListForUser(context.Context, ListParams) ([]notificationsdomain.Notification, error) {
	return nil, nil
}

func (r *fakeNotificationRepo) MarkRead(context.Context, string, string) (notificationsdomain.Notification, error) {
	return notificationsdomain.Notification{}, nil
}

func (r *fakeNotificationRepo) MarkAllRead(context.Context, string, string) error {
	return nil
}

func (r *fakeNotificationRepo) ProcessPendingJobs(context.Context, int) (int, error) {
	return 0, nil
}

func TestHandleCreatesMentionNotificationsFromMessageCreatedEvent(t *testing.T) {
	repo := &fakeNotificationRepo{}
	service := NewService(repo)
	payload := map[string]any{
		"workspace_id":       "workspace-1",
		"channel_id":         "channel-1",
		"message_id":         "message-1",
		"sender_id":          "sender-1",
		"mentioned_user_ids": []string{"user-1", "user-2"},
	}
	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("json.Marshal() trả lỗi: %v", err)
	}

	err = service.Handle(context.Background(), outboxdomain.Event{
		ID:           "event-1",
		EventType:    "MessageCreated",
		Payload:      payloadBytes,
		EventVersion: 1,
		CreatedAt:    time.Now(),
	})
	if err != nil {
		t.Fatalf("Handle() trả lỗi: %v", err)
	}
	if !repo.mentionCalled {
		t.Fatal("Handle() phải tạo notification khi message có mention")
	}
	if repo.mentionParams.EventID != "event-1" || repo.mentionParams.MessageID != "message-1" {
		t.Fatalf("mention params không đúng: %#v", repo.mentionParams)
	}
	if len(repo.mentionParams.MentionedUserIDs) != 2 {
		t.Fatalf("mentioned_user_ids = %#v", repo.mentionParams.MentionedUserIDs)
	}
}

func TestHandleIgnoresMessageWithoutMentions(t *testing.T) {
	repo := &fakeNotificationRepo{}
	service := NewService(repo)

	err := service.Handle(context.Background(), outboxdomain.Event{
		ID:        "event-1",
		EventType: "MessageCreated",
		Payload:   []byte(`{"workspace_id":"workspace-1","mentioned_user_ids":[]}`),
	})
	if err != nil {
		t.Fatalf("Handle() trả lỗi: %v", err)
	}
	if repo.mentionCalled {
		t.Fatal("Handle() không được tạo notification khi không có mention")
	}
}

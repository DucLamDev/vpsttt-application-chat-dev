package application

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	aptokensapp "github.com/duclamdev/application-chat/backend/internal/modules/api_tokens/application"
	outboxdomain "github.com/duclamdev/application-chat/backend/internal/modules/outbox/domain"
	webhooksdomain "github.com/duclamdev/application-chat/backend/internal/modules/webhooks/domain"
)

type fakeWebhookRepo struct {
	deliveryParams OutboxDeliveryParams
	deliveryCalled bool
}

func (r *fakeWebhookRepo) CreateIncoming(context.Context, CreateIncomingParams) (webhooksdomain.IncomingWebhook, error) {
	return webhooksdomain.IncomingWebhook{}, nil
}

func (r *fakeWebhookRepo) ListIncoming(context.Context, string) ([]webhooksdomain.IncomingWebhook, error) {
	return nil, nil
}

func (r *fakeWebhookRepo) CreateOutgoing(context.Context, CreateOutgoingParams) (webhooksdomain.OutgoingWebhook, error) {
	return webhooksdomain.OutgoingWebhook{}, nil
}

func (r *fakeWebhookRepo) ListOutgoing(context.Context, string) ([]webhooksdomain.OutgoingWebhook, error) {
	return nil, nil
}

func (r *fakeWebhookRepo) ListDeliveries(context.Context, string, string, int) ([]webhooksdomain.Delivery, error) {
	return nil, nil
}

func (r *fakeWebhookRepo) SendIncomingMessage(context.Context, IncomingMessageParams) (webhooksdomain.IntegrationMessage, error) {
	return webhooksdomain.IntegrationMessage{}, nil
}

func (r *fakeWebhookRepo) SendIntegrationMessage(context.Context, IntegrationMessageParams) (webhooksdomain.IntegrationMessage, error) {
	return webhooksdomain.IntegrationMessage{}, nil
}

func (r *fakeWebhookRepo) CreateDeliveriesForEvent(_ context.Context, params OutboxDeliveryParams) (int, error) {
	r.deliveryParams = params
	r.deliveryCalled = true
	return 1, nil
}

func (r *fakeWebhookRepo) ClaimDeliveries(context.Context, int) ([]webhooksdomain.Delivery, error) {
	return nil, nil
}

func (r *fakeWebhookRepo) MarkDeliverySuccess(context.Context, string, int, string) error {
	return nil
}

func (r *fakeWebhookRepo) MarkDeliveryFailed(context.Context, string, int, string, time.Duration, int) error {
	return nil
}

type fakeTokenAuth struct{}

func (fakeTokenAuth) Authenticate(context.Context, string, string) (aptokensapp.AuthenticatedTokenDTO, error) {
	return aptokensapp.AuthenticatedTokenDTO{WorkspaceID: "workspace-1"}, nil
}

func TestHandleCreatesOutgoingDeliveriesFromOutboxEvent(t *testing.T) {
	repo := &fakeWebhookRepo{}
	service := NewService(repo, nil, fakeTokenAuth{}, nil)
	payload := map[string]any{
		"workspace_id": "workspace-1",
		"channel_id":   "channel-1",
		"message_id":   "message-1",
	}
	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("json.Marshal() trả lỗi: %v", err)
	}

	err = service.Handle(context.Background(), outboxdomain.Event{
		ID:            "11111111-1111-1111-1111-111111111111",
		AggregateType: "message",
		AggregateID:   "message-1",
		EventType:     "MessageCreated",
		EventVersion:  1,
		Payload:       payloadBytes,
		CreatedAt:     time.Date(2026, 7, 6, 0, 0, 0, 0, time.UTC),
	})
	if err != nil {
		t.Fatalf("Handle() trả lỗi: %v", err)
	}
	if !repo.deliveryCalled {
		t.Fatal("Handle() phải tạo webhook delivery")
	}
	if repo.deliveryParams.WorkspaceID != "workspace-1" || repo.deliveryParams.EventType != "MessageCreated" {
		t.Fatalf("delivery params không đúng: %#v", repo.deliveryParams)
	}
}

func TestHandleIgnoresEventWithoutWorkspace(t *testing.T) {
	repo := &fakeWebhookRepo{}
	service := NewService(repo, nil, nil, nil)

	err := service.Handle(context.Background(), outboxdomain.Event{
		ID:        "event-1",
		EventType: "SystemEvent",
		Payload:   []byte(`{"message_id":"message-1"}`),
	})
	if err != nil {
		t.Fatalf("Handle() trả lỗi: %v", err)
	}
	if repo.deliveryCalled {
		t.Fatal("Handle() không được tạo delivery khi event thiếu workspace_id")
	}
}

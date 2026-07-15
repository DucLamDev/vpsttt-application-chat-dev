package application

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	callsdomain "github.com/duclamdev/application-chat/backend/internal/modules/calls/domain"
)

type fakeCallRepo struct {
	call               callsdomain.Call
	createCalled       bool
	updateStatusCalled bool
	messageCalled      bool
	lastMessage        CallMessageParams
	lastSignal         SignalParams
}

func (r *fakeCallRepo) Create(_ context.Context, params CreateParams) (callsdomain.Call, error) {
	r.createCalled = true
	now := time.Now()
	r.call = callsdomain.Call{
		ID:              "call-1",
		WorkspaceID:     params.WorkspaceID,
		ChannelID:       params.ChannelID,
		InitiatorUserID: params.InitiatorID,
		TargetUserID:    params.TargetUserID,
		Mode:            params.Mode,
		Status:          "ringing",
		Metadata:        params.Metadata,
		CreatedAt:       now,
		UpdatedAt:       now,
	}
	if params.ClientCallID != "" {
		r.call.ClientCallID = &params.ClientCallID
	}
	return r.call, nil
}

func (r *fakeCallRepo) Get(context.Context, string, string) (callsdomain.Call, error) {
	return r.call, nil
}

func (r *fakeCallRepo) UpdateStatus(_ context.Context, params StatusParams) (callsdomain.Call, error) {
	r.updateStatusCalled = true
	now := time.Now()
	r.call.Status = params.Status
	r.call.UpdatedAt = now
	if params.Status == "accepted" {
		r.call.StartedAt = &now
	}
	if params.Status == "ended" || params.Status == "missed" || params.Status == "rejected" || params.Status == "cancelled" {
		r.call.EndedAt = &now
	}
	return r.call, nil
}

func (r *fakeCallRepo) CreateSignal(_ context.Context, params SignalParams) (callsdomain.Signal, error) {
	r.lastSignal = params
	return callsdomain.Signal{
		ID:           "signal-1",
		WorkspaceID:  params.WorkspaceID,
		CallID:       params.CallID,
		SenderUserID: params.SenderUserID,
		SignalType:   params.SignalType,
		Payload:      params.Payload,
		CreatedAt:    time.Now(),
	}, nil
}

func (r *fakeCallRepo) CreateCallMessage(_ context.Context, params CallMessageParams) error {
	r.messageCalled = true
	r.lastMessage = params
	return nil
}

type fakeCallChecker struct {
	allowed bool
}

func (c fakeCallChecker) HasWorkspacePermission(context.Context, string, string, string) (bool, error) {
	return c.allowed, nil
}

type fakeRealtime struct {
	events []RealtimeEvent
}

func (p *fakeRealtime) Publish(_ context.Context, event RealtimeEvent) error {
	p.events = append(p.events, event)
	return nil
}

func TestCreateRejectsInvalidModeBeforeRepository(t *testing.T) {
	repo := &fakeCallRepo{}
	service := NewService(repo, fakeCallChecker{allowed: true}, nil)

	_, err := service.Create(context.Background(), CreateInput{
		ActorUserID:  "user-1",
		WorkspaceID:  "workspace-1",
		ChannelID:    "channel-1",
		TargetUserID: "user-2",
		Mode:         "screen-share",
	})
	if err == nil {
		t.Fatal("Create() phải trả lỗi khi mode không hợp lệ")
	}
	if repo.createCalled {
		t.Fatal("Create() không được gọi repository khi validation lỗi")
	}
}

func TestCreatePublishesCallInvited(t *testing.T) {
	repo := &fakeCallRepo{}
	realtime := &fakeRealtime{}
	service := NewService(repo, fakeCallChecker{allowed: true}, realtime)

	call, err := service.Create(context.Background(), CreateInput{
		ActorUserID:  "user-1",
		WorkspaceID:  "workspace-1",
		ChannelID:    "channel-1",
		TargetUserID: "user-2",
		ClientCallID: "client-call-1",
		Mode:         "video",
		Metadata:     json.RawMessage(`{"source":"mobile"}`),
	})
	if err != nil {
		t.Fatalf("Create() error = %v", err)
	}
	if call.Status != "ringing" || call.Mode != "video" {
		t.Fatalf("call không đúng: %#v", call)
	}
	if len(realtime.events) != 1 || realtime.events[0].Type != "CallInvited" || realtime.events[0].TargetUserID != "user-2" {
		t.Fatalf("realtime event không đúng: %#v", realtime.events)
	}
}

func TestAcceptRequiresTargetUser(t *testing.T) {
	repo := &fakeCallRepo{
		call: callsdomain.Call{
			ID:              "call-1",
			WorkspaceID:     "workspace-1",
			ChannelID:       "channel-1",
			InitiatorUserID: "user-1",
			TargetUserID:    "user-2",
			Mode:            "audio",
			Status:          "ringing",
			CreatedAt:       time.Now(),
			UpdatedAt:       time.Now(),
		},
	}
	service := NewService(repo, fakeCallChecker{allowed: true}, nil)

	_, err := service.ChangeStatus(context.Background(), StatusInput{
		ActorUserID: "user-1",
		WorkspaceID: "workspace-1",
		CallID:      "call-1",
		Action:      "accept",
	})
	if err == nil {
		t.Fatal("ChangeStatus(accept) phải trả lỗi khi người gọi tự accept")
	}
	if repo.updateStatusCalled {
		t.Fatal("ChangeStatus(accept) không được update khi transition sai")
	}
}

func TestMissCreatesCallMessageAndRealtimeEvent(t *testing.T) {
	repo := &fakeCallRepo{
		call: callsdomain.Call{
			ID:              "call-1",
			WorkspaceID:     "workspace-1",
			ChannelID:       "channel-1",
			InitiatorUserID: "user-1",
			TargetUserID:    "user-2",
			Mode:            "audio",
			Status:          "ringing",
			CreatedAt:       time.Now(),
			UpdatedAt:       time.Now(),
		},
	}
	realtime := &fakeRealtime{}
	service := NewService(repo, fakeCallChecker{allowed: true}, realtime)

	call, err := service.ChangeStatus(context.Background(), StatusInput{
		ActorUserID: "user-2",
		WorkspaceID: "workspace-1",
		CallID:      "call-1",
		Action:      "miss",
	})
	if err != nil {
		t.Fatalf("ChangeStatus(miss) error = %v", err)
	}
	if call.Status != "missed" || !repo.messageCalled {
		t.Fatalf("missed call không đúng: call=%#v messageCalled=%v", call, repo.messageCalled)
	}
	if repo.lastMessage.Body != "Cuộc gọi nhỡ" {
		t.Fatalf("body message cuộc gọi = %q", repo.lastMessage.Body)
	}
	if len(realtime.events) != 1 || realtime.events[0].Type != "CallMissed" || realtime.events[0].TargetUserID != "user-1" {
		t.Fatalf("realtime event không đúng: %#v", realtime.events)
	}
}

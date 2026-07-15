package websocket

import (
	"context"
	"fmt"

	callsapp "github.com/duclamdev/application-chat/backend/internal/modules/calls/application"
	platformws "github.com/duclamdev/application-chat/backend/internal/platform/websocket"
)

type Publisher struct {
	manager *platformws.Manager
}

func NewPublisher(manager *platformws.Manager) *Publisher {
	return &Publisher{manager: manager}
}

func (p *Publisher) Publish(ctx context.Context, event callsapp.RealtimeEvent) error {
	if p == nil || p.manager == nil {
		return nil
	}
	room := fmt.Sprintf("workspace:%s:channel:%s", event.WorkspaceID, event.ChannelID)
	if err := p.manager.Broadcast(ctx, room, platformws.Event{
		Type:    event.Type,
		Room:    room,
		Payload: event.Payload,
	}); err != nil {
		return err
	}
	if event.TargetUserID == "" {
		return nil
	}
	userRoom := "user:" + event.TargetUserID
	return p.manager.Broadcast(ctx, userRoom, platformws.Event{
		Type:    event.Type,
		Room:    userRoom,
		UserID:  event.TargetUserID,
		Payload: event.Payload,
	})
}

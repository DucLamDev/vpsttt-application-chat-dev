"use client";

import { useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createRealtimeGateway, queryKeys, type RealtimeServerEvent } from "@webtui/api-client";
import type { Message as ApiMessage } from "@webtui/types";
import { runtimeEnvironment } from "@/lib/api";
import { useAuthStore } from "@/features/auth/auth-store";
import { useRealtimeStore } from "../stores/realtime-store";
import {
  mergeMessageIntoTimeline,
  messageRoomName,
  removeMessageFromTimeline
} from "./use-message-timeline";

type RealtimeMessagePayload = {
  contact_request?: unknown;
  message?: ApiMessage;
};

export type ChannelRealtimeOptions = {
  channelId: string;
  enabled?: boolean;
  workspaceId: string;
};

export function useChannelRealtime({ channelId, enabled = true, workspaceId }: ChannelRealtimeOptions) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const queryClient = useQueryClient();
  const setConnection = useRealtimeStore((state) => state.setConnection);
  const status = useRealtimeStore((state) => state.status);
  const retryAttempt = useRealtimeStore((state) => state.retryAttempt);
  const lastEventAt = useRealtimeStore((state) => state.lastEventAt);
  const gateway = useMemo(() => createRealtimeGateway(runtimeEnvironment.wsBaseUrl), []);
  const room = workspaceId && channelId ? messageRoomName(workspaceId, channelId) : "";

  useEffect(() => {
    if (!enabled || !workspaceId || !accessToken || typeof WebSocket === "undefined") {
      setConnection({
        retryAttempt: 0,
        room: null,
        status: "idle"
      });
      return undefined;
    }

    const token = accessToken;
    let disposed = false;
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;

    function clearReconnectTimer() {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    }

    function connect() {
      if (disposed) {
        return;
      }

      socket = gateway.connect({
        accessToken: token,
        workspaceId
      });

      setConnection({
        retryAttempt: attempt,
        room: room || null,
        status: attempt > 0 ? "reconnecting" : "connecting"
      });

      socket.addEventListener("open", () => {
        if (!socket || disposed) {
          return;
        }

        attempt = 0;
        if (room) {
          gateway.join(socket, room);
        }
        setConnection({
          retryAttempt: 0,
          room: room || null,
          status: "connected"
        });
      });

      socket.addEventListener("message", (event) => {
        if (disposed) {
          return;
        }

        handleRealtimeMessage(event.data);
      });

      socket.addEventListener("error", () => {
        socket?.close();
      });

      socket.addEventListener("close", () => {
        if (disposed) {
          return;
        }

        attempt += 1;
        const delay = Math.min(15000, 1000 * 2 ** Math.min(attempt, 4));
        setConnection({
          retryAttempt: attempt,
          room: room || null,
          status: "reconnecting"
        });
        reconnectTimer = setTimeout(connect, delay);
      });
    }

    function handleRealtimeMessage(raw: string) {
      const event = parseRealtimeEvent(raw);
      const isChannelEvent = Boolean(room) && (!event?.room || event.room === room);
      const isUserEvent = event?.room?.startsWith("user:");

      if (!event || (!isChannelEvent && !isUserEvent)) {
        return;
      }

      if (
        event.type === "ContactRequestCreated" ||
        event.type === "ContactRequestUpdated" ||
        event.type === "ContactRequestCancelled"
      ) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.contacts.all });
        void queryClient.invalidateQueries({ queryKey: queryKeys.contacts.requests("all") });
        void queryClient.invalidateQueries({ queryKey: queryKeys.contacts.requests("pending") });
        void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.list(workspaceId) });
        void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.list() });
        setConnection({
          lastEventAt: new Date().toISOString(),
          room: room || null,
          status: "connected"
        });
        return;
      }

      const message = event.payload?.message;
      if (!message?.id) {
        return;
      }

      if (event.type === "MessageDeleted") {
        removeMessageFromTimeline(queryClient, workspaceId, channelId, message.id);
      } else if (event.type === "MessageCreated" || event.type === "MessageUpdated" || event.type === "ReactionChanged") {
        mergeMessageIntoTimeline(queryClient, workspaceId, channelId, message);
      } else if (event.type === "MessagePinned" || event.type === "MessageUnpinned") {
        void queryClient.invalidateQueries({ queryKey: queryKeys.messages.pins(workspaceId, channelId) });
      }

      void queryClient.invalidateQueries({ queryKey: queryKeys.channels.directConversations(workspaceId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.channels.all(workspaceId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.list(workspaceId) });

      setConnection({
        lastEventAt: new Date().toISOString(),
        room: room || null,
        status: "connected"
      });
    }

    connect();

    return () => {
      disposed = true;
      clearReconnectTimer();
      if (socket && socket.readyState === WebSocket.OPEN && room) {
        gateway.leave(socket, room);
      }
      socket?.close();
      setConnection({
        retryAttempt: 0,
        room: null,
        status: "offline"
      });
    };
  }, [accessToken, channelId, enabled, gateway, queryClient, room, setConnection, workspaceId]);

  return {
    lastEventAt,
    retryAttempt,
    room,
    status
  };
}

function parseRealtimeEvent(raw: string): RealtimeServerEvent<RealtimeMessagePayload> | null {
  try {
    const parsed = JSON.parse(raw) as RealtimeServerEvent<RealtimeMessagePayload>;

    if (!parsed || typeof parsed.type !== "string") {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

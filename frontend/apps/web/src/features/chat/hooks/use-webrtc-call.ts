"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { StreamVideoClient, type Call } from "@stream-io/video-react-sdk";
import type {
  CallMode,
  CallSignalPayload,
  CallSignalType,
  RealtimeCallSignal
} from "./use-channel-realtime";
import { api } from "@/lib/api";

export type WebRtcCallStatus = "idle" | "incoming" | "outgoing" | "connecting" | "active" | "ended" | "error";

export type WebRtcCallState = {
  callId?: string;
  error?: string;
  initiatorUserId?: string;
  mode: CallMode;
  peerName?: string;
  peerUserId?: string;
  startedAt?: number;
  status: WebRtcCallStatus;
};

export type WebRtcCallOutcome = {
  callId: string;
  direction: "incoming" | "outgoing";
  durationSeconds?: number;
  endedAt: number;
  initiatorUserId: string;
  mode: CallMode;
  reason?: string;
  startedAt?: number;
  status: "completed" | "missed";
};

type UseWebRtcCallOptions = {
  channelId?: string;
  channelName?: string;
  currentUserId: string;
  enabled?: boolean;
  lastSignal: RealtimeCallSignal | null;
  onCallOutcome?: (outcome: WebRtcCallOutcome) => void;
  peerName?: string;
  peerUserId?: string;
  sendSignal: (type: CallSignalType, payload: CallSignalPayload) => boolean;
  workspaceId?: string;
};

const outgoingRingTimeoutMs = 45_000;

export function useWebRtcCall({
  channelId,
  channelName,
  currentUserId,
  enabled = true,
  lastSignal,
  peerName,
  peerUserId,
  workspaceId
}: UseWebRtcCallOptions) {
  const [callState, setCallState] = useState<WebRtcCallState>({ mode: "audio", status: "idle" });
  const [streamClient, setStreamClient] = useState<StreamVideoClient | null>(null);
  const [streamCall, setStreamCall] = useState<Call | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const clientRef = useRef<StreamVideoClient | null>(null);
  const clientUserIdRef = useRef("");
  const callRef = useRef<Call | null>(null);
  const callStateRef = useRef<WebRtcCallState>({ mode: "audio", status: "idle" });
  const lastSignalSequenceRef = useRef(0);
  const previousChannelIdRef = useRef(channelId);
  const operationTokenRef = useRef(0);
  const outgoingRingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

  const clearOutgoingTimer = useCallback(() => {
    if (outgoingRingTimerRef.current) {
      clearTimeout(outgoingRingTimerRef.current);
      outgoingRingTimerRef.current = null;
    }
  }, []);

  const resetCallUi = useCallback(
    (nextState?: WebRtcCallState) => {
      operationTokenRef.current += 1;
      clearOutgoingTimer();
      callRef.current = null;
      setStreamCall(null);
      setIsMuted(false);
      setIsCameraOff(false);
      setCallState(nextState ?? { mode: "audio", status: "idle" });
    },
    [clearOutgoingTimer]
  );

  const leaveStreamCall = useCallback(async (options?: { reject?: boolean; reason?: string }) => {
    const call = callRef.current;
    if (!call) {
      return;
    }
    await call.leave(options).catch(() => undefined);
  }, []);

  const ensureStreamClient = useCallback(async () => {
    const credentials = await api.video.streamToken();
    if (clientRef.current && clientUserIdRef.current === credentials.user_id) {
      return clientRef.current;
    }

    await clientRef.current?.disconnectUser().catch(() => undefined);
    const client = new StreamVideoClient({
      apiKey: credentials.api_key,
      token: credentials.token,
      tokenProvider: async () => {
        const nextCredentials = await api.video.streamToken();
        return nextCredentials.token;
      },
      user: {
        id: credentials.user_id,
        name: credentials.user_id
      }
    });
    clientRef.current = client;
    clientUserIdRef.current = credentials.user_id;
    setStreamClient(client);
    return client;
  }, []);

  const prepareDevices = useCallback(async (call: Call, mode: CallMode) => {
    await call.microphone.enable();
    if (mode === "video") {
      await call.camera.enable();
      setIsCameraOff(false);
    } else {
      await call.camera.disable();
      setIsCameraOff(true);
    }
    setIsMuted(false);
  }, []);

  const joinStreamCall = useCallback(
    async (call: Call, mode: CallMode, options: { ring?: boolean }) => {
      if (!workspaceId || !channelId || !peerUserId) {
        throw new Error("Thiếu thông tin cuộc trò chuyện để bắt đầu cuộc gọi.");
      }
      await call.join({
        create: true,
        data: {
          custom: {
            channel_id: channelId,
            client: "webtui_web",
            provider: "stream_video",
            workspace_id: workspaceId
          },
          members: [{ user_id: currentUserId }, { user_id: peerUserId }],
          video: mode === "video"
        },
        ring: options.ring,
        video: mode === "video"
      });
    },
    [channelId, currentUserId, peerUserId, workspaceId]
  );

  useEffect(() => {
    const channelChanged = previousChannelIdRef.current !== channelId;
    previousChannelIdRef.current = channelId;
    if (channelChanged) {
      lastSignalSequenceRef.current = 0;
    }
    const hasLiveCall = callStateRef.current.status !== "idle" && callStateRef.current.status !== "ended" && callStateRef.current.status !== "error";
    if ((!enabled || channelChanged) && hasLiveCall) {
      void leaveStreamCall({ reason: channelChanged ? "channel_changed" : "disabled" });
      resetCallUi();
    }
  }, [channelId, enabled, leaveStreamCall, resetCallUi]);

  useEffect(() => {
    if (callState.status !== "ended" && callState.status !== "error") {
      return undefined;
    }
    const timeout = window.setTimeout(() => {
      setCallState({ mode: "audio", status: "idle" });
    }, 4_000);
    return () => window.clearTimeout(timeout);
  }, [callState.status]);

  useEffect(
    () => () => {
      clearOutgoingTimer();
      void callRef.current?.leave({ reason: "component_unmounted" }).catch(() => undefined);
      void clientRef.current?.disconnectUser().catch(() => undefined);
      callRef.current = null;
      clientRef.current = null;
    },
    [clearOutgoingTimer]
  );

  const startCall = useCallback(
    async (mode: CallMode) => {
      if (!enabled || !workspaceId || !channelId) {
        setCallState({ error: "Realtime chưa sẵn sàng để bắt đầu cuộc gọi.", mode, status: "error" });
        return;
      }
      if (!peerUserId) {
        setCallState({ error: "Không tìm thấy người nhận cuộc gọi trong hội thoại này.", mode, status: "error" });
        return;
      }
      if (callStateRef.current.status !== "idle" && callStateRef.current.status !== "ended" && callStateRef.current.status !== "error") {
        return;
      }

      const operationToken = ++operationTokenRef.current;
      let backendCallId = "";
      try {
        setCallState({
          initiatorUserId: currentUserId,
          mode,
          peerName: peerName || channelName,
          peerUserId,
          status: "outgoing"
        });
        const backendCall = await api.calls.create(workspaceId, {
          channel_id: channelId,
          client_call_id: newCallId(),
          metadata: {
            client: "web",
            provider: "stream_video"
          },
          mode,
          target_user_id: peerUserId
        });
        backendCallId = backendCall.id;
        if (operationToken !== operationTokenRef.current) {
          return;
        }

        const client = await ensureStreamClient();
        const call = client.call("default", backendCall.id, { reuseInstance: true });
        callRef.current = call;
        setStreamCall(call);
        setCallState({
          callId: backendCall.id,
          initiatorUserId: backendCall.initiator_user_id || currentUserId,
          mode,
          peerName: peerName || channelName,
          peerUserId,
          status: "outgoing"
        });
        await prepareDevices(call, mode);
        await joinStreamCall(call, mode, { ring: true });

        outgoingRingTimerRef.current = setTimeout(() => {
          const current = callStateRef.current;
          if (current.callId !== backendCall.id || current.status !== "outgoing") {
            return;
          }
          void api.calls.cancel(workspaceId, backendCall.id, "no_answer").catch(() => undefined);
          void leaveStreamCall({ reason: "no_answer" });
          resetCallUi({
            callId: backendCall.id,
            error: "Không có phản hồi.",
            initiatorUserId: currentUserId,
            mode,
            peerName: peerName || channelName,
            peerUserId,
            status: "ended"
          });
        }, outgoingRingTimeoutMs);
      } catch (error) {
        if (backendCallId) {
          void api.calls.cancel(workspaceId, backendCallId, "stream_join_failed").catch(() => undefined);
        }
        await leaveStreamCall({ reason: "stream_join_failed" });
        resetCallUi({
          callId: backendCallId || undefined,
          error: callErrorMessage(error),
          initiatorUserId: currentUserId,
          mode,
          peerName: peerName || channelName,
          peerUserId,
          status: "error"
        });
      }
    },
    [
      channelId,
      channelName,
      currentUserId,
      enabled,
      ensureStreamClient,
      joinStreamCall,
      leaveStreamCall,
      peerName,
      peerUserId,
      prepareDevices,
      resetCallUi,
      workspaceId
    ]
  );

  const acceptCall = useCallback(async () => {
    const current = callStateRef.current;
    if (!workspaceId || !current.callId || current.status !== "incoming") {
      return;
    }
    const operationToken = ++operationTokenRef.current;
    try {
      setCallState({ ...current, status: "connecting" });
      const client = await ensureStreamClient();
      const call = client.call("default", current.callId, { reuseInstance: true });
      callRef.current = call;
      setStreamCall(call);
      await prepareDevices(call, current.mode);
      await joinStreamCall(call, current.mode, { ring: false });
      if (operationToken !== operationTokenRef.current) {
        return;
      }
      await api.calls.accept(workspaceId, current.callId).catch(() => undefined);
      setCallState({
        ...current,
        startedAt: current.startedAt ?? Date.now(),
        status: "active"
      });
    } catch (error) {
      await api.calls.reject(workspaceId, current.callId, "stream_join_failed").catch(() => undefined);
      await leaveStreamCall({ reject: true, reason: "stream_join_failed" });
      resetCallUi({
        ...current,
        error: callErrorMessage(error),
        status: "error"
      });
    }
  }, [ensureStreamClient, joinStreamCall, leaveStreamCall, prepareDevices, resetCallUi, workspaceId]);

  const rejectCall = useCallback(() => {
    const current = callStateRef.current;
    if (workspaceId && current.callId) {
      void api.calls.reject(workspaceId, current.callId, "declined").catch(() => undefined);
    }
    void leaveStreamCall({ reject: true, reason: "declined" });
    resetCallUi();
  }, [leaveStreamCall, resetCallUi, workspaceId]);

  const endCall = useCallback(() => {
    const current = callStateRef.current;
    if (workspaceId && current.callId) {
      if (current.status === "outgoing") {
        void api.calls.cancel(workspaceId, current.callId, "cancelled").catch(() => undefined);
      } else if (current.status === "active") {
        void api.calls.hangup(workspaceId, current.callId, "ended").catch(() => undefined);
      } else if (current.status === "incoming") {
        void api.calls.reject(workspaceId, current.callId, "declined").catch(() => undefined);
      } else {
        void api.calls.hangup(workspaceId, current.callId, "ended").catch(() =>
          api.calls.cancel(workspaceId, current.callId as string, "cancelled").catch(() => undefined)
        );
      }
    }
    void leaveStreamCall({ reason: "ended" });
    resetCallUi({
      callId: current.callId,
      initiatorUserId: current.initiatorUserId,
      mode: current.mode,
      peerName: current.peerName,
      peerUserId: current.peerUserId,
      status: "ended"
    });
  }, [leaveStreamCall, resetCallUi, workspaceId]);

  const toggleMute = useCallback(() => {
    const call = callRef.current;
    if (!call) {
      return;
    }
    void call.microphone.toggle().then(() => {
      setIsMuted(!call.microphone.enabled);
    });
  }, []);

  const toggleCamera = useCallback(() => {
    const call = callRef.current;
    if (!call) {
      return;
    }
    void call.camera.toggle().then(() => {
      setIsCameraOff(!call.camera.enabled);
    });
  }, []);

  useEffect(() => {
    if (!lastSignal) {
      return;
    }
    if (!enabled || !workspaceId || !channelId) {
      lastSignalSequenceRef.current = Math.max(lastSignalSequenceRef.current, lastSignal.sequence);
      return;
    }
    if (lastSignal.payload.channel_id && lastSignal.payload.channel_id !== channelId) {
      return;
    }
    if (lastSignal.sequence <= lastSignalSequenceRef.current) {
      return;
    }
    lastSignalSequenceRef.current = lastSignal.sequence;

    const payload = lastSignal.payload;
    const callId = payload.call_id;
    const mode = payload.mode ?? callStateRef.current.mode ?? "audio";
    const signalWorkspaceId = payload.workspace_id || workspaceId;

    if (lastSignal.type === "CallInvited") {
      if (payload.target_user_id && payload.target_user_id !== currentUserId) {
        return;
      }
      const busy = callStateRef.current.status !== "idle" && callStateRef.current.status !== "ended" && callStateRef.current.status !== "error";
      if (busy) {
        void api.calls.reject(signalWorkspaceId, callId, "busy").catch(() => undefined);
        return;
      }
      setCallState({
        callId,
        initiatorUserId: payload.initiator_user_id || lastSignal.userId,
        mode,
        peerName: peerName || channelName,
        peerUserId: payload.initiator_user_id || lastSignal.userId,
        status: "incoming"
      });
      return;
    }

    if (callStateRef.current.callId !== callId) {
      return;
    }

    if (lastSignal.type === "CallAccepted") {
      clearOutgoingTimer();
      setCallState((current) => ({
        ...current,
        startedAt: current.startedAt ?? Date.now(),
        status: "active"
      }));
      return;
    }

    if (lastSignal.type === "CallRejected") {
      resetCallUi({
        callId,
        error: rejectionMessage(payload.reason),
        mode,
        peerName: callStateRef.current.peerName,
        peerUserId: callStateRef.current.peerUserId,
        status: "ended"
      });
      return;
    }

    if (lastSignal.type === "CallCancelled" || lastSignal.type === "CallMissed") {
      void leaveStreamCall({ reason: payload.reason || "cancelled" });
      resetCallUi({
        callId,
        error: lastSignal.type === "CallMissed" ? "Cuộc gọi bị nhỡ." : "Cuộc gọi đã bị hủy.",
        mode,
        peerName: callStateRef.current.peerName,
        peerUserId: callStateRef.current.peerUserId,
        status: "ended"
      });
      return;
    }

    if (lastSignal.type === "CallEnded") {
      void leaveStreamCall({ reason: payload.reason || "ended" });
      resetCallUi({
        callId,
        mode,
        peerName: callStateRef.current.peerName,
        peerUserId: callStateRef.current.peerUserId,
        status: "ended"
      });
    }
  }, [
    channelId,
    channelName,
    clearOutgoingTimer,
    currentUserId,
    enabled,
    lastSignal,
    leaveStreamCall,
    peerName,
    resetCallUi,
    workspaceId
  ]);

  return {
    acceptCall,
    callState,
    endCall,
    isCameraOff,
    isMuted,
    localStream: null as MediaStream | null,
    rejectCall,
    remoteStream: null as MediaStream | null,
    startCall,
    streamCall,
    streamClient,
    toggleCamera,
    toggleMute
  };
}

function newCallId(): string {
  return `call-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function rejectionMessage(reason: string | undefined): string {
  if (reason === "busy") {
    return "Người nhận đang bận trong cuộc gọi khác.";
  }
  if (reason === "declined") {
    return "Người nhận đã từ chối cuộc gọi.";
  }
  return "Cuộc gọi đã kết thúc.";
}

function callErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    if (/timeout/i.test(error.message)) {
      return "Kết nối Stream Video quá lâu. Hãy kiểm tra STREAM_VIDEO_API_KEY, STREAM_VIDEO_API_SECRET trên VPS và mạng thiết bị.";
    }
    return error.message;
  }
  return "Không thể bắt đầu cuộc gọi.";
}

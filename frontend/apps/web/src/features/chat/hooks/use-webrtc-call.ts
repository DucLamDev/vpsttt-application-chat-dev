"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

type ZegoUIKitPrebuiltStatic = {
  OneONoneCall: unknown;
  create: (kitToken: string) => ZegoPrebuiltInstance;
  generateKitTokenForProduction: (
    appID: number,
    token: string,
    roomID: string,
    userID: string,
    userName: string
  ) => string;
};

type ZegoPrebuiltInstance = {
  destroy?: () => void;
  joinRoom: (config: Record<string, unknown>) => void;
  leaveRoom?: () => void;
};

const outgoingRingTimeoutMs = 45_000;
const zegoContainerWaitTimeoutMs = 4_000;

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
  const [hasZegoCall, setHasZegoCall] = useState(false);
  const zegoContainerRef = useRef<HTMLDivElement | null>(null);
  const zegoInstanceRef = useRef<ZegoPrebuiltInstance | null>(null);
  const zegoUIKitRef = useRef<ZegoUIKitPrebuiltStatic | null>(null);
  const suppressZegoLeaveRef = useRef(false);
  const activeZegoCallIdRef = useRef("");
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

  const leaveZegoRoom = useCallback(() => {
    const instance = zegoInstanceRef.current;
    zegoInstanceRef.current = null;
    activeZegoCallIdRef.current = "";
    suppressZegoLeaveRef.current = true;
    try {
      instance?.leaveRoom?.();
      instance?.destroy?.();
      zegoContainerRef.current?.replaceChildren();
      setHasZegoCall(false);
    } finally {
      window.setTimeout(() => {
        suppressZegoLeaveRef.current = false;
      }, 0);
    }
  }, []);

  const resetCallUi = useCallback(
    (nextState?: WebRtcCallState) => {
      operationTokenRef.current += 1;
      clearOutgoingTimer();
      leaveZegoRoom();
      setCallState(nextState ?? { mode: "audio", status: "idle" });
    },
    [clearOutgoingTimer, leaveZegoRoom]
  );

  const loadZegoUIKit = useCallback(async () => {
    if (zegoUIKitRef.current) {
      return zegoUIKitRef.current;
    }
    const module = (await import("@zegocloud/zego-uikit-prebuilt")) as {
      ZegoUIKitPrebuilt?: ZegoUIKitPrebuiltStatic;
    };
    if (!module.ZegoUIKitPrebuilt) {
      throw new Error("Không tải được ZEGOCLOUD Call Kit.");
    }
    zegoUIKitRef.current = module.ZegoUIKitPrebuilt;
    return module.ZegoUIKitPrebuilt;
  }, []);

  const waitForZegoContainer = useCallback(async () => {
    const startedAt = Date.now();
    while (!zegoContainerRef.current) {
      if (Date.now() - startedAt > zegoContainerWaitTimeoutMs) {
        throw new Error("Không tìm thấy khung hiển thị ZEGOCLOUD.");
      }
      await delay(50);
    }
    return zegoContainerRef.current;
  }, []);

  const joinZegoRoom = useCallback(
    async (callId: string, mode: CallMode) => {
      if (activeZegoCallIdRef.current === callId && zegoInstanceRef.current) {
        return;
      }

      leaveZegoRoom();
      setHasZegoCall(true);
      const [credentials, zegoUIKit, container] = await Promise.all([
        api.video.zegoToken(),
        loadZegoUIKit(),
        waitForZegoContainer()
      ]);
      const roomID = zegoCallIDFromBackendCallID(callId);
      const userName = credentials.user_name?.trim() || credentials.user_id;
      const kitToken = zegoUIKit.generateKitTokenForProduction(
        credentials.app_id,
        credentials.token,
        roomID,
        credentials.user_id,
        userName
      );
      const instance = zegoUIKit.create(kitToken);
      zegoInstanceRef.current = instance;
      activeZegoCallIdRef.current = callId;
      container.replaceChildren();
      instance.joinRoom({
        container,
        layout: "Auto",
        maxUsers: 2,
        scenario: {
          mode: zegoUIKit.OneONoneCall
        },
        sharedLinks: [],
        showAudioVideoSettingsButton: true,
        showLeavingView: false,
        showMyCameraToggleButton: mode === "video",
        showMyMicrophoneToggleButton: true,
        showPreJoinView: false,
        showRoomDetailsButton: false,
        showScreenSharingButton: false,
        showTextChat: false,
        showUserList: false,
        turnOnCameraWhenJoining: mode === "video",
        turnOnMicrophoneWhenJoining: true,
        onLeaveRoom: () => {
          if (suppressZegoLeaveRef.current) {
            return;
          }
          const current = callStateRef.current;
          if (current.callId && workspaceId && current.status !== "idle" && current.status !== "ended" && current.status !== "error") {
            if (current.status === "outgoing") {
              void api.calls.cancel(workspaceId, current.callId, "zego_left").catch(() => undefined);
            } else if (current.status === "incoming") {
              void api.calls.reject(workspaceId, current.callId, "declined").catch(() => undefined);
            } else {
              void api.calls.hangup(workspaceId, current.callId, "zego_left").catch(() => undefined);
            }
          }
          resetCallUi({
            callId: current.callId,
            initiatorUserId: current.initiatorUserId,
            mode: current.mode,
            peerName: current.peerName,
            peerUserId: current.peerUserId,
            status: "ended"
          });
        }
      });
    },
    [leaveZegoRoom, loadZegoUIKit, resetCallUi, waitForZegoContainer, workspaceId]
  );

  useEffect(() => {
    const channelChanged = previousChannelIdRef.current !== channelId;
    previousChannelIdRef.current = channelId;
    if (channelChanged) {
      lastSignalSequenceRef.current = 0;
    }
    const hasLiveCall = callStateRef.current.status !== "idle" && callStateRef.current.status !== "ended" && callStateRef.current.status !== "error";
    if ((!enabled || channelChanged) && hasLiveCall) {
      resetCallUi();
    }
  }, [channelId, enabled, resetCallUi]);

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
      leaveZegoRoom();
    },
    [clearOutgoingTimer, leaveZegoRoom]
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
            provider: "zegocloud"
          },
          mode,
          target_user_id: peerUserId
        });
        backendCallId = backendCall.id;
        if (operationToken !== operationTokenRef.current) {
          return;
        }

        setCallState({
          callId: backendCall.id,
          initiatorUserId: backendCall.initiator_user_id || currentUserId,
          mode,
          peerName: peerName || channelName,
          peerUserId,
          status: "outgoing"
        });
        await joinZegoRoom(backendCall.id, mode);

        outgoingRingTimerRef.current = setTimeout(() => {
          const current = callStateRef.current;
          if (current.callId !== backendCall.id || current.status !== "outgoing") {
            return;
          }
          void api.calls.cancel(workspaceId, backendCall.id, "no_answer").catch(() => undefined);
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
          void api.calls.cancel(workspaceId, backendCallId, "zego_join_failed").catch(() => undefined);
        }
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
      joinZegoRoom,
      peerName,
      peerUserId,
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
      await joinZegoRoom(current.callId, current.mode);
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
      await api.calls.reject(workspaceId, current.callId, "zego_join_failed").catch(() => undefined);
      resetCallUi({
        ...current,
        error: callErrorMessage(error),
        status: "error"
      });
    }
  }, [joinZegoRoom, resetCallUi, workspaceId]);

  const rejectCall = useCallback(() => {
    const current = callStateRef.current;
    if (workspaceId && current.callId) {
      void api.calls.reject(workspaceId, current.callId, "declined").catch(() => undefined);
    }
    resetCallUi();
  }, [resetCallUi, workspaceId]);

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
    resetCallUi({
      callId: current.callId,
      initiatorUserId: current.initiatorUserId,
      mode: current.mode,
      peerName: current.peerName,
      peerUserId: current.peerUserId,
      status: "ended"
    });
  }, [resetCallUi, workspaceId]);

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
    peerName,
    resetCallUi,
    workspaceId
  ]);

  return {
    acceptCall,
    callState,
    endCall,
    hasZegoCall,
    rejectCall,
    startCall,
    zegoContainerRef
  };
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}

function newCallId(): string {
  return `call-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function zegoCallIDFromBackendCallID(callId: string): string {
  const normalized = callId.trim().replace(/[^A-Za-z0-9_]/g, "_");
  return normalized || newCallId().replace(/[^A-Za-z0-9_]/g, "_");
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
      return "Kết nối ZEGOCLOUD quá lâu. Hãy kiểm tra ZEGO_APP_ID, ZEGO_APP_SIGN, ZEGO_SERVER_SECRET trên VPS và mạng thiết bị.";
    }
    return error.message;
  }
  return "Không thể bắt đầu cuộc gọi.";
}

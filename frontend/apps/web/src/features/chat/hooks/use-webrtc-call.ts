"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  CallMode,
  CallSignalPayload,
  CallSignalType,
  RealtimeCallSignal
} from "./use-channel-realtime";

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
};

const rtcConfig: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};
const outgoingRingTimeoutMs = 30_000;

export function useWebRtcCall({
  channelId,
  channelName,
  currentUserId,
  enabled = true,
  lastSignal,
  onCallOutcome,
  peerName,
  peerUserId,
  sendSignal
}: UseWebRtcCallOptions) {
  const [callState, setCallState] = useState<WebRtcCallState>({ mode: "audio", status: "idle" });
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const pendingOfferRef = useRef<RealtimeCallSignal | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const lastSignalSequenceRef = useRef(0);
  const loggedOutcomeKeyRef = useRef("");
  const outgoingRingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callStateRef = useRef<WebRtcCallState>({ mode: "audio", status: "idle" });

  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

  const cleanup = useCallback((nextState?: WebRtcCallState) => {
    if (outgoingRingTimerRef.current) {
      clearTimeout(outgoingRingTimerRef.current);
      outgoingRingTimerRef.current = null;
    }
    peerRef.current?.close();
    peerRef.current = null;
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    remoteStreamRef.current = null;
    pendingOfferRef.current = null;
    pendingCandidatesRef.current = [];
    setLocalStream(null);
    setRemoteStream(null);
    setIsMuted(false);
    setIsCameraOff(false);
    setCallState(nextState ?? { mode: "audio", status: "idle" });
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  useEffect(() => {
    if (callState.status !== "ended" && callState.status !== "error") {
      return undefined;
    }
    const timeout = window.setTimeout(() => {
      setCallState({ mode: "audio", status: "idle" });
    }, 4_000);
    return () => window.clearTimeout(timeout);
  }, [callState.status]);

  const publish = useCallback(
    (type: CallSignalType, payload: Omit<CallSignalPayload, "channel_id">) => {
      if (!channelId) {
        return false;
      }
      const targetUserId = payload.target_user_id ?? callStateRef.current.peerUserId ?? peerUserId;
      return sendSignal(type, {
        ...payload,
        channel_id: channelId,
        target_user_id: targetUserId
      });
    },
    [channelId, peerUserId, sendSignal]
  );

  const emitOutcome = useCallback(
    (outcome: WebRtcCallOutcome) => {
      const key = `${outcome.callId}:${outcome.status}`;
      if (loggedOutcomeKeyRef.current === key) {
        return;
      }
      loggedOutcomeKeyRef.current = key;
      onCallOutcome?.(outcome);
    },
    [onCallOutcome]
  );

  const createPeer = useCallback(
    (callId: string, mode: CallMode) => {
      const peer = new RTCPeerConnection(rtcConfig);
      peer.onicecandidate = (event) => {
        if (event.candidate) {
          publish("CallIceCandidate", {
            call_id: callId,
            candidate: event.candidate.toJSON(),
            mode
          });
        }
      };
      peer.ontrack = (event) => {
        let stream = remoteStreamRef.current;
        if (!stream) {
          stream = new MediaStream();
          remoteStreamRef.current = stream;
        }
        for (const track of event.streams[0]?.getTracks() ?? [event.track]) {
          if (!stream.getTracks().some((current) => current.id === track.id)) {
            stream.addTrack(track);
          }
        }
        setRemoteStream(new MediaStream(stream.getTracks()));
        setCallState((current) =>
          current.callId === callId && current.status !== "ended" && current.status !== "error"
            ? { ...current, startedAt: current.startedAt ?? Date.now(), status: "active" }
            : current
        );
      };
      peer.onconnectionstatechange = () => {
        if (peer.connectionState === "connected") {
          setCallState((current) =>
            current.callId === callId ? { ...current, startedAt: current.startedAt ?? Date.now(), status: "active" } : current
          );
        }
        if (peer.connectionState === "failed" || peer.connectionState === "disconnected") {
          setCallState((current) =>
            current.callId === callId ? { ...current, error: "Kết nối cuộc gọi bị gián đoạn.", status: "error" } : current
          );
        }
      };
      peerRef.current = peer;
      return peer;
    },
    [publish]
  );

  const openLocalMedia = useCallback(async (mode: CallMode) => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      throw new Error("Thiết bị hiện tại không hỗ trợ camera/micro.");
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: mode === "video" ? { facingMode: "user", height: { ideal: 720 }, width: { ideal: 1280 } } : false
    });
    localStreamRef.current = stream;
    setLocalStream(stream);
    setIsMuted(false);
    setIsCameraOff(false);
    return stream;
  }, []);

  const attachLocalTracks = useCallback((peer: RTCPeerConnection, stream: MediaStream) => {
    stream.getTracks().forEach((track) => peer.addTrack(track, stream));
  }, []);

  const flushPendingCandidates = useCallback(async () => {
    const peer = peerRef.current;
    if (!peer?.remoteDescription) {
      return;
    }
    const candidates = pendingCandidatesRef.current.splice(0);
    for (const candidate of candidates) {
      await peer.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => undefined);
    }
  }, []);

  const startCall = useCallback(
    async (mode: CallMode) => {
      if (!enabled || !channelId) {
        setCallState({ error: "Realtime chưa sẵn sàng để bắt đầu cuộc gọi.", mode, status: "error" });
        return;
      }
      if (callStateRef.current.status !== "idle" && callStateRef.current.status !== "ended" && callStateRef.current.status !== "error") {
        return;
      }
      const callId = newCallId();
      try {
        loggedOutcomeKeyRef.current = "";
        const ringStartedAt = Date.now();
        setCallState({ callId, initiatorUserId: currentUserId, mode, peerName: peerName || channelName, status: "outgoing" });
        const stream = await openLocalMedia(mode);
        const peer = createPeer(callId, mode);
        attachLocalTracks(peer, stream);
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        publish("CallOffer", {
          call_id: callId,
          mode,
          sdp: toSessionDescriptionInit(peer.localDescription, offer)
        });
        outgoingRingTimerRef.current = setTimeout(() => {
          const current = callStateRef.current;
          if (current.callId !== callId || current.status !== "outgoing") {
            return;
          }
          publish("CallEnded", {
            call_id: callId,
            mode,
            reason: "missed"
          });
          emitOutcome({
            callId,
            direction: "outgoing",
            endedAt: Date.now(),
            initiatorUserId: currentUserId,
            mode,
            reason: "no-answer",
            startedAt: ringStartedAt,
            status: "missed"
          });
          cleanup({ callId, error: "Không có phản hồi.", initiatorUserId: currentUserId, mode, status: "ended" });
        }, outgoingRingTimeoutMs);
      } catch (error) {
        cleanup({
          callId,
          error: error instanceof Error ? error.message : "Không bắt đầu được cuộc gọi.",
          initiatorUserId: currentUserId,
          mode,
          status: "error"
        });
      }
    },
    [attachLocalTracks, channelId, channelName, cleanup, createPeer, currentUserId, emitOutcome, enabled, openLocalMedia, peerName, publish]
  );

  const acceptCall = useCallback(async () => {
    const signal = pendingOfferRef.current;
    const offer = signal?.payload.sdp;
    if (!signal || !offer) {
      return;
    }
    const callId = signal.payload.call_id;
    const mode = signal.payload.mode ?? "audio";
    try {
      loggedOutcomeKeyRef.current = "";
      setCallState({ callId, initiatorUserId: signal.userId, mode, peerName: peerName || channelName, peerUserId: signal.userId, status: "connecting" });
      const stream = await openLocalMedia(mode);
      const peer = createPeer(callId, mode);
      attachLocalTracks(peer, stream);
      await peer.setRemoteDescription(new RTCSessionDescription(offer));
      await flushPendingCandidates();
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      publish("CallAnswer", {
        call_id: callId,
        mode,
        sdp: toSessionDescriptionInit(peer.localDescription, answer)
      });
      pendingOfferRef.current = null;
    } catch (error) {
      publish("CallRejected", { call_id: callId, mode, reason: "media-error" });
      cleanup({
        callId,
        error: error instanceof Error ? error.message : "Không tham gia được cuộc gọi.",
        initiatorUserId: signal.userId,
        mode,
        status: "error"
      });
    }
  }, [attachLocalTracks, channelName, cleanup, createPeer, flushPendingCandidates, openLocalMedia, peerName, publish]);

  const rejectCall = useCallback(() => {
    const signal = pendingOfferRef.current;
    if (signal) {
      publish("CallRejected", {
        call_id: signal.payload.call_id,
        mode: signal.payload.mode ?? "audio",
        reason: "declined"
      });
    }
    cleanup();
  }, [cleanup, publish]);

  const endCall = useCallback(() => {
    const current = callStateRef.current;
    if (current.callId && current.status !== "idle") {
      publish("CallEnded", {
        call_id: current.callId,
        mode: current.mode,
        reason: current.status === "active" ? "ended" : "missed"
      });
      emitOutcome({
        callId: current.callId,
        direction: current.initiatorUserId === currentUserId ? "outgoing" : "incoming",
        durationSeconds: current.status === "active" ? Math.max(1, Math.round((Date.now() - (current.startedAt ?? Date.now())) / 1000)) : 0,
        endedAt: Date.now(),
        initiatorUserId: current.initiatorUserId || currentUserId,
        mode: current.mode,
        reason: current.status === "active" ? "ended" : "cancelled",
        startedAt: current.startedAt,
        status: current.status === "active" ? "completed" : "missed"
      });
    }
    cleanup({ callId: current.callId, initiatorUserId: current.initiatorUserId, mode: current.mode, status: "ended" });
  }, [cleanup, currentUserId, emitOutcome, publish]);

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) {
      return;
    }
    const nextMuted = !isMuted;
    stream.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted;
    });
    setIsMuted(nextMuted);
  }, [isMuted]);

  const toggleCamera = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) {
      return;
    }
    const nextOff = !isCameraOff;
    stream.getVideoTracks().forEach((track) => {
      track.enabled = !nextOff;
    });
    setIsCameraOff(nextOff);
  }, [isCameraOff]);

  useEffect(() => {
    if (!lastSignal || lastSignal.sequence <= lastSignalSequenceRef.current) {
      return;
    }
    lastSignalSequenceRef.current = lastSignal.sequence;
    if (lastSignal.payload.channel_id && channelId && lastSignal.payload.channel_id !== channelId) {
      return;
    }

    const handleSignal = async () => {
      const payload = lastSignal.payload;
      const callId = payload.call_id;
      const mode = payload.mode ?? callStateRef.current.mode ?? "audio";

      if (lastSignal.type === "CallOffer") {
        const busy = callStateRef.current.status !== "idle" && callStateRef.current.status !== "ended" && callStateRef.current.status !== "error";
        if (busy) {
          publish("CallRejected", { call_id: callId, mode, reason: "busy" });
          return;
        }
        pendingOfferRef.current = lastSignal;
        setCallState({
          callId,
          initiatorUserId: lastSignal.userId,
          mode,
          peerName: peerName || channelName,
          peerUserId: lastSignal.userId,
          status: "incoming"
        });
        return;
      }

      if (callStateRef.current.callId !== callId) {
        return;
      }

      if (lastSignal.type === "CallAnswer" && payload.sdp && peerRef.current) {
        if (outgoingRingTimerRef.current) {
          clearTimeout(outgoingRingTimerRef.current);
          outgoingRingTimerRef.current = null;
        }
        await peerRef.current.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        await flushPendingCandidates();
        setCallState((current) => ({ ...current, startedAt: current.startedAt ?? Date.now(), status: "active" }));
        return;
      }

      if (lastSignal.type === "CallIceCandidate" && payload.candidate) {
        if (peerRef.current?.remoteDescription) {
          await peerRef.current.addIceCandidate(new RTCIceCandidate(payload.candidate)).catch(() => undefined);
        } else {
          pendingCandidatesRef.current.push(payload.candidate);
        }
        return;
      }

      if (lastSignal.type === "CallRejected") {
        const current = callStateRef.current;
        if (current.initiatorUserId === currentUserId) {
          emitOutcome({
            callId,
            direction: "outgoing",
            durationSeconds: 0,
            endedAt: Date.now(),
            initiatorUserId: currentUserId,
            mode,
            reason: payload.reason,
            startedAt: current.startedAt,
            status: "missed"
          });
        }
        cleanup({ callId, error: rejectionMessage(payload.reason), mode, status: "ended" });
        return;
      }

      if (lastSignal.type === "CallEnded") {
        cleanup({ callId, mode, status: "ended" });
      }
    };

    void handleSignal();
  }, [channelId, channelName, cleanup, currentUserId, emitOutcome, flushPendingCandidates, lastSignal, peerName, publish]);

  return {
    acceptCall,
    callState,
    endCall,
    isCameraOff,
    isMuted,
    localStream,
    rejectCall,
    remoteStream,
    startCall,
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

function toSessionDescriptionInit(
  description: RTCSessionDescription | null,
  fallback: RTCSessionDescriptionInit
): RTCSessionDescriptionInit {
  return description ? { sdp: description.sdp, type: description.type } : fallback;
}

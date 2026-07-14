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
  mode: CallMode;
  peerName?: string;
  peerUserId?: string;
  startedAt?: number;
  status: WebRtcCallStatus;
};

type UseWebRtcCallOptions = {
  channelId?: string;
  channelName?: string;
  enabled?: boolean;
  lastSignal: RealtimeCallSignal | null;
  peerName?: string;
  sendSignal: (type: CallSignalType, payload: CallSignalPayload) => boolean;
};

const rtcConfig: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

export function useWebRtcCall({
  channelId,
  channelName,
  enabled = true,
  lastSignal,
  peerName,
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
  const callStateRef = useRef<WebRtcCallState>({ mode: "audio", status: "idle" });

  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

  const cleanup = useCallback((nextState?: WebRtcCallState) => {
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
      return sendSignal(type, {
        ...payload,
        channel_id: channelId
      });
    },
    [channelId, sendSignal]
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
            current.callId === callId ? { ...current, error: "Ket noi cuoc goi bi gian doan.", status: "error" } : current
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
      throw new Error("Thiet bi hien tai khong ho tro camera/micro.");
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
        setCallState({ error: "Realtime chua san sang de bat dau cuoc goi.", mode, status: "error" });
        return;
      }
      if (callStateRef.current.status !== "idle" && callStateRef.current.status !== "ended" && callStateRef.current.status !== "error") {
        return;
      }
      const callId = newCallId();
      try {
        setCallState({ callId, mode, peerName: peerName || channelName, status: "outgoing" });
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
      } catch (error) {
        cleanup({
          callId,
          error: error instanceof Error ? error.message : "Khong bat dau duoc cuoc goi.",
          mode,
          status: "error"
        });
      }
    },
    [attachLocalTracks, channelId, channelName, cleanup, createPeer, enabled, openLocalMedia, peerName, publish]
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
      setCallState({ callId, mode, peerName: peerName || channelName, peerUserId: signal.userId, status: "connecting" });
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
        error: error instanceof Error ? error.message : "Khong tham gia duoc cuoc goi.",
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
        reason: "ended"
      });
    }
    cleanup({ mode: current.mode, status: "ended" });
  }, [cleanup, publish]);

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
        cleanup({ callId, error: rejectionMessage(payload.reason), mode, status: "ended" });
        return;
      }

      if (lastSignal.type === "CallEnded") {
        cleanup({ callId, mode, status: "ended" });
      }
    };

    void handleSignal();
  }, [channelId, channelName, cleanup, flushPendingCandidates, lastSignal, peerName, publish]);

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
    return "Nguoi nhan dang ban trong cuoc goi khac.";
  }
  if (reason === "declined") {
    return "Nguoi nhan da tu choi cuoc goi.";
  }
  return "Cuoc goi da ket thuc.";
}

function toSessionDescriptionInit(
  description: RTCSessionDescription | null,
  fallback: RTCSessionDescriptionInit
): RTCSessionDescriptionInit {
  return description ? { sdp: description.sdp, type: description.type } : fallback;
}

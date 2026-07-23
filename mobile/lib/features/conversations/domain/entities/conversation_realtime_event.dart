import 'call_session.dart';
import 'chat_message.dart';

enum ConversationRealtimeEventType {
  messageCreated,
  messageUpdated,
  messageDeleted,
  messagePinned,
  messageUnpinned,
  reactionChanged,
  attachmentCreated,
  typingStarted,
  typingStopped,
  callInvited,
  callAccepted,
  callRejected,
  callCancelled,
  callEnded,
  callMissed,
  unknown,
}

final class ConversationRealtimeEvent {
  const ConversationRealtimeEvent({
    required this.type,
    required this.workspaceId,
    required this.channelId,
    this.message,
    this.messageId,
    this.userId,
    this.timestamp,
    this.callId,
    this.callMode,
    this.callStatus,
    this.callInitiatorUserId,
    this.callTargetUserId,
    this.reason,
  });

  final ConversationRealtimeEventType type;
  final String workspaceId;
  final String channelId;
  final ChatMessage? message;
  final String? messageId;
  final String? userId;
  final DateTime? timestamp;
  final String? callId;
  final CallMode? callMode;
  final CallStatus? callStatus;
  final String? callInitiatorUserId;
  final String? callTargetUserId;
  final String? reason;

  bool get isCallEvent => switch (type) {
    ConversationRealtimeEventType.callInvited ||
    ConversationRealtimeEventType.callAccepted ||
    ConversationRealtimeEventType.callRejected ||
    ConversationRealtimeEventType.callCancelled ||
    ConversationRealtimeEventType.callEnded ||
    ConversationRealtimeEventType.callMissed => true,
    _ => false,
  };

  bool belongsTo({required String workspaceId, required String channelId}) {
    return this.workspaceId == workspaceId && this.channelId == channelId;
  }
}

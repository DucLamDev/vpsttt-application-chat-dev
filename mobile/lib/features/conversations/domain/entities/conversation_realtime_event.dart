import 'chat_message.dart';

enum ConversationRealtimeEventType {
  messageCreated,
  messageUpdated,
  messageDeleted,
  messagePinned,
  messageUnpinned,
  reactionChanged,
  typingStarted,
  typingStopped,
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
  });

  final ConversationRealtimeEventType type;
  final String workspaceId;
  final String channelId;
  final ChatMessage? message;
  final String? messageId;
  final String? userId;
  final DateTime? timestamp;

  bool belongsTo({required String workspaceId, required String channelId}) {
    return this.workspaceId == workspaceId && this.channelId == channelId;
  }
}

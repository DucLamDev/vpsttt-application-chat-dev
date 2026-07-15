final class ChatMessage {
  const ChatMessage({
    required this.id,
    required this.workspaceId,
    required this.channelId,
    required this.kind,
    required this.body,
    required this.createdAt,
    this.senderId,
    this.parentId,
    this.threadRootId,
    this.editedAt,
    this.deletedAt,
    this.reactions = const [],
    this.isMine = false,
  });

  final String id;
  final String workspaceId;
  final String channelId;
  final String kind;
  final String body;
  final DateTime createdAt;
  final String? senderId;
  final String? parentId;
  final String? threadRootId;
  final DateTime? editedAt;
  final DateTime? deletedAt;
  final List<MessageReactionSummary> reactions;
  final bool isMine;

  bool get isDeleted => deletedAt != null;
  bool get isSystem => kind == 'system' || senderId == null;

  ChatMessage copyWith({bool? isMine}) {
    return ChatMessage(
      id: id,
      workspaceId: workspaceId,
      channelId: channelId,
      kind: kind,
      body: body,
      createdAt: createdAt,
      senderId: senderId,
      parentId: parentId,
      threadRootId: threadRootId,
      editedAt: editedAt,
      deletedAt: deletedAt,
      reactions: reactions,
      isMine: isMine ?? this.isMine,
    );
  }
}

final class MessageReactionSummary {
  const MessageReactionSummary({
    required this.emoji,
    required this.count,
    required this.reactedByMe,
  });

  final String emoji;
  final int count;
  final bool reactedByMe;
}

final class ChannelMember {
  const ChannelMember({
    required this.channelId,
    required this.userId,
    required this.email,
    required this.username,
    required this.displayName,
    required this.status,
    required this.joinedAt,
    this.lastReadMessageId,
  });

  final String channelId;
  final String userId;
  final String email;
  final String username;
  final String displayName;
  final String status;
  final DateTime joinedAt;
  final String? lastReadMessageId;
}

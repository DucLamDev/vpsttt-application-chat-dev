enum ConversationKind { direct, channel }

enum ChannelVisibility { public, private, direct }

enum MembershipStatus { active, muted, invited, left, removed, none }

final class ConversationSummary {
  const ConversationSummary({
    required this.id,
    required this.workspaceId,
    required this.channelId,
    required this.kind,
    required this.title,
    required this.preview,
    required this.updatedAt,
    this.avatarLabel,
    this.unreadCount = 0,
    this.favorite = false,
    this.muted = false,
    this.memberCount = 0,
    this.participantIds = const [],
    this.channelVisibility = ChannelVisibility.public,
    this.membershipStatus = MembershipStatus.none,
    this.canManage = false,
    this.privateSessionMode = false,
  });

  final String id;
  final String workspaceId;
  final String channelId;
  final ConversationKind kind;
  final String title;
  final String preview;
  final String? avatarLabel;
  final DateTime updatedAt;
  final int unreadCount;
  final bool favorite;
  final bool muted;
  final int memberCount;
  final List<String> participantIds;
  final ChannelVisibility channelVisibility;
  final MembershipStatus membershipStatus;
  final bool canManage;
  final bool privateSessionMode;

  bool get isUnread => unreadCount > 0;
  bool get isMember =>
      membershipStatus == MembershipStatus.active ||
      membershipStatus == MembershipStatus.muted;
}

final class ConversationHomeData {
  const ConversationHomeData({
    required this.workspaceId,
    required this.conversations,
    required this.channels,
    required this.contacts,
    required this.workspaceMembers,
    this.contactsErrorMessage,
    this.membersErrorMessage,
  });

  final String workspaceId;
  final List<ConversationSummary> conversations;
  final List<ConversationSummary> channels;
  final List<ContactSummary> contacts;
  final List<ContactSummary> workspaceMembers;
  final String? contactsErrorMessage;
  final String? membersErrorMessage;
}

final class ContactSummary {
  const ContactSummary({
    required this.userId,
    required this.displayName,
    required this.username,
    required this.email,
    required this.status,
    this.avatarUrl,
    this.title,
  });

  final String userId;
  final String displayName;
  final String username;
  final String email;
  final String status;
  final String? avatarUrl;
  final String? title;

  String get searchableText =>
      '$displayName $username $email ${title ?? ''}'.toLowerCase();
}

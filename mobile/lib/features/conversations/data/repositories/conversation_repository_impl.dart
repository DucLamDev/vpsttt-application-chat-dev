import '../../../../core/result/result.dart';
import '../../../../core/result/result_guard.dart';
import '../../domain/entities/channel_file.dart';
import '../../domain/entities/chat_message.dart';
import '../../domain/entities/conversation_summary.dart';
import '../../domain/repositories/conversation_repository.dart';
import '../datasources/conversation_remote_data_source.dart';

final class ConversationRepositoryImpl implements ConversationRepository {
  const ConversationRepositoryImpl(this._remote);

  final ConversationRemoteDataSource _remote;

  @override
  Future<Result<List<ConversationSummary>>> listDirectConversations({
    required String workspaceId,
  }) {
    return guardResult(
      () => _remote.listDirectConversations(workspaceId: workspaceId),
    );
  }

  @override
  Future<Result<List<ConversationSummary>>> listChannels({
    required String workspaceId,
  }) {
    return guardResult(() => _remote.listChannels(workspaceId: workspaceId));
  }

  @override
  Future<Result<List<ContactSummary>>> listContacts() {
    return guardResult(_remote.listContacts);
  }

  @override
  Future<Result<List<ContactSummary>>> listWorkspaceMembers({
    required String workspaceId,
  }) {
    return guardResult(
      () => _remote.listWorkspaceMembers(workspaceId: workspaceId),
    );
  }

  @override
  Future<Result<List<PresenceSummary>>> listPresence({
    required String workspaceId,
  }) {
    return guardResult(() => _remote.listPresence(workspaceId: workspaceId));
  }

  @override
  Future<Result<void>> updatePresence({
    required String workspaceId,
    required String deviceId,
    required ConversationPresence status,
    required String platform,
  }) {
    return guardResult(
      () => _remote.updatePresence(
        workspaceId: workspaceId,
        deviceId: deviceId,
        status: status,
        platform: platform,
      ),
    );
  }

  @override
  Future<Result<ConversationSummary>> getChannel({
    required String workspaceId,
    required String channelId,
  }) {
    return guardResult(
      () => _remote.getChannel(workspaceId: workspaceId, channelId: channelId),
    );
  }

  @override
  Future<Result<ConversationSummary>> createChannel({
    required String workspaceId,
    required String slug,
    required String name,
    required String description,
    required ChannelVisibility visibility,
  }) {
    return guardResult(
      () => _remote.createChannel(
        workspaceId: workspaceId,
        slug: slug,
        name: name,
        description: description,
        visibility: visibility,
      ),
    );
  }

  @override
  Future<Result<ChannelMember>> requestJoinChannel({
    required String workspaceId,
    required String channelId,
  }) {
    return guardResult(
      () => _remote.requestJoinChannel(
        workspaceId: workspaceId,
        channelId: channelId,
      ),
    );
  }

  @override
  Future<Result<ConversationSummary>> openPrivateSession({
    required String workspaceId,
    required String channelId,
  }) {
    return guardResult(
      () => _remote.openPrivateSession(
        workspaceId: workspaceId,
        channelId: channelId,
      ),
    );
  }

  @override
  Future<Result<ConversationSummary>> createDirectConversation({
    required String workspaceId,
    required List<String> participantIds,
  }) {
    return guardResult(
      () => _remote.createDirectConversation(
        workspaceId: workspaceId,
        participantIds: participantIds,
      ),
    );
  }

  @override
  Future<Result<void>> markRead({
    required String workspaceId,
    required String channelId,
    required String lastReadMessageId,
  }) {
    return guardResult(
      () => _remote.markRead(
        workspaceId: workspaceId,
        channelId: channelId,
        lastReadMessageId: lastReadMessageId,
      ),
    );
  }

  @override
  Future<Result<List<ChannelMember>>> listMembers({
    required String workspaceId,
    required String channelId,
  }) {
    return guardResult(
      () => _remote.listMembers(workspaceId: workspaceId, channelId: channelId),
    );
  }

  @override
  Future<Result<ChannelMember>> addMember({
    required String workspaceId,
    required String channelId,
    required String userId,
  }) {
    return guardResult(
      () => _remote.addMember(
        workspaceId: workspaceId,
        channelId: channelId,
        userId: userId,
      ),
    );
  }

  @override
  Future<Result<List<ChannelMember>>> listJoinRequests({
    required String workspaceId,
    required String channelId,
  }) {
    return guardResult(
      () => _remote.listJoinRequests(
        workspaceId: workspaceId,
        channelId: channelId,
      ),
    );
  }

  @override
  Future<Result<ChannelMember>> approveJoinRequest({
    required String workspaceId,
    required String channelId,
    required String userId,
  }) {
    return guardResult(
      () => _remote.approveJoinRequest(
        workspaceId: workspaceId,
        channelId: channelId,
        userId: userId,
      ),
    );
  }

  @override
  Future<Result<void>> rejectJoinRequest({
    required String workspaceId,
    required String channelId,
    required String userId,
  }) {
    return guardResult(
      () => _remote.rejectJoinRequest(
        workspaceId: workspaceId,
        channelId: channelId,
        userId: userId,
      ),
    );
  }

  @override
  Future<Result<List<ChatMessage>>> listMessages({
    required String workspaceId,
    required String channelId,
    int limit = 50,
    String? beforeId,
  }) {
    return guardResult(
      () => _remote.listMessages(
        workspaceId: workspaceId,
        channelId: channelId,
        limit: limit,
        beforeId: beforeId,
      ),
    );
  }

  @override
  Future<Result<List<ChatMessage>>> searchMessages({
    required String workspaceId,
    required String query,
    String? channelId,
    int limit = 30,
  }) {
    return guardResult(
      () => _remote.searchMessages(
        workspaceId: workspaceId,
        query: query,
        channelId: channelId,
        limit: limit,
      ),
    );
  }

  @override
  Future<Result<List<ChatMessage>>> listPins({
    required String workspaceId,
    required String channelId,
  }) {
    return guardResult(
      () => _remote.listPins(workspaceId: workspaceId, channelId: channelId),
    );
  }

  @override
  Future<Result<ChatMessage>> sendMessage({
    required String workspaceId,
    required String channelId,
    required String body,
  }) {
    return guardResult(
      () => _remote.sendMessage(
        workspaceId: workspaceId,
        channelId: channelId,
        body: body,
      ),
    );
  }

  @override
  Future<Result<List<ChannelFile>>> listFiles({
    required String workspaceId,
    int limit = 40,
  }) {
    return guardResult(
      () => _remote.listFiles(workspaceId: workspaceId, limit: limit),
    );
  }
}

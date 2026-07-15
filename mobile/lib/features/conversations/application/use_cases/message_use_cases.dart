import '../../../../core/result/result.dart';
import '../../domain/entities/chat_message.dart';
import '../../domain/repositories/conversation_repository.dart';

final class LoadMessagesUseCase {
  const LoadMessagesUseCase(this._repository);

  final ConversationRepository _repository;

  Future<Result<List<ChatMessage>>> execute({
    required String workspaceId,
    required String channelId,
  }) {
    return _repository.listMessages(
      workspaceId: workspaceId,
      channelId: channelId,
      limit: 50,
    );
  }
}

final class SendMessageUseCase {
  const SendMessageUseCase(this._repository);

  final ConversationRepository _repository;

  Future<Result<ChatMessage>> execute({
    required String workspaceId,
    required String channelId,
    required String body,
  }) {
    return _repository.sendMessage(
      workspaceId: workspaceId,
      channelId: channelId,
      body: body,
    );
  }
}

final class MarkConversationReadUseCase {
  const MarkConversationReadUseCase(this._repository);

  final ConversationRepository _repository;

  Future<Result<void>> execute({
    required String workspaceId,
    required String channelId,
    required String lastReadMessageId,
  }) {
    return _repository.markRead(
      workspaceId: workspaceId,
      channelId: channelId,
      lastReadMessageId: lastReadMessageId,
    );
  }
}

final class ReadDraftUseCase {
  const ReadDraftUseCase(this._repository);

  final ConversationDraftRepository _repository;

  Future<String> execute({
    required String workspaceId,
    required String channelId,
  }) {
    return _repository.readDraft(
      workspaceId: workspaceId,
      channelId: channelId,
    );
  }
}

final class SaveDraftUseCase {
  const SaveDraftUseCase(this._repository);

  final ConversationDraftRepository _repository;

  Future<void> execute({
    required String workspaceId,
    required String channelId,
    required String body,
  }) {
    return _repository.saveDraft(
      workspaceId: workspaceId,
      channelId: channelId,
      body: body,
    );
  }
}

final class ClearDraftUseCase {
  const ClearDraftUseCase(this._repository);

  final ConversationDraftRepository _repository;

  Future<void> execute({
    required String workspaceId,
    required String channelId,
  }) {
    return _repository.clearDraft(
      workspaceId: workspaceId,
      channelId: channelId,
    );
  }
}

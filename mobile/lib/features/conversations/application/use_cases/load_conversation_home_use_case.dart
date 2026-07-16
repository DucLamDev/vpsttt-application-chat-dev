import '../../../../core/error/failure.dart';
import '../../../../core/result/result.dart';
import '../../../workspace/domain/repositories/workspace_session_repository.dart';
import '../../domain/entities/conversation_summary.dart';
import '../../domain/repositories/conversation_repository.dart';

final class LoadConversationHomeUseCase {
  const LoadConversationHomeUseCase({
    required ConversationRepository conversationRepository,
    required WorkspaceSessionRepository workspaceSessionRepository,
  }) : _conversationRepository = conversationRepository,
       _workspaceSessionRepository = workspaceSessionRepository;

  final ConversationRepository _conversationRepository;
  final WorkspaceSessionRepository _workspaceSessionRepository;

  Future<Result<ConversationHomeData>> execute({String? workspaceId}) async {
    final activeWorkspaceId =
        workspaceId ??
        await _workspaceSessionRepository.readActiveWorkspaceId();
    if (activeWorkspaceId == null || activeWorkspaceId.isEmpty) {
      return const FailureResult(
        Failure(
          kind: FailureKind.validation,
          message: 'Bạn cần chọn workspace trước khi mở hội thoại.',
          code: 'WORKSPACE_REQUIRED',
        ),
      );
    }

    final directsResult = await _conversationRepository.listDirectConversations(
      workspaceId: activeWorkspaceId,
    );
    if (directsResult case FailureResult<List<ConversationSummary>>()) {
      return FailureResult(directsResult.failure);
    }

    final channelsResult = await _conversationRepository.listChannels(
      workspaceId: activeWorkspaceId,
    );
    if (channelsResult case FailureResult<List<ConversationSummary>>()) {
      return FailureResult(channelsResult.failure);
    }

    final contactsResult = await _conversationRepository.listContacts();
    final membersResult = await _conversationRepository.listWorkspaceMembers(
      workspaceId: activeWorkspaceId,
    );

    return Success(
      ConversationHomeData(
        workspaceId: activeWorkspaceId,
        conversations: _sortByUpdated([
          ...(directsResult.valueOrNull ?? const []),
          ...(channelsResult.valueOrNull ?? const []),
        ]),
        channels: _sortByUpdated(channelsResult.valueOrNull ?? const []),
        contacts: contactsResult.valueOrNull ?? const [],
        workspaceMembers: membersResult.valueOrNull ?? const [],
        contactsErrorMessage: contactsResult.failureOrNull?.message,
        membersErrorMessage:
            membersResult.failureOrNull?.kind == FailureKind.forbidden
            ? 'Bạn chưa có quyền xem danh sách thành viên workspace.'
            : membersResult.failureOrNull?.message,
      ),
    );
  }
}

List<ConversationSummary> _sortByUpdated(List<ConversationSummary> items) {
  final sorted = [...items];
  sorted.sort((left, right) => right.updatedAt.compareTo(left.updatedAt));
  return sorted;
}

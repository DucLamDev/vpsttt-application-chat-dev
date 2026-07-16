import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/providers/foundation_providers.dart';
import '../../../../core/result/result.dart';
import '../../../profile/application/use_cases/profile_use_cases.dart';
import '../../application/use_cases/message_use_cases.dart';
import '../../domain/entities/chat_message.dart';

final chatRoomControllerProvider = StateNotifierProvider.autoDispose
    .family<ChatRoomController, ChatRoomState, ChatRoomScope>((ref, scope) {
      return ChatRoomController(
        scope: scope,
        loadMessagesUseCase: ref.watch(loadMessagesUseCaseProvider),
        sendMessageUseCase: ref.watch(sendMessageUseCaseProvider),
        markConversationReadUseCase: ref.watch(
          markConversationReadUseCaseProvider,
        ),
        readDraftUseCase: ref.watch(readDraftUseCaseProvider),
        saveDraftUseCase: ref.watch(saveDraftUseCaseProvider),
        clearDraftUseCase: ref.watch(clearDraftUseCaseProvider),
        loadProfileUseCase: ref.watch(loadProfileUseCaseProvider),
      )..load();
    });

final class ChatRoomScope {
  const ChatRoomScope({
    required this.workspaceId,
    required this.channelId,
    required this.title,
  });

  final String workspaceId;
  final String channelId;
  final String title;

  @override
  bool operator ==(Object other) {
    return other is ChatRoomScope &&
        other.workspaceId == workspaceId &&
        other.channelId == channelId &&
        other.title == title;
  }

  @override
  int get hashCode => Object.hash(workspaceId, channelId, title);
}

final class ChatRoomState {
  const ChatRoomState({
    required this.scope,
    this.messages = const [],
    this.draft = '',
    this.isLoading = false,
    this.isSending = false,
    this.errorMessage,
    this.currentUserId,
  });

  final ChatRoomScope scope;
  final List<ChatMessage> messages;
  final String draft;
  final bool isLoading;
  final bool isSending;
  final String? errorMessage;
  final String? currentUserId;

  ChatRoomState copyWith({
    List<ChatMessage>? messages,
    String? draft,
    bool? isLoading,
    bool? isSending,
    String? errorMessage,
    String? currentUserId,
    bool clearError = false,
  }) {
    return ChatRoomState(
      scope: scope,
      messages: messages ?? this.messages,
      draft: draft ?? this.draft,
      isLoading: isLoading ?? this.isLoading,
      isSending: isSending ?? this.isSending,
      errorMessage: clearError ? null : errorMessage ?? this.errorMessage,
      currentUserId: currentUserId ?? this.currentUserId,
    );
  }
}

final class ChatRoomController extends StateNotifier<ChatRoomState> {
  ChatRoomController({
    required ChatRoomScope scope,
    required LoadMessagesUseCase loadMessagesUseCase,
    required SendMessageUseCase sendMessageUseCase,
    required MarkConversationReadUseCase markConversationReadUseCase,
    required ReadDraftUseCase readDraftUseCase,
    required SaveDraftUseCase saveDraftUseCase,
    required ClearDraftUseCase clearDraftUseCase,
    required LoadProfileUseCase loadProfileUseCase,
  }) : _loadMessagesUseCase = loadMessagesUseCase,
       _sendMessageUseCase = sendMessageUseCase,
       _markConversationReadUseCase = markConversationReadUseCase,
       _readDraftUseCase = readDraftUseCase,
       _saveDraftUseCase = saveDraftUseCase,
       _clearDraftUseCase = clearDraftUseCase,
       _loadProfileUseCase = loadProfileUseCase,
       super(ChatRoomState(scope: scope));

  final LoadMessagesUseCase _loadMessagesUseCase;
  final SendMessageUseCase _sendMessageUseCase;
  final MarkConversationReadUseCase _markConversationReadUseCase;
  final ReadDraftUseCase _readDraftUseCase;
  final SaveDraftUseCase _saveDraftUseCase;
  final ClearDraftUseCase _clearDraftUseCase;
  final LoadProfileUseCase _loadProfileUseCase;

  Future<void> load() async {
    state = state.copyWith(isLoading: true, clearError: true);
    final draftFuture = _readDraftUseCase.execute(
      workspaceId: state.scope.workspaceId,
      channelId: state.scope.channelId,
    );
    final profileFuture = _loadProfileUseCase.execute();
    final result = await _loadMessagesUseCase.execute(
      workspaceId: state.scope.workspaceId,
      channelId: state.scope.channelId,
    );
    final draft = await draftFuture;
    final profileResult = await profileFuture;
    final currentUserId = profileResult.valueOrNull?.id;
    switch (result) {
      case Success<List<ChatMessage>>(value: final messages):
        state = state.copyWith(
          messages: messages.reversed
              .map(
                (message) => message.copyWith(
                  isMine:
                      currentUserId != null &&
                      message.senderId == currentUserId,
                ),
              )
              .toList(growable: false),
          draft: draft,
          currentUserId: currentUserId,
          isLoading: false,
          clearError: true,
        );
        await _markLatestRead();
      case FailureResult<List<ChatMessage>>(failure: final failure):
        state = state.copyWith(
          draft: draft,
          currentUserId: currentUserId,
          isLoading: false,
          errorMessage: failure.message,
        );
    }
  }

  void updateDraft(String body) {
    state = state.copyWith(draft: body);
  }

  Future<void> persistDraft() {
    return _saveDraftUseCase.execute(
      workspaceId: state.scope.workspaceId,
      channelId: state.scope.channelId,
      body: state.draft,
    );
  }

  Future<void> sendCurrentDraft() async {
    final body = state.draft.trim();
    if (body.isEmpty || state.isSending) {
      return;
    }
    state = state.copyWith(isSending: true, clearError: true);
    final result = await _sendMessageUseCase.execute(
      workspaceId: state.scope.workspaceId,
      channelId: state.scope.channelId,
      body: body,
    );
    switch (result) {
      case Success<ChatMessage>(value: final message):
        final messages = [...state.messages, message.copyWith(isMine: true)];
        state = state.copyWith(
          messages: messages,
          draft: '',
          isSending: false,
          clearError: true,
        );
        await _clearDraftUseCase.execute(
          workspaceId: state.scope.workspaceId,
          channelId: state.scope.channelId,
        );
        await _markLatestRead();
      case FailureResult<ChatMessage>(failure: final failure):
        state = state.copyWith(isSending: false, errorMessage: failure.message);
        await persistDraft();
    }
  }

  Future<void> _markLatestRead() async {
    if (state.messages.isEmpty) {
      return;
    }
    final latest = state.messages.last;
    await _markConversationReadUseCase.execute(
      workspaceId: state.scope.workspaceId,
      channelId: state.scope.channelId,
      lastReadMessageId: latest.id,
    );
  }
}

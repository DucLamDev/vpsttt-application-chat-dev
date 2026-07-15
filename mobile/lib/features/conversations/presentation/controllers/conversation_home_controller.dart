import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/providers/foundation_providers.dart';
import '../../../../core/result/result.dart';
import '../../application/use_cases/load_conversation_home_use_case.dart';
import '../../application/use_cases/open_direct_conversation_use_case.dart';
import '../../domain/entities/conversation_summary.dart';

final conversationHomeControllerProvider = StateNotifierProvider.autoDispose
    .family<ConversationHomeController, ConversationHomeState, String>((
      ref,
      workspaceId,
    ) {
      return ConversationHomeController(
        workspaceId: workspaceId,
        loadConversationHomeUseCase: ref.watch(
          loadConversationHomeUseCaseProvider,
        ),
        openDirectConversationUseCase: ref.watch(
          openDirectConversationUseCaseProvider,
        ),
      )..load();
    });

enum ConversationListFilter { all, unread, favorite }

final class ConversationHomeState {
  const ConversationHomeState({
    required this.workspaceId,
    this.conversations = const [],
    this.channels = const [],
    this.contacts = const [],
    this.workspaceMembers = const [],
    this.isLoading = false,
    this.isRefreshing = false,
    this.errorMessage,
    this.noticeMessage,
    this.contactsErrorMessage,
    this.membersErrorMessage,
    this.messageFilter = ConversationListFilter.all,
    this.contactsTab = 0,
    this.channelTab = 0,
    this.searchQuery = '',
    this.selectedConversation,
  });

  final String workspaceId;
  final List<ConversationSummary> conversations;
  final List<ConversationSummary> channels;
  final List<ContactSummary> contacts;
  final List<ContactSummary> workspaceMembers;
  final bool isLoading;
  final bool isRefreshing;
  final String? errorMessage;
  final String? noticeMessage;
  final String? contactsErrorMessage;
  final String? membersErrorMessage;
  final ConversationListFilter messageFilter;
  final int contactsTab;
  final int channelTab;
  final String searchQuery;
  final ConversationSummary? selectedConversation;

  List<ConversationSummary> get filteredConversations {
    return _filterConversations(conversations, messageFilter, searchQuery);
  }

  List<ConversationSummary> get filteredChannels {
    final query = searchQuery.trim().toLowerCase();
    return channels
        .where((channel) {
          final matchesTab = switch (channelTab) {
            1 => channel.channelVisibility == ChannelVisibility.public,
            2 => channel.channelVisibility == ChannelVisibility.private,
            _ => true,
          };
          if (!matchesTab) {
            return false;
          }
          if (query.isEmpty) {
            return true;
          }
          return '${channel.title} ${channel.preview}'.toLowerCase().contains(
            query,
          );
        })
        .toList(growable: false);
  }

  List<ContactSummary> get filteredContacts {
    final source = contactsTab == 0 ? contacts : workspaceMembers;
    final query = searchQuery.trim().toLowerCase();
    if (query.isEmpty) {
      return source;
    }
    return source
        .where((contact) => contact.searchableText.contains(query))
        .toList(growable: false);
  }

  ConversationHomeState copyWith({
    List<ConversationSummary>? conversations,
    List<ConversationSummary>? channels,
    List<ContactSummary>? contacts,
    List<ContactSummary>? workspaceMembers,
    bool? isLoading,
    bool? isRefreshing,
    String? errorMessage,
    String? noticeMessage,
    String? contactsErrorMessage,
    String? membersErrorMessage,
    ConversationListFilter? messageFilter,
    int? contactsTab,
    int? channelTab,
    String? searchQuery,
    ConversationSummary? selectedConversation,
    bool clearError = false,
    bool clearNotice = false,
    bool clearSelection = false,
  }) {
    return ConversationHomeState(
      workspaceId: workspaceId,
      conversations: conversations ?? this.conversations,
      channels: channels ?? this.channels,
      contacts: contacts ?? this.contacts,
      workspaceMembers: workspaceMembers ?? this.workspaceMembers,
      isLoading: isLoading ?? this.isLoading,
      isRefreshing: isRefreshing ?? this.isRefreshing,
      errorMessage: clearError ? null : errorMessage ?? this.errorMessage,
      noticeMessage: clearNotice ? null : noticeMessage ?? this.noticeMessage,
      contactsErrorMessage: contactsErrorMessage ?? this.contactsErrorMessage,
      membersErrorMessage: membersErrorMessage ?? this.membersErrorMessage,
      messageFilter: messageFilter ?? this.messageFilter,
      contactsTab: contactsTab ?? this.contactsTab,
      channelTab: channelTab ?? this.channelTab,
      searchQuery: searchQuery ?? this.searchQuery,
      selectedConversation: clearSelection
          ? null
          : selectedConversation ?? this.selectedConversation,
    );
  }
}

final class ConversationHomeController
    extends StateNotifier<ConversationHomeState> {
  ConversationHomeController({
    required String workspaceId,
    required LoadConversationHomeUseCase loadConversationHomeUseCase,
    required OpenDirectConversationUseCase openDirectConversationUseCase,
  }) : _loadConversationHomeUseCase = loadConversationHomeUseCase,
       _openDirectConversationUseCase = openDirectConversationUseCase,
       super(ConversationHomeState(workspaceId: workspaceId));

  final LoadConversationHomeUseCase _loadConversationHomeUseCase;
  final OpenDirectConversationUseCase _openDirectConversationUseCase;

  Future<void> load() async {
    state = state.copyWith(
      isLoading: true,
      clearError: true,
      clearNotice: true,
    );
    final result = await _loadConversationHomeUseCase.execute(
      workspaceId: state.workspaceId,
    );
    switch (result) {
      case Success<ConversationHomeData>(value: final data):
        state = state.copyWith(
          conversations: data.conversations,
          channels: data.channels,
          contacts: data.contacts,
          workspaceMembers: data.workspaceMembers,
          contactsErrorMessage: data.contactsErrorMessage,
          membersErrorMessage: data.membersErrorMessage,
          isLoading: false,
          clearError: true,
        );
      case FailureResult<ConversationHomeData>(failure: final failure):
        state = state.copyWith(isLoading: false, errorMessage: failure.message);
    }
  }

  Future<void> refresh() async {
    state = state.copyWith(isRefreshing: true, clearError: true);
    await load();
    state = state.copyWith(isRefreshing: false);
  }

  void setMessageFilter(ConversationListFilter filter) {
    state = state.copyWith(messageFilter: filter);
  }

  void setContactsTab(int index) {
    state = state.copyWith(contactsTab: index.clamp(0, 1).toInt());
  }

  void setChannelTab(int index) {
    state = state.copyWith(channelTab: index.clamp(0, 2).toInt());
  }

  void setSearchQuery(String query) {
    state = state.copyWith(searchQuery: query);
  }

  void selectConversation(ConversationSummary conversation) {
    state = state.copyWith(selectedConversation: conversation);
  }

  Future<ConversationSummary?> openDirect(ContactSummary contact) async {
    state = state.copyWith(clearError: true, clearNotice: true);
    final result = await _openDirectConversationUseCase.execute(
      workspaceId: state.workspaceId,
      participantIds: [contact.userId],
    );
    switch (result) {
      case Success<ConversationSummary>(value: final conversation):
        state = state.copyWith(
          selectedConversation: conversation,
          noticeMessage: 'Đã mở hội thoại với ${contact.displayName}.',
        );
        await refresh();
        return conversation;
      case FailureResult<ConversationSummary>(failure: final failure):
        state = state.copyWith(errorMessage: failure.message);
        return null;
    }
  }
}

List<ConversationSummary> _filterConversations(
  List<ConversationSummary> source,
  ConversationListFilter filter,
  String query,
) {
  final normalizedQuery = query.trim().toLowerCase();
  return source
      .where((conversation) {
        final matchesFilter = switch (filter) {
          ConversationListFilter.all => true,
          ConversationListFilter.unread => conversation.isUnread,
          ConversationListFilter.favorite => conversation.favorite,
        };
        if (!matchesFilter) {
          return false;
        }
        if (normalizedQuery.isEmpty) {
          return true;
        }
        return '${conversation.title} ${conversation.preview}'
            .toLowerCase()
            .contains(normalizedQuery);
      })
      .toList(growable: false);
}

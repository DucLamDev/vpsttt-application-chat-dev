import 'dart:async';

import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../design_system/components/webtui_components.dart';
import '../../../../design_system/tokens/webtui_colors.dart';
import '../../../../design_system/tokens/webtui_radii.dart';
import '../../../../design_system/tokens/webtui_spacing.dart';
import '../../../../design_system/tokens/webtui_typography.dart';
import '../../../workspace/presentation/controllers/workspace_controller.dart';
import '../../domain/entities/chat_message.dart';
import '../controllers/chat_room_controller.dart';

class ChatRoomScreen extends ConsumerStatefulWidget {
  const ChatRoomScreen({
    required this.channelId,
    required this.title,
    this.workspaceId,
    this.avatarUrl,
    this.embedded = false,
    super.key,
  });

  final String? workspaceId;
  final String channelId;
  final String title;
  final String? avatarUrl;
  final bool embedded;

  @override
  ConsumerState<ChatRoomScreen> createState() => _ChatRoomScreenState();
}

class _ChatRoomScreenState extends ConsumerState<ChatRoomScreen> {
  final _draftController = TextEditingController();
  final _draftFocusNode = FocusNode();
  ChatRoomController? _chatController;

  @override
  void dispose() {
    final controller = _chatController;
    if (controller != null) {
      unawaited(controller.persistDraft());
    }
    _draftFocusNode.dispose();
    _draftController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final workspaceId =
        widget.workspaceId ??
        ref.watch(workspaceControllerProvider).activeWorkspace?.id;
    if (workspaceId == null || workspaceId.isEmpty) {
      return const Scaffold(
        body: SafeArea(
          child: WebTuiEmptyState(
            title: 'Chưa chọn workspace',
            message: 'Bạn cần chọn workspace trước khi mở hội thoại.',
            icon: Icons.business_rounded,
          ),
        ),
      );
    }

    final scope = ChatRoomScope(
      workspaceId: workspaceId,
      channelId: widget.channelId,
      title: widget.title,
    );
    final provider = chatRoomControllerProvider(scope);
    final state = ref.watch(provider);
    final controller = ref.read(provider.notifier);
    _chatController = controller;

    ref.listen<ChatRoomState>(provider, (previous, next) {
      if (_draftController.text != next.draft) {
        _draftController.text = next.draft;
        _draftController.selection = TextSelection.collapsed(
          offset: _draftController.text.length,
        );
      }
    });

    final body = PopScope(
      canPop: true,
      onPopInvokedWithResult: (_, _) {
        unawaited(controller.persistDraft());
      },
      child: _ChatRoomBody(
        state: state,
        draftController: _draftController,
        draftFocusNode: _draftFocusNode,
        onDraftChanged: controller.updateDraft,
        onRetry: controller.load,
        onSend: controller.sendCurrentDraft,
      ),
    );

    if (widget.embedded) {
      return ColoredBox(
        color: WebTuiColors.chatBackground,
        child: Column(
          children: [
            _EmbeddedChatHeader(
              title: widget.title,
              avatarUrl: widget.avatarUrl,
              onDetails: () => _openDetails(context),
            ),
            Expanded(child: body),
          ],
        ),
      );
    }

    return Scaffold(
      backgroundColor: WebTuiColors.chatBackground,
      appBar: AppBar(
        toolbarHeight: 56,
        shape: const Border(bottom: BorderSide(color: WebTuiColors.border)),
        titleSpacing: 0,
        title: Row(
          children: [
            WebTuiAvatar(
              label: widget.title,
              imageUrl: widget.avatarUrl,
              size: 34,
            ),
            const SizedBox(width: WebTuiSpacing.sm),
            Expanded(
              child: Text(
                widget.title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: WebTuiTypography.titleMedium,
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            tooltip: 'Chi tiết kênh',
            onPressed: () => _openDetails(context),
            icon: const Icon(CupertinoIcons.ellipsis),
          ),
        ],
      ),
      body: SafeArea(top: false, child: body),
    );
  }

  void _openDetails(BuildContext context) {
    context.push(
      Uri(
        path: '/channels/${widget.channelId}',
        queryParameters: {'title': widget.title},
      ).toString(),
    );
  }
}

class _ChatRoomBody extends StatefulWidget {
  const _ChatRoomBody({
    required this.state,
    required this.draftController,
    required this.draftFocusNode,
    required this.onDraftChanged,
    required this.onRetry,
    required this.onSend,
  });

  final ChatRoomState state;
  final TextEditingController draftController;
  final FocusNode draftFocusNode;
  final ValueChanged<String> onDraftChanged;
  final VoidCallback onRetry;
  final VoidCallback onSend;

  @override
  State<_ChatRoomBody> createState() => _ChatRoomBodyState();
}

class _ChatRoomBodyState extends State<_ChatRoomBody> {
  final _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    _scheduleScrollToBottom(jump: true);
  }

  @override
  void didUpdateWidget(covariant _ChatRoomBody oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.state.messages.length != widget.state.messages.length ||
        (oldWidget.state.isLoading && !widget.state.isLoading)) {
      _scheduleScrollToBottom(jump: oldWidget.state.isLoading);
    }
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        if (widget.state.errorMessage != null)
          _InlineError(
            message: widget.state.errorMessage!,
            onRetry: widget.onRetry,
          ),
        Expanded(
          child: ColoredBox(
            color: WebTuiColors.chatBackground,
            child: widget.state.isLoading
                ? const WebTuiLoadingState(message: 'Đang tải tin nhắn...')
                : widget.state.messages.isEmpty
                ? const _ChatEmptyState()
                : ListView.builder(
                    controller: _scrollController,
                    keyboardDismissBehavior:
                        ScrollViewKeyboardDismissBehavior.onDrag,
                    padding: const EdgeInsets.fromLTRB(
                      WebTuiSpacing.lg,
                      WebTuiSpacing.md,
                      WebTuiSpacing.lg,
                      WebTuiSpacing.xl,
                    ),
                    itemCount: widget.state.messages.length,
                    itemBuilder: (context, index) {
                      final message = widget.state.messages[index];
                      final previous = index == 0
                          ? null
                          : widget.state.messages[index - 1];
                      final showDay =
                          previous == null ||
                          !_sameDay(previous.createdAt, message.createdAt);
                      final sameSender =
                          previous != null &&
                          previous.senderId == message.senderId &&
                          !showDay;
                      return Padding(
                        padding: EdgeInsets.only(
                          top: sameSender ? WebTuiSpacing.xs : WebTuiSpacing.md,
                        ),
                        child: Column(
                          children: [
                            if (showDay) _DayDivider(date: message.createdAt),
                            if (showDay)
                              const SizedBox(height: WebTuiSpacing.md),
                            if (message.isSystem)
                              _SystemMessage(text: message.body)
                            else
                              _MessageRow(
                                title: widget.state.scope.title,
                                showAvatar: !message.isMine && !sameSender,
                                outgoing: message.isMine,
                                text: message.isDeleted
                                    ? 'Tin nhắn đã được thu hồi'
                                    : message.body,
                                timeLabel: _timeLabel(message.createdAt),
                                reactions: _reactionLabels(message.reactions),
                              ),
                          ],
                        ),
                      );
                    },
                  ),
          ),
        ),
        _Composer(
          controller: widget.draftController,
          focusNode: widget.draftFocusNode,
          sending: widget.state.isSending,
          canSend: widget.state.draft.trim().isNotEmpty,
          onChanged: widget.onDraftChanged,
          onSend: widget.onSend,
        ),
      ],
    );
  }

  void _scheduleScrollToBottom({required bool jump}) {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || !_scrollController.hasClients) {
        return;
      }
      final target = _scrollController.position.maxScrollExtent;
      if (jump) {
        _scrollController.jumpTo(target);
      } else {
        _scrollController.animateTo(
          target,
          duration: const Duration(milliseconds: 220),
          curve: Curves.easeOutCubic,
        );
      }
    });
  }
}

class _Composer extends StatefulWidget {
  const _Composer({
    required this.controller,
    required this.focusNode,
    required this.sending,
    required this.canSend,
    required this.onChanged,
    required this.onSend,
  });

  final TextEditingController controller;
  final FocusNode focusNode;
  final bool sending;
  final bool canSend;
  final ValueChanged<String> onChanged;
  final VoidCallback onSend;

  @override
  State<_Composer> createState() => _ComposerState();
}

class _ComposerState extends State<_Composer> {
  bool _showEmojiTray = false;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: WebTuiColors.surface,
          border: Border(
            top: BorderSide(color: WebTuiColors.border.withValues(alpha: 0.8)),
          ),
        ),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(
            WebTuiSpacing.md,
            WebTuiSpacing.sm,
            WebTuiSpacing.md,
            WebTuiSpacing.sm,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (_showEmojiTray) ...[
                _EmojiTray(onSelected: _insertEmoji),
                const SizedBox(height: WebTuiSpacing.sm),
              ],
              Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  IconButton(
                    tooltip: 'Thêm biểu tượng cảm xúc',
                    onPressed: widget.sending ? null : _toggleEmojiTray,
                    icon: const Icon(CupertinoIcons.smiley),
                  ),
                  Expanded(
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(
                        minHeight: 42,
                        maxHeight: 120,
                      ),
                      child: Container(
                        decoration: BoxDecoration(
                          color: WebTuiColors.backgroundMuted,
                          borderRadius: BorderRadius.circular(24),
                          border: Border.all(color: WebTuiColors.border),
                        ),
                        child: TextField(
                          controller: widget.controller,
                          focusNode: widget.focusNode,
                          onChanged: widget.onChanged,
                          onTap: _focusInput,
                          keyboardType: TextInputType.multiline,
                          minLines: 1,
                          maxLines: 4,
                          textInputAction: TextInputAction.newline,
                          decoration: InputDecoration(
                            hintText: 'Nhập tin nhắn...',
                            hintStyle: WebTuiTypography.bodyMedium.copyWith(
                              color: WebTuiColors.textMuted,
                            ),
                            border: InputBorder.none,
                            contentPadding: const EdgeInsets.symmetric(
                              horizontal: WebTuiSpacing.md,
                              vertical: 10,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: WebTuiSpacing.sm),
                  SizedBox.square(
                    dimension: 42,
                    child: IconButton.filled(
                      tooltip: 'Gửi',
                      onPressed: widget.sending || !widget.canSend
                          ? null
                          : _send,
                      icon: widget.sending
                          ? const SizedBox.square(
                              dimension: 18,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: WebTuiColors.textOnPrimary,
                              ),
                            )
                          : const Icon(
                              CupertinoIcons.paperplane_fill,
                              size: 20,
                            ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _toggleEmojiTray() {
    setState(() => _showEmojiTray = !_showEmojiTray);
    widget.focusNode.requestFocus();
  }

  void _focusInput() {
    if (_showEmojiTray) {
      setState(() => _showEmojiTray = false);
    }
    widget.focusNode.requestFocus();
  }

  void _send() {
    setState(() => _showEmojiTray = false);
    widget.onSend();
    widget.focusNode.requestFocus();
  }

  void _insertEmoji(String emoji) {
    final selection = widget.controller.selection;
    final start = selection.isValid
        ? selection.start
        : widget.controller.text.length;
    final end = selection.isValid
        ? selection.end
        : widget.controller.text.length;
    final controller = widget.controller;
    final onChanged = widget.onChanged;
    if (emoji.isNotEmpty) {
      final updated = controller.text.replaceRange(start, end, emoji);
      controller.value = TextEditingValue(
        text: updated,
        selection: TextSelection.collapsed(offset: start + emoji.length),
      );
      onChanged(updated);
      widget.focusNode.requestFocus();
      return;
    }
    final updated = controller.text.replaceRange(start, end, '🙂');
    controller.value = TextEditingValue(
      text: updated,
      selection: TextSelection.collapsed(offset: start + 2),
    );
    onChanged(updated);
  }
}

class _EmojiTray extends StatelessWidget {
  const _EmojiTray({required this.onSelected});

  final ValueChanged<String> onSelected;

  static const _emojis = [
    '\u{1F600}',
    '\u{1F602}',
    '\u{1F60D}',
    '\u{1F44D}',
    '\u{2764}\u{FE0F}',
    '\u{1F64F}',
    '\u{1F389}',
    '\u{1F525}',
    '\u{1F44F}',
    '\u{1F914}',
    '\u{1F622}',
    '\u{1F60E}',
  ];

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 42,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.manual,
        itemCount: _emojis.length,
        separatorBuilder: (_, _) => const SizedBox(width: WebTuiSpacing.xs),
        itemBuilder: (context, index) {
          final emoji = _emojis[index];
          return Material(
            color: WebTuiColors.backgroundMuted,
            shape: const CircleBorder(),
            child: InkWell(
              customBorder: const CircleBorder(),
              onTap: () => onSelected(emoji),
              child: SizedBox.square(
                dimension: 38,
                child: Center(
                  child: Text(emoji, style: const TextStyle(fontSize: 20)),
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

class _MessageRow extends StatelessWidget {
  const _MessageRow({
    required this.title,
    required this.showAvatar,
    required this.outgoing,
    required this.text,
    required this.timeLabel,
    required this.reactions,
  });

  final String title;
  final bool showAvatar;
  final bool outgoing;
  final String text;
  final String timeLabel;
  final List<String> reactions;

  @override
  Widget build(BuildContext context) {
    if (outgoing) {
      return WebTuiMessageBubble(
        text: text,
        timeLabel: timeLabel,
        outgoing: true,
        statusLabel: 'Đã gửi',
        reactions: reactions,
      );
    }
    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        SizedBox.square(
          dimension: 30,
          child: showAvatar
              ? WebTuiAvatar(label: title, size: 30)
              : const SizedBox.shrink(),
        ),
        const SizedBox(width: WebTuiSpacing.sm),
        Expanded(
          child: WebTuiMessageBubble(
            text: text,
            timeLabel: timeLabel,
            reactions: reactions,
          ),
        ),
      ],
    );
  }
}

class _EmbeddedChatHeader extends StatelessWidget {
  const _EmbeddedChatHeader({
    required this.title,
    required this.onDetails,
    this.avatarUrl,
  });

  final String title;
  final VoidCallback onDetails;
  final String? avatarUrl;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: WebTuiColors.surface,
      child: SizedBox(
        height: 60,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: WebTuiSpacing.lg),
          child: Row(
            children: [
              WebTuiAvatar(label: title, imageUrl: avatarUrl, size: 36),
              const SizedBox(width: WebTuiSpacing.md),
              Expanded(
                child: Text(
                  title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: WebTuiTypography.titleMedium,
                ),
              ),
              IconButton(
                tooltip: 'Chi tiết kênh',
                onPressed: onDetails,
                icon: const Icon(CupertinoIcons.ellipsis),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ChatEmptyState extends StatelessWidget {
  const _ChatEmptyState();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(WebTuiSpacing.xxl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 64,
              height: 64,
              decoration: const BoxDecoration(
                color: WebTuiColors.primarySoft,
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.chat_bubble_outline_rounded,
                color: WebTuiColors.primary,
                size: 28,
              ),
            ),
            const SizedBox(height: WebTuiSpacing.md),
            Text(
              'Bắt đầu cuộc trò chuyện',
              textAlign: TextAlign.center,
              style: WebTuiTypography.titleMedium.copyWith(
                color: WebTuiColors.textPrimary,
              ),
            ),
            const SizedBox(height: WebTuiSpacing.xs),
            Text(
              'Tin nhắn đầu tiên của bạn sẽ xuất hiện tại đây.',
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
              style: WebTuiTypography.bodySmall.copyWith(
                color: WebTuiColors.textMuted,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _DayDivider extends StatelessWidget {
  const _DayDivider({required this.date});

  final DateTime date;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: WebTuiColors.textSecondary.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(WebTuiRadii.sm),
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: WebTuiSpacing.sm,
            vertical: WebTuiSpacing.xs,
          ),
          child: Text(
            _dateLabel(date),
            style: WebTuiTypography.labelSmall.copyWith(
              color: WebTuiColors.textSecondary,
            ),
          ),
        ),
      ),
    );
  }
}

class _SystemMessage extends StatelessWidget {
  const _SystemMessage({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: WebTuiSpacing.xxl),
        child: Text(
          text,
          maxLines: 3,
          overflow: TextOverflow.ellipsis,
          textAlign: TextAlign.center,
          style: WebTuiTypography.bodySmall.copyWith(
            color: WebTuiColors.textMuted,
          ),
        ),
      ),
    );
  }
}

class _InlineError extends StatelessWidget {
  const _InlineError({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: WebTuiColors.danger.withValues(alpha: 0.08),
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: WebTuiSpacing.lg,
          vertical: WebTuiSpacing.sm,
        ),
        child: Row(
          children: [
            const Icon(
              Icons.error_outline_rounded,
              size: 18,
              color: WebTuiColors.danger,
            ),
            const SizedBox(width: WebTuiSpacing.sm),
            Expanded(
              child: Text(
                message,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: WebTuiTypography.bodySmall.copyWith(
                  color: WebTuiColors.danger,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            TextButton(onPressed: onRetry, child: const Text('Thử lại')),
          ],
        ),
      ),
    );
  }
}

String _timeLabel(DateTime value) {
  final local = value.toLocal();
  return '${local.hour.toString().padLeft(2, '0')}:${local.minute.toString().padLeft(2, '0')}';
}

bool _sameDay(DateTime left, DateTime right) {
  final a = left.toLocal();
  final b = right.toLocal();
  return a.year == b.year && a.month == b.month && a.day == b.day;
}

String _dateLabel(DateTime value) {
  final local = value.toLocal();
  final now = DateTime.now();
  if (_sameDay(local, now)) {
    return 'Hôm nay';
  }
  if (_sameDay(local, now.subtract(const Duration(days: 1)))) {
    return 'Hôm qua';
  }
  return '${local.day.toString().padLeft(2, '0')}/'
      '${local.month.toString().padLeft(2, '0')}/${local.year}';
}

List<String> _reactionLabels(List<MessageReactionSummary> reactions) {
  return reactions
      .where((reaction) => reaction.emoji.trim().isNotEmpty)
      .map(
        (reaction) => reaction.count > 1
            ? '${reaction.emoji} ${reaction.count}'
            : reaction.emoji,
      )
      .toList(growable: false);
}

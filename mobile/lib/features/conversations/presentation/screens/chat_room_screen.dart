import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../design_system/components/webtui_components.dart';
import '../../../../design_system/tokens/webtui_colors.dart';
import '../../../../design_system/tokens/webtui_radii.dart';
import '../../../../design_system/tokens/webtui_spacing.dart';
import '../../../../design_system/tokens/webtui_typography.dart';
import '../../../workspace/presentation/controllers/workspace_controller.dart';
import '../controllers/chat_room_controller.dart';

class ChatRoomScreen extends ConsumerStatefulWidget {
  const ChatRoomScreen({
    required this.channelId,
    required this.title,
    this.workspaceId,
    this.embedded = false,
    super.key,
  });

  final String? workspaceId;
  final String channelId;
  final String title;
  final bool embedded;

  @override
  ConsumerState<ChatRoomScreen> createState() => _ChatRoomScreenState();
}

class _ChatRoomScreenState extends ConsumerState<ChatRoomScreen> {
  final _draftController = TextEditingController();
  ChatRoomScope? _scope;

  @override
  void dispose() {
    final scope = _scope;
    if (scope != null) {
      unawaited(
        ref.read(chatRoomControllerProvider(scope).notifier).persistDraft(),
      );
    }
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
    _scope = scope;
    final provider = chatRoomControllerProvider(scope);
    final state = ref.watch(provider);
    final controller = ref.read(provider.notifier);

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
        onDraftChanged: controller.updateDraft,
        onRetry: controller.load,
        onSend: controller.sendCurrentDraft,
      ),
    );

    if (widget.embedded) {
      return body;
    }

    return Scaffold(
      appBar: AppBar(
        toolbarHeight: 48,
        titleSpacing: 0,
        title: Text(widget.title, maxLines: 1, overflow: TextOverflow.ellipsis),
        actions: [
          IconButton(
            tooltip: 'Chi tiết kênh',
            onPressed: () {
              context.push(
                Uri(
                  path: '/channels/${widget.channelId}',
                  queryParameters: {'title': widget.title},
                ).toString(),
              );
            },
            icon: const Icon(Icons.info_outline_rounded),
          ),
        ],
      ),
      body: SafeArea(top: false, child: body),
    );
  }
}

class _ChatRoomBody extends StatelessWidget {
  const _ChatRoomBody({
    required this.state,
    required this.draftController,
    required this.onDraftChanged,
    required this.onRetry,
    required this.onSend,
  });

  final ChatRoomState state;
  final TextEditingController draftController;
  final ValueChanged<String> onDraftChanged;
  final VoidCallback onRetry;
  final VoidCallback onSend;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        if (state.errorMessage != null)
          _InlineError(message: state.errorMessage!, onRetry: onRetry),
        Expanded(
          child: state.isLoading
              ? const WebTuiLoadingState(message: 'Đang tải tin nhắn...')
              : state.messages.isEmpty
              ? const WebTuiEmptyState(
                  title: 'Chưa có tin nhắn',
                  message: 'Gửi tin đầu tiên để bắt đầu hội thoại.',
                  icon: Icons.chat_bubble_outline_rounded,
                )
              : ListView.separated(
                  reverse: false,
                  padding: const EdgeInsets.fromLTRB(
                    WebTuiSpacing.lg,
                    WebTuiSpacing.md,
                    WebTuiSpacing.lg,
                    WebTuiSpacing.md,
                  ),
                  itemCount: state.messages.length,
                  separatorBuilder: (_, _) =>
                      const SizedBox(height: WebTuiSpacing.sm),
                  itemBuilder: (context, index) {
                    final message = state.messages[index];
                    return WebTuiMessageBubble(
                      text: message.body,
                      timeLabel: _timeLabel(message.createdAt),
                      outgoing: message.isMine,
                      statusLabel: message.isMine ? 'Đã gửi' : null,
                    );
                  },
                ),
        ),
        _Composer(
          controller: draftController,
          sending: state.isSending,
          onChanged: onDraftChanged,
          onSend: onSend,
        ),
      ],
    );
  }
}

class _Composer extends StatelessWidget {
  const _Composer({
    required this.controller,
    required this.sending,
    required this.onChanged,
    required this.onSend,
  });

  final TextEditingController controller;
  final bool sending;
  final ValueChanged<String> onChanged;
  final VoidCallback onSend;

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
            WebTuiSpacing.lg,
            WebTuiSpacing.sm,
            WebTuiSpacing.lg,
            WebTuiSpacing.sm,
          ),
          child: Row(
            children: [
              IconButton(
                tooltip: 'Đính kèm',
                onPressed: sending ? null : () {},
                icon: const Icon(Icons.add_circle_outline_rounded),
              ),
              Expanded(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(
                    minHeight: 38,
                    maxHeight: 110,
                  ),
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      color: WebTuiColors.backgroundMuted,
                      borderRadius: BorderRadius.circular(WebTuiRadii.md),
                    ),
                    child: TextField(
                      controller: controller,
                      onChanged: onChanged,
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
                          vertical: WebTuiSpacing.sm,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: WebTuiSpacing.sm),
              IconButton.filled(
                tooltip: 'Gửi',
                onPressed: sending ? null : onSend,
                icon: sending
                    ? const SizedBox.square(
                        dimension: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: WebTuiColors.textOnPrimary,
                        ),
                      )
                    : const Icon(Icons.send_rounded),
              ),
            ],
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

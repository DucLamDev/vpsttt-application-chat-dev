import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:stream_video_flutter/stream_video_flutter.dart' as stream;

import '../../../../app/providers/foundation_providers.dart';
import '../../../../design_system/tokens/webtui_colors.dart';
import '../../../../design_system/tokens/webtui_spacing.dart';
import '../../../../design_system/tokens/webtui_typography.dart';
import '../../domain/entities/call_session.dart';

class StreamVideoCallScreen extends ConsumerStatefulWidget {
  const StreamVideoCallScreen({
    required this.workspaceId,
    required this.channelId,
    required this.callId,
    required this.targetUserId,
    required this.title,
    required this.mode,
    this.onLeave,
    super.key,
  });

  final String workspaceId;
  final String channelId;
  final String callId;
  final String targetUserId;
  final String title;
  final CallMode mode;
  final Future<void> Function()? onLeave;

  @override
  ConsumerState<StreamVideoCallScreen> createState() =>
      _StreamVideoCallScreenState();
}

class _StreamVideoCallScreenState extends ConsumerState<StreamVideoCallScreen> {
  late final Future<stream.Call> _callFuture;

  static stream.StreamVideo? _client;
  static String? _clientUserId;

  @override
  void initState() {
    super.initState();
    _callFuture = _prepareCall();
  }

  Future<stream.Call> _prepareCall() async {
    final credentials = await ref
        .read(streamVideoRemoteDataSourceProvider)
        .loadCredentials();
    if (credentials.apiKey.isEmpty ||
        credentials.userId.isEmpty ||
        credentials.token.isEmpty) {
      throw Exception('Stream Video chưa được cấu hình đúng.');
    }

    final profileResult = await ref.read(loadProfileUseCaseProvider).execute();
    final profile = profileResult.valueOrNull;
    final displayName = profile?.displayName.trim();
    final avatarUrl = profile?.avatarUrl?.trim();

    if (_client == null || _clientUserId != credentials.userId) {
      _client = stream.StreamVideo(
        credentials.apiKey,
        user: stream.User.regular(
          userId: credentials.userId,
          name: displayName == null || displayName.isEmpty
              ? credentials.userId
              : displayName,
          image: avatarUrl == null || avatarUrl.isEmpty ? null : avatarUrl,
        ),
        userToken: credentials.token,
        failIfSingletonExists: false,
      );
      _clientUserId = credentials.userId;
    }

    final call = _client!.makeCall(
      callType: stream.StreamCallType.defaultType(),
      id: widget.callId,
    );
    final result = await _retryStreamRequest(
      () => call.getOrCreate(
        ringing: true,
        video: widget.mode == CallMode.video,
        memberIds: [credentials.userId, widget.targetUserId],
        custom: {
          'workspace_id': widget.workspaceId,
          'channel_id': widget.channelId,
          'webtui_call_id': widget.callId,
          'client': 'webtui_mobile',
        },
      ),
    );
    result.fold(
      success: (_) {},
      failure: (failure) {
        throw Exception(failure.error.message);
      },
    );
    return call;
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<stream.Call>(
      future: _callFuture,
      builder: (context, snapshot) {
        final call = snapshot.data;
        if (call != null) {
          return stream.StreamCallContainer(
            call: call,
            callContentWidgetBuilder: (context, call) {
              return stream.StreamCallContent(
                call: call,
                callControlsWidgetBuilder: (context, call) {
                  return stream.StreamCallControls(
                    options: [
                      stream.ToggleMicrophoneOption(call: call),
                      if (widget.mode == CallMode.video)
                        stream.ToggleCameraOption(call: call),
                      if (widget.mode == CallMode.video)
                        stream.FlipCameraOption(call: call),
                      stream.LeaveCallOption(
                        call: call,
                        onLeaveCallTap: () async {
                          await call.leave();
                          await widget.onLeave?.call();
                          if (context.mounted) {
                            Navigator.of(context).pop();
                          }
                        },
                      ),
                    ],
                  );
                },
              );
            },
          );
        }

        if (snapshot.hasError) {
          return _StreamCallStateShell(
            title: 'Không thể bắt đầu cuộc gọi',
            message: _friendlyCallError(snapshot.error),
            loading: false,
            actionLabel: 'Quay lại',
            onAction: () => Navigator.of(context).pop(),
          );
        }

        return _StreamCallStateShell(
          title: widget.mode == CallMode.video
              ? 'Đang mở cuộc gọi video'
              : 'Đang mở cuộc gọi thoại',
          message: 'Đang kết nối Stream Video...',
          loading: true,
        );
      },
    );
  }

  Future<T> _retryStreamRequest<T>(
    Future<T> Function() request, {
    int attempts = 3,
  }) async {
    Object? lastError;
    for (var attempt = 1; attempt <= attempts; attempt++) {
      try {
        return await request();
      } on Object catch (error) {
        lastError = error;
        if (attempt == attempts) {
          rethrow;
        }
        await Future<void>.delayed(Duration(milliseconds: 650 * attempt));
      }
    }
    throw lastError ?? StateError('Không thể kết nối Stream Video.');
  }

  String _friendlyCallError(Object? error) {
    final message = error?.toString() ?? '';
    if (message.toLowerCase().contains('timeout')) {
      return 'Kết nối Stream Video quá lâu. Vui lòng kiểm tra STREAM_VIDEO_API_KEY, STREAM_VIDEO_API_SECRET trên VPS và mạng thiết bị.';
    }
    final normalized = message
        .replaceFirst(RegExp(r'^Exception:\s*'), '')
        .trim();
    return normalized.isEmpty ? 'Không thể kết nối Stream Video.' : normalized;
  }
}

class _StreamCallStateShell extends StatelessWidget {
  const _StreamCallStateShell({
    required this.title,
    required this.message,
    required this.loading,
    this.actionLabel,
    this.onAction,
  });

  final String title;
  final String message;
  final bool loading;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: WebTuiColors.chatBackground,
      appBar: AppBar(
        backgroundColor: WebTuiColors.chatHeader,
        foregroundColor: WebTuiColors.textOnPrimary,
        title: Text(title),
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(WebTuiSpacing.lg),
          child: Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (loading)
                  const CircularProgressIndicator()
                else
                  const Icon(
                    Icons.videocam_off_outlined,
                    size: 36,
                    color: WebTuiColors.textMuted,
                  ),
                const SizedBox(height: WebTuiSpacing.md),
                Text(
                  title,
                  textAlign: TextAlign.center,
                  style: WebTuiTypography.titleMedium.copyWith(
                    color: WebTuiColors.textPrimary,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: WebTuiSpacing.sm),
                Text(
                  message,
                  textAlign: TextAlign.center,
                  style: WebTuiTypography.bodySmall.copyWith(
                    color: WebTuiColors.textSecondary,
                  ),
                ),
                if (actionLabel != null && onAction != null) ...[
                  const SizedBox(height: WebTuiSpacing.lg),
                  FilledButton(onPressed: onAction, child: Text(actionLabel!)),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

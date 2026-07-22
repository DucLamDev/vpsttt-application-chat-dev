import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:zego_uikit_prebuilt_call/zego_uikit_prebuilt_call.dart';

import '../../../../app/providers/foundation_providers.dart';
import '../../../../design_system/tokens/webtui_colors.dart';
import '../../../../design_system/tokens/webtui_spacing.dart';
import '../../../../design_system/tokens/webtui_typography.dart';
import '../../domain/entities/call_session.dart';
import '../../domain/entities/zego_call_credentials.dart';

class ZegoCallScreen extends ConsumerStatefulWidget {
  const ZegoCallScreen({
    required this.workspaceId,
    required this.channelId,
    required this.callId,
    required this.title,
    required this.mode,
    this.onLeave,
    super.key,
  });

  final String workspaceId;
  final String channelId;
  final String callId;
  final String title;
  final CallMode mode;
  final Future<void> Function()? onLeave;

  @override
  ConsumerState<ZegoCallScreen> createState() => _ZegoCallScreenState();
}

class _ZegoCallScreenState extends ConsumerState<ZegoCallScreen> {
  late final Future<_PreparedZegoCall> _callFuture;
  bool _leaveHandled = false;

  @override
  void initState() {
    super.initState();
    _callFuture = _prepareCall();
  }

  Future<_PreparedZegoCall> _prepareCall() async {
    final credentials = await ref
        .read(zegoCallRemoteDataSourceProvider)
        .loadCredentials();
    if (credentials.appId <= 0 ||
        credentials.appSign.isEmpty ||
        credentials.userId.isEmpty ||
        credentials.token.isEmpty) {
      throw Exception('ZEGOCLOUD chưa được cấu hình đúng.');
    }

    final callId = zegoCallIdFromBackendCallId(widget.callId);
    if (callId.isEmpty) {
      throw Exception('Mã cuộc gọi ZEGOCLOUD không hợp lệ.');
    }

    final profileResult = await ref.read(loadProfileUseCaseProvider).execute();
    final profile = profileResult.valueOrNull;
    final displayName = profile?.displayName.trim();
    final userName = displayName == null || displayName.isEmpty
        ? (credentials.userName.isEmpty
              ? credentials.userId
              : credentials.userName)
        : displayName;

    return _PreparedZegoCall(
      callId: callId,
      credentials: credentials,
      userName: userName,
    );
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<_PreparedZegoCall>(
      future: _callFuture,
      builder: (context, snapshot) {
        final preparedCall = snapshot.data;
        if (preparedCall != null) {
          return ZegoUIKitPrebuiltCall(
            appID: preparedCall.credentials.appId,
            callID: preparedCall.callId,
            config: _configForMode(),
            events: ZegoUIKitPrebuiltCallEvents(
              onCallEnd: (_, defaultAction) {
                unawaited(_finishLeave(defaultAction: defaultAction));
              },
            ),
            token: preparedCall.credentials.token,
            userID: preparedCall.credentials.userId,
            userName: preparedCall.userName,
          );
        }

        if (snapshot.hasError) {
          return _ZegoCallStateShell(
            title: 'Không thể bắt đầu cuộc gọi',
            message: _friendlyCallError(snapshot.error),
            loading: false,
            actionLabel: 'Quay lại',
            onAction: () => unawaited(_finishLeave()),
          );
        }

        return _ZegoCallStateShell(
          title: widget.mode == CallMode.video
              ? 'Đang mở cuộc gọi video'
              : 'Đang mở cuộc gọi thoại',
          message: 'Đang kết nối ZEGOCLOUD...',
          loading: true,
        );
      },
    );
  }

  ZegoUIKitPrebuiltCallConfig _configForMode() {
    final config = widget.mode == CallMode.video
        ? ZegoUIKitPrebuiltCallConfig.oneOnOneVideoCall()
        : ZegoUIKitPrebuiltCallConfig.oneOnOneVoiceCall();
    config.turnOnCameraWhenJoining = widget.mode == CallMode.video;
    config.turnOnMicrophoneWhenJoining = true;
    config.useSpeakerWhenJoining = true;
    return config;
  }

  Future<void> _finishLeave({VoidCallback? defaultAction}) async {
    if (_leaveHandled) {
      return;
    }
    _leaveHandled = true;
    await widget.onLeave?.call();
    if (!mounted) {
      return;
    }
    if (defaultAction != null) {
      defaultAction();
      return;
    }
    await Navigator.of(context).maybePop();
  }

  String _friendlyCallError(Object? error) {
    final message = error?.toString() ?? '';
    if (message.toLowerCase().contains('timeout')) {
      return 'Kết nối ZEGOCLOUD quá lâu. Vui lòng kiểm tra ZEGO_APP_ID, ZEGO_APP_SIGN, ZEGO_SERVER_SECRET trên VPS và mạng thiết bị.';
    }
    final normalized = message
        .replaceFirst(RegExp(r'^Exception:\s*'), '')
        .trim();
    return normalized.isEmpty ? 'Không thể kết nối ZEGOCLOUD.' : normalized;
  }
}

class _PreparedZegoCall {
  const _PreparedZegoCall({
    required this.callId,
    required this.credentials,
    required this.userName,
  });

  final String callId;
  final ZegoCallCredentials credentials;
  final String userName;
}

class _ZegoCallStateShell extends StatelessWidget {
  const _ZegoCallStateShell({
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

String zegoCallIdFromBackendCallId(String raw) {
  return raw.trim().replaceAll(RegExp(r'[^A-Za-z0-9_]'), '_');
}

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
    this.incoming = false,
    this.onLeave,
    super.key,
  });

  final String workspaceId;
  final String channelId;
  final String callId;
  final String title;
  final CallMode mode;
  final bool incoming;
  final Future<void> Function()? onLeave;

  @override
  ConsumerState<ZegoCallScreen> createState() => _ZegoCallScreenState();
}

class _ZegoCallScreenState extends ConsumerState<ZegoCallScreen> {
  late final Future<_PreparedZegoCall> _callFuture;
  bool _leaveHandled = false;
  Timer? _callStateTimer;
  CallStatus _callStatus = CallStatus.ringing;
  DateTime? _startedAt;
  Duration _elapsed = Duration.zero;

  @override
  void initState() {
    super.initState();
    _callFuture = _prepareCall();
    unawaited(_syncCallState());
    _callStateTimer = Timer.periodic(
      const Duration(seconds: 1),
      (_) => unawaited(_syncCallState()),
    );
  }

  @override
  void dispose() {
    _callStateTimer?.cancel();
    super.dispose();
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
          return Stack(
            children: [
              ZegoUIKitPrebuiltCall(
                appID: preparedCall.credentials.appId,
                callID: preparedCall.callId,
                config: _configForMode(),
                events: ZegoUIKitPrebuiltCallEvents(
                  onCallEnd: (_, defaultAction) {
                    unawaited(_finishLeave(defaultAction: defaultAction));
                  },
                  user: ZegoCallUserEvents(
                    onEnter: (_) => unawaited(_syncCallState()),
                    onLeave: (_) => unawaited(_finishLeave()),
                  ),
                ),
                token: preparedCall.credentials.token,
                userID: preparedCall.credentials.userId,
                userName: preparedCall.userName,
              ),
              if (_callStatus == CallStatus.accepted)
                Positioned(
                  top: MediaQuery.paddingOf(context).top + 12,
                  left: 0,
                  right: 0,
                  child: IgnorePointer(
                    child: Center(child: _CallDurationPill(elapsed: _elapsed)),
                  ),
                ),
            ],
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
    config.duration.isVisible = false;
    config.topMenuBar.isVisible = true;
    if (!config.topMenuBar.buttons.contains(
      ZegoCallMenuBarButtonName.minimizingButton,
    )) {
      config.topMenuBar.buttons.insert(
        0,
        ZegoCallMenuBarButtonName.minimizingButton,
      );
    }
    config.pip.enableWhenBackground = true;
    return config;
  }

  Future<void> _finishLeave({VoidCallback? defaultAction}) async {
    if (_leaveHandled) {
      return;
    }
    _leaveHandled = true;
    _callStateTimer?.cancel();
    await _endBackendCall();
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

  Future<void> _endBackendCall() async {
    final current = await ref
        .read(getCallUseCaseProvider)
        .execute(workspaceId: widget.workspaceId, callId: widget.callId);
    final call = current.valueOrNull;
    if (call == null || call.isTerminal) {
      return;
    }
    if (call.status == CallStatus.ringing && widget.incoming) {
      await ref
          .read(rejectCallUseCaseProvider)
          .execute(
            workspaceId: widget.workspaceId,
            callId: widget.callId,
            reason: 'declined',
          );
      return;
    }
    await ref
        .read(endCallUseCaseProvider)
        .execute(
          workspaceId: widget.workspaceId,
          callId: widget.callId,
          currentStatus: call.status,
          reason: call.status == CallStatus.ringing ? 'cancelled' : 'ended',
        );
  }

  Future<void> _syncCallState() async {
    if (_leaveHandled) {
      return;
    }
    final result = await ref
        .read(getCallUseCaseProvider)
        .execute(workspaceId: widget.workspaceId, callId: widget.callId);
    final call = result.valueOrNull;
    if (!mounted || call == null || _leaveHandled) {
      return;
    }
    if (call.isTerminal) {
      _leaveHandled = true;
      _callStateTimer?.cancel();
      await widget.onLeave?.call();
      if (mounted) {
        await Navigator.of(context).maybePop();
      }
      return;
    }
    final startedAt = call.status == CallStatus.accepted
        ? call.startedAt ?? _startedAt ?? DateTime.now().toUtc()
        : null;
    final difference = startedAt == null
        ? Duration.zero
        : DateTime.now().toUtc().difference(startedAt);
    final elapsed = difference.isNegative ? Duration.zero : difference;
    if (_callStatus != call.status ||
        _startedAt != startedAt ||
        _elapsed.inSeconds != elapsed.inSeconds) {
      setState(() {
        _callStatus = call.status;
        _startedAt = startedAt;
        _elapsed = elapsed;
      });
    }
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

class _CallDurationPill extends StatelessWidget {
  const _CallDurationPill({required this.elapsed});

  final Duration elapsed;

  @override
  Widget build(BuildContext context) {
    final minutes = elapsed.inMinutes.remainder(60).toString().padLeft(2, '0');
    final seconds = elapsed.inSeconds.remainder(60).toString().padLeft(2, '0');
    final hours = elapsed.inHours;
    final value = hours > 0
        ? '${hours.toString().padLeft(2, '0')}:$minutes:$seconds'
        : '$minutes:$seconds';
    return DecoratedBox(
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.56),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        child: Text(
          value,
          style: WebTuiTypography.labelSmall.copyWith(
            color: Colors.white,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
    );
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

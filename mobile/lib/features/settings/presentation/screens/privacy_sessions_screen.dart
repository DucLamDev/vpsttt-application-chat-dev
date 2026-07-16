import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/providers/foundation_providers.dart';
import '../../../../core/result/result.dart';
import '../../../../design_system/components/webtui_components.dart';
import '../../../../design_system/tokens/webtui_colors.dart';
import '../../../../design_system/tokens/webtui_spacing.dart';
import '../../../../features/auth/domain/entities/user_session.dart';

final sessionListProvider =
    FutureProvider.autoDispose<Result<List<UserSession>>>((ref) {
      return ref.watch(listSessionsUseCaseProvider).execute();
    });

class PrivacySessionsScreen extends ConsumerWidget {
  const PrivacySessionsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sessions = ref.watch(sessionListProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Quyền riêng tư')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.only(bottom: WebTuiSpacing.xl),
          children: [
            const WebTuiSectionLabel('Phiên đăng nhập'),
            sessions.when(
              data: (result) {
                return switch (result) {
                  Success<List<UserSession>>(value: final value) =>
                    _SessionList(sessions: value),
                  FailureResult<List<UserSession>>(failure: final failure) =>
                    WebTuiErrorState(
                      title: failure.requiresLogin
                          ? 'Cần đăng nhập lại'
                          : 'Không tải được phiên',
                      message: failure.message,
                    ),
                };
              },
              error: (_, _) => const WebTuiErrorState(
                title: 'Không tải được phiên',
                message: 'Vui lòng thử lại sau.',
              ),
              loading: () => const WebTuiLoadingState(
                message: 'Đang tải phiên đăng nhập...',
              ),
            ),
            const WebTuiSectionLabel('Bảo mật màn hình'),
            WebTuiListSurface(
              children: const [
                WebTuiSettingRow(
                  title: 'Ẩn nội dung khi app vào nền',
                  subtitle: 'Đã bật bằng bảo vệ ảnh chụp màn hình',
                  icon: Icons.screenshot_monitor_outlined,
                  trailing: Icon(
                    Icons.check_circle_rounded,
                    color: WebTuiColors.accentGreen,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _SessionList extends ConsumerWidget {
  const _SessionList({required this.sessions});

  final List<UserSession> sessions;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (sessions.isEmpty) {
      return const WebTuiEmptyState(
        title: 'Chưa có phiên khác',
        message: 'Các thiết bị đăng nhập sẽ xuất hiện ở đây.',
        icon: Icons.devices_other_outlined,
      );
    }

    return WebTuiListSurface(
      children: [
        for (final session in sessions)
          WebTuiSettingRow(
            title: session.deviceName ?? 'Thiết bị không xác định',
            subtitle: session.isActive ? 'Đang hoạt động' : 'Đã hết hạn',
            icon: Icons.devices_rounded,
            trailing: IconButton(
              tooltip: 'Thu hồi phiên',
              onPressed: () async {
                await ref
                    .read(revokeSessionUseCaseProvider)
                    .execute(session.id);
                ref.invalidate(sessionListProvider);
              },
              icon: const Icon(Icons.logout_rounded),
            ),
          ),
      ],
    );
  }
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/providers/foundation_providers.dart';
import '../../../../design_system/components/webtui_components.dart';
import '../../../../design_system/tokens/webtui_spacing.dart';
import '../../../conversations/presentation/widgets/conversation_home_views.dart';
import '../../../workspace/presentation/controllers/workspace_controller.dart';

class HomeShellScreen extends ConsumerStatefulWidget {
  const HomeShellScreen({this.initialTabIndex = 0, super.key});

  final int initialTabIndex;

  @override
  ConsumerState<HomeShellScreen> createState() => _HomeShellScreenState();
}

class _HomeShellScreenState extends ConsumerState<HomeShellScreen> {
  late int _tabIndex;
  bool _notificationEnabled = true;
  bool _compactMode = false;
  double _soundLevel = 0.64;
  double _textScalePreview = 0.42;

  @override
  void initState() {
    super.initState();
    _tabIndex = widget.initialTabIndex.clamp(0, _titles.length - 1).toInt();
  }

  @override
  Widget build(BuildContext context) {
    final workspaceState = ref.watch(workspaceControllerProvider);
    final activeWorkspace = workspaceState.activeWorkspace;

    if (workspaceState.isLoading && activeWorkspace == null) {
      return const Scaffold(
        body: SafeArea(
          child: WebTuiLoadingState(message: 'Đang tải workspace...'),
        ),
      );
    }

    if (activeWorkspace == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('WebTui')),
        body: const SafeArea(
          child: WebTuiEmptyState(
            title: 'Chưa chọn workspace',
            message: 'Bạn cần chọn workspace trước khi mở dữ liệu chat.',
            icon: Icons.business_rounded,
          ),
        ),
        bottomNavigationBar: Padding(
          padding: const EdgeInsets.all(WebTuiSpacing.lg),
          child: FilledButton.icon(
            onPressed: () => context.go('/workspaces'),
            icon: const Icon(Icons.business_rounded),
            label: const Text('Chọn workspace'),
          ),
        ),
      );
    }

    return KeyedSubtree(
      key: ValueKey('workspace-shell-${workspaceState.generation}'),
      child: WebTuiMobileScaffold(
        title: _titles[_tabIndex],
        selectedTab: _tabIndex,
        onTabSelected: (index) => setState(() => _tabIndex = index),
        actions: [
          IconButton(
            tooltip: activeWorkspace.name,
            onPressed: () => context.go('/workspaces'),
            icon: const Icon(Icons.business_rounded),
          ),
          if (_tabIndex == 2)
            IconButton(
              tooltip: 'Tạo kênh',
              onPressed: () => context.push('/channels/new'),
              icon: const Icon(Icons.add_circle_outline_rounded),
            )
          else if (_tabIndex == 0)
            IconButton(
              tooltip: 'Tạo hội thoại',
              onPressed: () => setState(() => _tabIndex = 1),
              icon: const Icon(Icons.person_add_alt_1_rounded),
            ),
        ],
        body: switch (_tabIndex) {
          0 => MessagesHomeView(workspaceId: activeWorkspace.id),
          1 => ContactsHomeView(workspaceId: activeWorkspace.id),
          2 => ChannelsHomeView(workspaceId: activeWorkspace.id),
          _ => _SettingsTab(
            workspaceName: activeWorkspace.name,
            notificationEnabled: _notificationEnabled,
            compactMode: _compactMode,
            soundLevel: _soundLevel,
            textScalePreview: _textScalePreview,
            onProfileTap: () => context.go('/profile'),
            onAdvancedTap: () => context.go('/settings'),
            onPrivacyTap: () => context.go('/privacy'),
            onLogoutTap: () async {
              await ref.read(logoutUseCaseProvider).execute();
              if (context.mounted) {
                context.go('/login');
              }
            },
            onNotificationChanged: (value) {
              setState(() => _notificationEnabled = value);
            },
            onCompactChanged: (value) => setState(() => _compactMode = value),
            onSoundChanged: (value) => setState(() => _soundLevel = value),
            onTextScaleChanged: (value) {
              setState(() => _textScalePreview = value);
            },
          ),
        },
      ),
    );
  }

  static const _titles = ['Tin nhắn', 'Danh bạ', 'Kênh', 'Cài đặt'];
}

class _SettingsTab extends StatelessWidget {
  const _SettingsTab({
    required this.workspaceName,
    required this.notificationEnabled,
    required this.compactMode,
    required this.soundLevel,
    required this.textScalePreview,
    required this.onProfileTap,
    required this.onAdvancedTap,
    required this.onPrivacyTap,
    required this.onLogoutTap,
    required this.onNotificationChanged,
    required this.onCompactChanged,
    required this.onSoundChanged,
    required this.onTextScaleChanged,
  });

  final String workspaceName;
  final bool notificationEnabled;
  final bool compactMode;
  final double soundLevel;
  final double textScalePreview;
  final VoidCallback onProfileTap;
  final VoidCallback onAdvancedTap;
  final VoidCallback onPrivacyTap;
  final VoidCallback onLogoutTap;
  final ValueChanged<bool> onNotificationChanged;
  final ValueChanged<bool> onCompactChanged;
  final ValueChanged<double> onSoundChanged;
  final ValueChanged<double> onTextScaleChanged;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.only(bottom: WebTuiSpacing.lg),
      children: [
        const SizedBox(height: WebTuiSpacing.md),
        Center(
          child: Column(
            children: [
              WebTuiAvatar(
                label: workspaceName,
                size: 72,
                status: WebTuiPresenceStatus.online,
              ),
              const SizedBox(height: WebTuiSpacing.sm),
              Text(workspaceName, maxLines: 1, overflow: TextOverflow.ellipsis),
            ],
          ),
        ),
        const SizedBox(height: WebTuiSpacing.md),
        WebTuiListSurface(
          children: [
            WebTuiSettingRow(
              title: 'Workspace',
              subtitle: workspaceName,
              icon: Icons.business_rounded,
            ),
            WebTuiSettingRow(
              title: 'Hồ sơ cá nhân',
              subtitle: 'Cập nhật tên, ảnh đại diện và trạng thái',
              icon: Icons.person_outline_rounded,
              onTap: onProfileTap,
            ),
            WebTuiSettingRow(
              title: 'Thiết lập nâng cao',
              subtitle: 'Quyền riêng tư, bảo mật và thiết bị',
              icon: Icons.tune_rounded,
              onTap: onAdvancedTap,
            ),
            WebTuiSettingRow(
              title: 'Thông báo',
              subtitle: 'Nhận tin nhắn và cảnh báo kênh',
              icon: Icons.notifications_none_rounded,
              trailing: WebTuiToggle(
                value: notificationEnabled,
                onChanged: onNotificationChanged,
              ),
            ),
            WebTuiSettingRow(
              title: 'Danh sách dày',
              subtitle: 'Tăng mật độ thông tin như ảnh reference',
              icon: Icons.format_line_spacing_rounded,
              trailing: WebTuiToggle(
                value: compactMode,
                onChanged: onCompactChanged,
              ),
            ),
          ],
        ),
        const WebTuiSectionLabel('Thiết lập chuông'),
        WebTuiListSurface(
          children: [
            WebTuiSliderRow(
              icon: Icons.volume_up_outlined,
              value: soundLevel,
              onChanged: onSoundChanged,
            ),
            WebTuiSliderRow(
              icon: Icons.text_fields_rounded,
              value: textScalePreview,
              onChanged: onTextScaleChanged,
            ),
          ],
        ),
        const SizedBox(height: WebTuiSpacing.md),
        WebTuiListSurface(
          children: [
            WebTuiSettingRow(
              title: 'Tài khoản',
              icon: Icons.account_circle_outlined,
              onTap: onPrivacyTap,
            ),
            WebTuiSettingRow(
              title: 'Đăng xuất',
              icon: Icons.logout_rounded,
              destructive: true,
              onTap: onLogoutTap,
            ),
          ],
        ),
      ],
    );
  }
}

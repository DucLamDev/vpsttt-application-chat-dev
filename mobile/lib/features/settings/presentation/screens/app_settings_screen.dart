import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../design_system/components/webtui_components.dart';
import '../../../../design_system/tokens/webtui_spacing.dart';
import '../../domain/entities/app_settings.dart';
import '../controllers/app_settings_controller.dart';

class AppSettingsScreen extends ConsumerWidget {
  const AppSettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(appSettingsControllerProvider);
    final controller = ref.read(appSettingsControllerProvider.notifier);
    final settings = state.settings;

    return Scaffold(
      appBar: AppBar(title: const Text('Thiết lập ứng dụng')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.only(bottom: WebTuiSpacing.xl),
          children: [
            const WebTuiSectionLabel('Giao diện'),
            WebTuiListSurface(
              children: [
                _ThemeRow(
                  settings: settings,
                  onChanged: (theme) {
                    controller.update(settings.copyWith(theme: theme));
                  },
                ),
                WebTuiSettingRow(
                  title: 'Ngôn ngữ',
                  subtitle: settings.languageCode == 'vi'
                      ? 'Tiếng Việt'
                      : 'English',
                  icon: Icons.language_rounded,
                  trailing: DropdownButton<String>(
                    value: settings.languageCode,
                    underline: const SizedBox.shrink(),
                    items: const [
                      DropdownMenuItem(value: 'vi', child: Text('VI')),
                      DropdownMenuItem(value: 'en', child: Text('EN')),
                    ],
                    onChanged: (value) {
                      if (value != null) {
                        controller.update(
                          settings.copyWith(languageCode: value),
                        );
                      }
                    },
                  ),
                ),
              ],
            ),
            const WebTuiSectionLabel('Thông báo'),
            WebTuiListSurface(
              children: [
                WebTuiSettingRow(
                  title: 'Nhận thông báo',
                  subtitle: 'Tin nhắn, kênh và cảnh báo workspace',
                  icon: Icons.notifications_none_rounded,
                  trailing: WebTuiToggle(
                    value: settings.notificationsEnabled,
                    onChanged: (value) {
                      controller.update(
                        settings.copyWith(notificationsEnabled: value),
                      );
                    },
                  ),
                ),
                WebTuiSettingRow(
                  title: 'Ẩn xem trước nhạy cảm',
                  subtitle: 'Không hiện nội dung trong lock screen',
                  icon: Icons.privacy_tip_outlined,
                  trailing: WebTuiToggle(
                    value: settings.sensitivePreviewEnabled,
                    onChanged: (value) {
                      controller.update(
                        settings.copyWith(sensitivePreviewEnabled: value),
                      );
                    },
                  ),
                ),
                WebTuiSettingRow(
                  title: 'Giờ yên lặng',
                  subtitle: '${settings.quietStart} - ${settings.quietEnd}',
                  icon: Icons.bedtime_outlined,
                  trailing: WebTuiToggle(
                    value: settings.quietHoursEnabled,
                    onChanged: (value) {
                      controller.update(
                        settings.copyWith(quietHoursEnabled: value),
                      );
                    },
                  ),
                ),
              ],
            ),
            if (state.errorMessage != null)
              WebTuiErrorState(
                title: 'Không lưu được thiết lập',
                message: state.errorMessage!,
              ),
          ],
        ),
      ),
    );
  }
}

class _ThemeRow extends StatelessWidget {
  const _ThemeRow({required this.settings, required this.onChanged});

  final AppSettings settings;
  final ValueChanged<WebTuiThemePreference> onChanged;

  @override
  Widget build(BuildContext context) {
    return WebTuiSettingRow(
      title: 'Chủ đề',
      subtitle: switch (settings.theme) {
        WebTuiThemePreference.system => 'Theo hệ thống',
        WebTuiThemePreference.light => 'Sáng',
        WebTuiThemePreference.dark => 'Tối',
      },
      icon: Icons.palette_outlined,
      trailing: DropdownButton<WebTuiThemePreference>(
        value: settings.theme,
        underline: const SizedBox.shrink(),
        items: const [
          DropdownMenuItem(
            value: WebTuiThemePreference.system,
            child: Text('Hệ thống'),
          ),
          DropdownMenuItem(
            value: WebTuiThemePreference.light,
            child: Text('Sáng'),
          ),
          DropdownMenuItem(
            value: WebTuiThemePreference.dark,
            child: Text('Tối'),
          ),
        ],
        onChanged: (value) {
          if (value != null) {
            onChanged(value);
          }
        },
      ),
    );
  }
}

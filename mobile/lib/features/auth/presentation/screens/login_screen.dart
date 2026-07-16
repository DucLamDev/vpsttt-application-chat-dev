import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../design_system/tokens/webtui_colors.dart';
import '../../../../design_system/tokens/webtui_radii.dart';
import '../../../../design_system/tokens/webtui_spacing.dart';
import '../../../../design_system/tokens/webtui_typography.dart';
import '../controllers/login_controller.dart';

class LoginScreen extends ConsumerWidget {
  const LoginScreen({this.onLoginSuccess, super.key});

  final VoidCallback? onLoginSuccess;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.listen<LoginState>(loginControllerProvider, (previous, next) {
      if (next.succeeded && previous?.succeeded != true) {
        onLoginSuccess?.call();
      }
    });

    final state = ref.watch(loginControllerProvider);
    final controller = ref.read(loginControllerProvider.notifier);

    return Scaffold(
      backgroundColor: WebTuiColors.surface,
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(
            WebTuiSpacing.xl,
            WebTuiSpacing.xxl,
            WebTuiSpacing.xl,
            WebTuiSpacing.lg,
          ),
          children: [
            const _LoginHeader(),
            const SizedBox(height: WebTuiSpacing.xxl),
            _LoginTextField(
              fieldKey: const Key('login_identifier_field'),
              label: 'Email hoặc username',
              icon: Icons.alternate_email_rounded,
              keyboardType: TextInputType.emailAddress,
              textInputAction: TextInputAction.next,
              enabled: !state.isLoading,
              onChanged: controller.updateIdentifier,
            ),
            const SizedBox(height: WebTuiSpacing.md),
            _LoginTextField(
              fieldKey: const Key('login_password_field'),
              label: 'Mật khẩu',
              icon: Icons.lock_outline_rounded,
              obscureText: true,
              enabled: !state.isLoading,
              onChanged: controller.updatePassword,
              onSubmitted: (_) => controller.submit(),
            ),
            const SizedBox(height: WebTuiSpacing.md),
            if (state.errorMessage != null)
              _LoginStatusBanner.error(state.errorMessage!),
            if (state.succeeded) _LoginStatusBanner.success(),
            const SizedBox(height: WebTuiSpacing.lg),
            SizedBox(
              height: 48,
              child: FilledButton.icon(
                key: const Key('login_submit_button'),
                onPressed: state.canSubmit ? controller.submit : null,
                icon: state.isLoading
                    ? const SizedBox.square(
                        dimension: 18,
                        child: CircularProgressIndicator(strokeWidth: 2.2),
                      )
                    : const Icon(Icons.login_rounded),
                label: Text(
                  state.isLoading ? 'Đang đăng nhập...' : 'Đăng nhập',
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _LoginHeader extends StatelessWidget {
  const _LoginHeader();

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: WebTuiSpacing.lg),
        DecoratedBox(
          decoration: BoxDecoration(
            color: WebTuiColors.primarySoft,
            borderRadius: BorderRadius.circular(WebTuiRadii.md),
          ),
          child: const Padding(
            padding: EdgeInsets.all(WebTuiSpacing.md),
            child: Icon(
              Icons.chat_bubble_rounded,
              color: WebTuiColors.primary,
              size: 28,
            ),
          ),
        ),
        const SizedBox(height: WebTuiSpacing.lg),
        Text(
          'Đăng nhập WebTui',
          style: WebTuiTypography.titleLarge.copyWith(
            color: WebTuiColors.textPrimary,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: WebTuiSpacing.xs),
        Text(
          'Dùng email hoặc username để tiếp tục.',
          style: WebTuiTypography.bodyMedium.copyWith(
            color: WebTuiColors.textMuted,
          ),
        ),
      ],
    );
  }
}

class _LoginTextField extends StatelessWidget {
  const _LoginTextField({
    required this.label,
    required this.icon,
    required this.onChanged,
    this.fieldKey,
    this.enabled = true,
    this.obscureText = false,
    this.keyboardType,
    this.textInputAction,
    this.onSubmitted,
  });

  final String label;
  final IconData icon;
  final ValueChanged<String> onChanged;
  final Key? fieldKey;
  final bool enabled;
  final bool obscureText;
  final TextInputType? keyboardType;
  final TextInputAction? textInputAction;
  final ValueChanged<String>? onSubmitted;

  @override
  Widget build(BuildContext context) {
    return TextField(
      key: fieldKey,
      enabled: enabled,
      obscureText: obscureText,
      keyboardType: keyboardType,
      textInputAction: textInputAction,
      onChanged: onChanged,
      onSubmitted: onSubmitted,
      decoration: InputDecoration(
        labelText: label,
        prefixIcon: Icon(icon),
        filled: true,
        fillColor: WebTuiColors.background,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(WebTuiRadii.md),
          borderSide: const BorderSide(color: WebTuiColors.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(WebTuiRadii.md),
          borderSide: const BorderSide(color: WebTuiColors.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(WebTuiRadii.md),
          borderSide: const BorderSide(color: WebTuiColors.primary),
        ),
      ),
    );
  }
}

class _LoginStatusBanner extends StatelessWidget {
  const _LoginStatusBanner._({
    required this.message,
    required this.icon,
    required this.color,
    required this.background,
  });

  _LoginStatusBanner.error(String message)
    : this._(
        message: message,
        icon: Icons.error_outline_rounded,
        color: WebTuiColors.danger,
        background: Color(0xFFFFF1F1),
      );

  _LoginStatusBanner.success()
    : this._(
        message: 'Đăng nhập thành công.',
        icon: Icons.check_circle_outline_rounded,
        color: WebTuiColors.accentGreen,
        background: Color(0xFFEAF8F1),
      );

  final String message;
  final IconData icon;
  final Color color;
  final Color background;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(WebTuiRadii.md),
        border: Border.all(color: color.withValues(alpha: 0.24)),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: WebTuiSpacing.md,
          vertical: WebTuiSpacing.sm,
        ),
        child: Row(
          children: [
            Icon(icon, color: color, size: 18),
            const SizedBox(width: WebTuiSpacing.sm),
            Expanded(
              child: Text(
                message,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: WebTuiTypography.bodySmall.copyWith(
                  color: WebTuiColors.textPrimary,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

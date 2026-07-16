import 'package:flutter/material.dart';

import '../tokens/webtui_colors.dart';
import '../tokens/webtui_radii.dart';
import '../tokens/webtui_spacing.dart';
import '../tokens/webtui_typography.dart';

final class WebTuiTheme {
  const WebTuiTheme._();

  static ThemeData light() {
    final colorScheme = ColorScheme.fromSeed(
      seedColor: WebTuiColors.primary,
      brightness: Brightness.light,
      primary: WebTuiColors.primary,
      surface: WebTuiColors.surface,
    );

    return ThemeData(
      useMaterial3: true,
      colorScheme: colorScheme,
      scaffoldBackgroundColor: WebTuiColors.background,
      textTheme: WebTuiTypography.textTheme,
      appBarTheme: const AppBarTheme(
        backgroundColor: WebTuiColors.surface,
        foregroundColor: WebTuiColors.textPrimary,
        elevation: 0,
        centerTitle: false,
      ),
      dividerTheme: const DividerThemeData(
        color: WebTuiColors.border,
        thickness: 1,
        space: 1,
      ),
      navigationBarTheme: NavigationBarThemeData(
        height: 64,
        elevation: 0,
        backgroundColor: WebTuiColors.surface,
        indicatorColor: WebTuiColors.primarySoft,
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return WebTuiTypography.labelSmall.copyWith(
            color: selected ? WebTuiColors.primary : WebTuiColors.textMuted,
            fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
          );
        }),
        iconTheme: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return IconThemeData(
            color: selected ? WebTuiColors.primary : WebTuiColors.textMuted,
            size: 22,
          );
        }),
      ),
      segmentedButtonTheme: SegmentedButtonThemeData(
        style: ButtonStyle(
          backgroundColor: WidgetStateProperty.resolveWith((states) {
            return states.contains(WidgetState.selected)
                ? WebTuiColors.surface
                : WebTuiColors.backgroundMuted;
          }),
          foregroundColor: WidgetStateProperty.resolveWith((states) {
            return states.contains(WidgetState.selected)
                ? WebTuiColors.primary
                : WebTuiColors.textSecondary;
          }),
          side: const WidgetStatePropertyAll(BorderSide.none),
          padding: const WidgetStatePropertyAll(
            EdgeInsets.symmetric(horizontal: WebTuiSpacing.sm),
          ),
          shape: WidgetStatePropertyAll(
            RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(WebTuiRadii.segmented),
            ),
          ),
        ),
      ),
    );
  }
}

import 'package:flutter/material.dart';

import '../tokens/webtui_colors.dart';
import '../tokens/webtui_density.dart';
import '../tokens/webtui_radii.dart';
import '../tokens/webtui_spacing.dart';
import '../tokens/webtui_typography.dart';

class WebTuiSegmentedTabs extends StatelessWidget {
  const WebTuiSegmentedTabs({
    required this.tabs,
    required this.selectedIndex,
    required this.onChanged,
    super.key,
  });

  final List<String> tabs;
  final int selectedIndex;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: WebTuiSegmentedControlTokens.height,
      padding: const EdgeInsets.all(WebTuiSpacing.xxs),
      decoration: BoxDecoration(
        color: WebTuiColors.backgroundMuted,
        borderRadius: BorderRadius.circular(WebTuiRadii.segmented),
      ),
      child: Row(
        children: [
          for (var index = 0; index < tabs.length; index++)
            Expanded(
              child: _SegmentButton(
                label: tabs[index],
                selected: selectedIndex == index,
                onTap: () => onChanged(index),
              ),
            ),
        ],
      ),
    );
  }
}

class _SegmentButton extends StatelessWidget {
  const _SegmentButton({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected ? WebTuiColors.surface : Colors.transparent,
      borderRadius: BorderRadius.circular(WebTuiRadii.sm),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(WebTuiRadii.sm),
        child: Center(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: WebTuiSpacing.xs),
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: WebTuiTypography.labelSmall.copyWith(
                color: selected
                    ? WebTuiColors.primary
                    : WebTuiColors.textSecondary,
                fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

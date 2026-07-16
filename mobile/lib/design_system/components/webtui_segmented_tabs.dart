import 'package:flutter/material.dart';

import '../tokens/webtui_colors.dart';
import '../tokens/webtui_density.dart';
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
      decoration: const BoxDecoration(
        color: WebTuiColors.surface,
        border: Border(bottom: BorderSide(color: WebTuiColors.border)),
      ),
      child: tabs.length <= 3
          ? Row(
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
            )
          : ListView.separated(
              scrollDirection: Axis.horizontal,
              physics: const BouncingScrollPhysics(),
              itemCount: tabs.length,
              separatorBuilder: (_, _) => const SizedBox.shrink(),
              itemBuilder: (context, index) {
                return SizedBox(
                  width: 92,
                  child: _SegmentButton(
                    label: tabs[index],
                    selected: selectedIndex == index,
                    onTap: () => onChanged(index),
                  ),
                );
              },
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
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        child: Stack(
          fit: StackFit.expand,
          children: [
            Center(
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: WebTuiSpacing.xs,
                ),
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: WebTuiTypography.bodySmall.copyWith(
                    color: selected
                        ? WebTuiColors.primary
                        : WebTuiColors.textMuted,
                    fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                  ),
                ),
              ),
            ),
            if (selected)
              Positioned(
                left: WebTuiSpacing.md,
                right: WebTuiSpacing.md,
                bottom: 0,
                child: Container(
                  height: 2,
                  decoration: BoxDecoration(
                    color: WebTuiColors.primary,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

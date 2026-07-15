import 'package:flutter/material.dart';

import '../tokens/webtui_colors.dart';
import '../tokens/webtui_radii.dart';
import '../tokens/webtui_spacing.dart';
import '../tokens/webtui_typography.dart';

class WebTuiMessageBubble extends StatelessWidget {
  const WebTuiMessageBubble({
    required this.text,
    required this.timeLabel,
    this.outgoing = false,
    this.statusLabel,
    super.key,
  });

  final String text;
  final String timeLabel;
  final bool outgoing;
  final String? statusLabel;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: outgoing ? Alignment.centerRight : Alignment.centerLeft,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 286),
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: outgoing ? WebTuiColors.primary : WebTuiColors.surface,
            borderRadius: BorderRadius.only(
              topLeft: const Radius.circular(WebTuiRadii.md),
              topRight: const Radius.circular(WebTuiRadii.md),
              bottomLeft: Radius.circular(
                outgoing ? WebTuiRadii.md : WebTuiRadii.xs,
              ),
              bottomRight: Radius.circular(
                outgoing ? WebTuiRadii.xs : WebTuiRadii.md,
              ),
            ),
            border: outgoing ? null : Border.all(color: WebTuiColors.border),
          ),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(
              WebTuiSpacing.md,
              WebTuiSpacing.sm,
              WebTuiSpacing.md,
              WebTuiSpacing.sm,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  text,
                  style: WebTuiTypography.bodyMedium.copyWith(
                    color: outgoing
                        ? WebTuiColors.textOnPrimary
                        : WebTuiColors.textPrimary,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: WebTuiSpacing.xs),
                Text(
                  statusLabel == null ? timeLabel : '$timeLabel • $statusLabel',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: WebTuiTypography.labelSmall.copyWith(
                    color: outgoing
                        ? WebTuiColors.textOnPrimary.withValues(alpha: 0.78)
                        : WebTuiColors.textMuted,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

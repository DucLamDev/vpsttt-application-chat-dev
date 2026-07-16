import 'package:flutter/material.dart';

import '../tokens/webtui_colors.dart';
import '../tokens/webtui_radii.dart';
import '../tokens/webtui_spacing.dart';
import '../tokens/webtui_typography.dart';

class WebTuiSearchBar extends StatelessWidget {
  const WebTuiSearchBar({
    required this.hintText,
    this.controller,
    this.onChanged,
    this.onTap,
    super.key,
  });

  final String hintText;
  final TextEditingController? controller;
  final ValueChanged<String>? onChanged;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: WebTuiColors.backgroundMuted,
      borderRadius: BorderRadius.circular(WebTuiRadii.md),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(WebTuiRadii.md),
        child: SizedBox(
          height: 36,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: WebTuiSpacing.md),
            child: Row(
              children: [
                const Icon(
                  Icons.search_rounded,
                  size: 18,
                  color: WebTuiColors.textMuted,
                ),
                const SizedBox(width: WebTuiSpacing.sm),
                Expanded(
                  child: onChanged == null && controller == null
                      ? Text(
                          hintText,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: WebTuiTypography.bodySmall.copyWith(
                            color: WebTuiColors.textMuted,
                          ),
                        )
                      : TextField(
                          controller: controller,
                          onChanged: onChanged,
                          maxLines: 1,
                          textInputAction: TextInputAction.search,
                          decoration: InputDecoration.collapsed(
                            hintText: hintText,
                            hintStyle: WebTuiTypography.bodySmall.copyWith(
                              color: WebTuiColors.textMuted,
                            ),
                          ),
                          style: WebTuiTypography.bodySmall.copyWith(
                            color: WebTuiColors.textPrimary,
                          ),
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

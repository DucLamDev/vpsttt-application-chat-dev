import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';

import '../tokens/webtui_colors.dart';
import '../tokens/webtui_spacing.dart';
import '../tokens/webtui_typography.dart';

class WebTuiSearchBar extends StatefulWidget {
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
  State<WebTuiSearchBar> createState() => _WebTuiSearchBarState();
}

class _WebTuiSearchBarState extends State<WebTuiSearchBar> {
  final _focusNode = FocusNode();

  @override
  void initState() {
    super.initState();
    _focusNode.addListener(_handleFocusChanged);
  }

  @override
  void dispose() {
    _focusNode
      ..removeListener(_handleFocusChanged)
      ..dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final focused = _focusNode.hasFocus;
    final interactive = widget.onChanged != null || widget.controller != null;

    return AnimatedContainer(
      duration: const Duration(milliseconds: 160),
      curve: Curves.easeOutCubic,
      height: 52,
      decoration: BoxDecoration(
        color: WebTuiColors.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: focused
              ? WebTuiColors.primary.withValues(alpha: 0.72)
              : WebTuiColors.border,
          width: focused ? 1.3 : 1,
        ),
        boxShadow: [
          BoxShadow(
            color: WebTuiColors.textPrimary.withValues(
              alpha: focused ? 0.08 : 0.045,
            ),
            blurRadius: focused ? 18 : 12,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () {
            widget.onTap?.call();
            if (interactive) {
              _focusNode.requestFocus();
            }
          },
          borderRadius: BorderRadius.circular(18),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: WebTuiSpacing.md),
            child: Row(
              children: [
                Icon(
                  CupertinoIcons.search,
                  size: 19,
                  color: focused
                      ? WebTuiColors.primary
                      : WebTuiColors.textSecondary,
                ),
                const SizedBox(width: WebTuiSpacing.md),
                Expanded(
                  child: interactive
                      ? TextField(
                          controller: widget.controller,
                          focusNode: _focusNode,
                          onChanged: widget.onChanged,
                          maxLines: 1,
                          textInputAction: TextInputAction.search,
                          cursorColor: WebTuiColors.primary,
                          decoration: InputDecoration.collapsed(
                            hintText: widget.hintText,
                            hintStyle: WebTuiTypography.bodyMedium.copyWith(
                              color: WebTuiColors.textMuted,
                            ),
                          ),
                          style: WebTuiTypography.bodyMedium.copyWith(
                            color: WebTuiColors.textPrimary,
                            fontWeight: FontWeight.w500,
                          ),
                        )
                      : Text(
                          widget.hintText,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: WebTuiTypography.bodyMedium.copyWith(
                            color: WebTuiColors.textMuted,
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

  void _handleFocusChanged() {
    if (mounted) {
      setState(() {});
    }
  }
}

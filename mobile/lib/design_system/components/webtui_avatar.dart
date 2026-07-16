import 'package:flutter/material.dart';

import '../tokens/webtui_colors.dart';
import '../tokens/webtui_density.dart';
import '../tokens/webtui_radii.dart';
import '../tokens/webtui_typography.dart';

enum WebTuiPresenceStatus {
  online,
  away,
  offline;

  Color get color {
    return switch (this) {
      WebTuiPresenceStatus.online => WebTuiColors.accentGreen,
      WebTuiPresenceStatus.away => WebTuiColors.accentAmber,
      WebTuiPresenceStatus.offline => WebTuiColors.textMuted,
    };
  }
}

class WebTuiAvatar extends StatelessWidget {
  const WebTuiAvatar({
    required this.label,
    this.icon,
    this.status,
    this.color = WebTuiColors.primarySoft,
    this.foregroundColor = WebTuiColors.primary,
    this.size = WebTuiListDensity.avatarSize,
    super.key,
  });

  final String label;
  final IconData? icon;
  final WebTuiPresenceStatus? status;
  final Color color;
  final Color foregroundColor;
  final double size;

  @override
  Widget build(BuildContext context) {
    return SizedBox.square(
      dimension: size,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                color: color,
                borderRadius: BorderRadius.circular(WebTuiRadii.avatar),
              ),
              child: Center(
                child: icon == null
                    ? Text(
                        _initials,
                        maxLines: 1,
                        overflow: TextOverflow.clip,
                        style: WebTuiTypography.bodyMedium.copyWith(
                          color: foregroundColor,
                          fontWeight: FontWeight.w800,
                        ),
                      )
                    : Icon(icon, color: foregroundColor, size: size * 0.5),
              ),
            ),
          ),
          if (status != null)
            Positioned(
              right: -1,
              bottom: -1,
              child: Container(
                width: 12,
                height: 12,
                decoration: BoxDecoration(
                  color: status!.color,
                  shape: BoxShape.circle,
                  border: Border.all(color: WebTuiColors.surface, width: 2),
                ),
              ),
            ),
        ],
      ),
    );
  }

  String get _initials {
    final normalized = label.trim();
    if (normalized.isEmpty) {
      return '?';
    }

    final words = normalized.split(RegExp(r'\s+'));
    if (words.length == 1) {
      return words.first.characters.take(2).toString().toUpperCase();
    }

    return '${words.first.characters.first}${words.last.characters.first}'
        .toUpperCase();
  }
}

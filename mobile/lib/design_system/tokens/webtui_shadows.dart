import 'package:flutter/material.dart';

import 'webtui_colors.dart';

final class WebTuiShadows {
  const WebTuiShadows._();

  static const soft = [
    BoxShadow(color: Color(0x140F172A), blurRadius: 12, offset: Offset(0, 4)),
  ];

  static const divider = BoxShadow(
    color: WebTuiColors.border,
    blurRadius: 0,
    offset: Offset(0, 1),
  );
}

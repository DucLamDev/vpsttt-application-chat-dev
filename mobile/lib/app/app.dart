import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/privacy/background_privacy.dart';
import '../design_system/theme/webtui_theme.dart';
import 'flavor/app_config.dart';
import 'router/app_router.dart';

class WebTuiChatApp extends ConsumerWidget {
  const WebTuiChatApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final config = ref.watch(appConfigProvider);
    final router = ref.watch(appRouterProvider);

    return MaterialApp.router(
      title: config.appTitle,
      debugShowCheckedModeBanner: false,
      theme: WebTuiTheme.light(),
      routerConfig: router,
      builder: (context, child) {
        return PrivacyGuard(child: child ?? const SizedBox.shrink());
      },
    );
  }
}

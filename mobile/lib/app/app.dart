import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/privacy/background_privacy.dart';
import '../design_system/components/webtui_avatar.dart';
import '../design_system/theme/webtui_theme.dart';
import 'flavor/app_config.dart';
import 'providers/foundation_providers.dart';
import 'router/app_router.dart';

class WebTuiChatApp extends ConsumerWidget {
  const WebTuiChatApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final config = ref.watch(appConfigProvider);
    final router = ref.watch(appRouterProvider);
    final tokenRepository = ref.read(authTokenRepositoryProvider);

    return MaterialApp.router(
      title: config.appTitle,
      debugShowCheckedModeBanner: false,
      theme: WebTuiTheme.light(),
      routerConfig: router,
      builder: (context, child) {
        return FutureBuilder<String?>(
          future: tokenRepository.readAccessToken(),
          builder: (context, snapshot) {
            final token = snapshot.data?.trim();
            final headers = token == null || token.isEmpty
                ? null
                : {'Authorization': 'Bearer $token'};
            return WebTuiAvatarNetworkScope(
              apiBaseUri: config.apiBaseUri,
              headers: headers,
              child: PrivacyGuard(child: child ?? const SizedBox.shrink()),
            );
          },
        );
      },
    );
  }
}

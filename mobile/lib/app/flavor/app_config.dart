import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app_flavor.dart';

final appConfigProvider = Provider<AppConfig>((_) {
  throw StateError('AppConfig must be provided from bootstrap.');
});

final class AppConfig {
  const AppConfig({required this.flavor, required this.apiBaseUri});

  factory AppConfig.fromFlavor(AppFlavor flavor) {
    const configuredBaseUrl = String.fromEnvironment(
      'WEBTUI_API_BASE_URL',
      defaultValue: '',
    );

    return AppConfig(
      flavor: flavor,
      apiBaseUri: configuredBaseUrl.isEmpty
          ? flavor.defaultApiBaseUri
          : Uri.parse(configuredBaseUrl),
    );
  }

  final AppFlavor flavor;
  final Uri apiBaseUri;

  String get appTitle {
    return 'Webtui Chat';
  }

  bool get showDebugBanner => flavor != AppFlavor.prod;
}

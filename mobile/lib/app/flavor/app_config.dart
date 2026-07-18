import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app_flavor.dart';

final appConfigProvider = Provider<AppConfig>((_) {
  throw StateError('AppConfig must be provided from bootstrap.');
});

final class AppConfig {
  const AppConfig({
    required this.flavor,
    required this.apiBaseUri,
    this.appVersion = '1.0.0',
    this.releaseChannel = 'internal',
  });

  factory AppConfig.fromFlavor(AppFlavor flavor) {
    const configuredBaseUrl = String.fromEnvironment(
      'WEBTUI_API_BASE_URL',
      defaultValue: '',
    );
    const configuredAppVersion = String.fromEnvironment(
      'WEBTUI_APP_VERSION',
      defaultValue: '1.0.0',
    );
    const configuredReleaseChannel = String.fromEnvironment(
      'WEBTUI_RELEASE_CHANNEL',
      defaultValue: '',
    );

    return AppConfig(
      flavor: flavor,
      apiBaseUri: configuredBaseUrl.isEmpty
          ? flavor.defaultApiBaseUri
          : Uri.parse(configuredBaseUrl),
      appVersion: configuredAppVersion,
      releaseChannel: configuredReleaseChannel.isEmpty
          ? _defaultReleaseChannel(flavor)
          : configuredReleaseChannel,
    );
  }

  final AppFlavor flavor;
  final Uri apiBaseUri;
  final String appVersion;
  final String releaseChannel;

  String get appTitle {
    return 'Webtui Chat';
  }

  bool get showDebugBanner => flavor != AppFlavor.prod;
}

String _defaultReleaseChannel(AppFlavor flavor) {
  return switch (flavor) {
    AppFlavor.dev => 'internal',
    AppFlavor.staging => 'beta',
    AppFlavor.prod => 'stable',
  };
}

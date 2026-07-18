import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/notifications/push_notification_service.dart';
import 'app.dart';
import 'flavor/app_config.dart';
import 'flavor/app_flavor.dart';

Future<void> bootstrap({required AppFlavor flavor}) async {
  WidgetsFlutterBinding.ensureInitialized();
  configureFirebaseBackgroundMessaging();
  await ensureFirebaseRuntime();

  runApp(
    ProviderScope(
      overrides: [
        appConfigProvider.overrideWithValue(AppConfig.fromFlavor(flavor)),
      ],
      child: const WebTuiChatApp(),
    ),
  );
}

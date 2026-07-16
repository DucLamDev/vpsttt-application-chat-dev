import 'dart:io';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/widgets.dart';

import '../../features/auth/domain/repositories/device_identity_repository.dart';
import '../network/api_transport.dart';
import 'firebase_runtime_options.dart';

final class PushNotificationService {
  PushNotificationService({
    required ApiTransport api,
    required DeviceIdentityRepository deviceIdentityRepository,
  }) : _api = api,
       _deviceIdentityRepository = deviceIdentityRepository;

  final ApiTransport _api;
  final DeviceIdentityRepository _deviceIdentityRepository;
  String? _registeredKey;
  bool _tokenRefreshListening = false;

  Future<void> registerForWorkspace(String workspaceId) async {
    final normalizedWorkspaceId = workspaceId.trim();
    if (normalizedWorkspaceId.isEmpty) {
      return;
    }

    final device = await _deviceIdentityRepository.currentDevice();
    final firebase = await _ensureFirebase();
    final permission = firebase ? await _requestPermission() : 'unknown';
    final token = firebase ? await _readFcmToken() : null;
    final key =
        '${device.id}:$normalizedWorkspaceId:${token ?? ''}:$permission';
    if (_registeredKey == key) {
      return;
    }

    await _upsertDevice(
      workspaceId: normalizedWorkspaceId,
      deviceId: device.id,
      platform: _platform(),
      pushToken: token,
      notificationPermission: permission,
    );
    _registeredKey = key;

    if (firebase && !_tokenRefreshListening) {
      _tokenRefreshListening = true;
      FirebaseMessaging.instance.onTokenRefresh.listen((nextToken) {
        _registeredKey = null;
        _upsertDevice(
          workspaceId: normalizedWorkspaceId,
          deviceId: device.id,
          platform: _platform(),
          pushToken: nextToken,
          notificationPermission: permission,
        );
      });
    }
  }

  Future<bool> _ensureFirebase() async {
    try {
      if (Firebase.apps.isEmpty) {
        final options = FirebaseRuntimeOptions.currentPlatform();
        if (options == null) {
          await Firebase.initializeApp();
        } else {
          await Firebase.initializeApp(options: options);
        }
      }
      return true;
    } on Object {
      return false;
    }
  }

  Future<String> _requestPermission() async {
    try {
      final settings = await FirebaseMessaging.instance.requestPermission(
        alert: true,
        badge: true,
        sound: true,
      );
      return switch (settings.authorizationStatus) {
        AuthorizationStatus.authorized => 'granted',
        AuthorizationStatus.provisional => 'provisional',
        AuthorizationStatus.denied => 'denied',
        AuthorizationStatus.notDetermined => 'unknown',
      };
    } on Object {
      return 'unknown';
    }
  }

  Future<String?> _readFcmToken() async {
    try {
      final token = await FirebaseMessaging.instance.getToken();
      final trimmed = token?.trim();
      return trimmed == null || trimmed.isEmpty ? null : trimmed;
    } on Object {
      return null;
    }
  }

  Future<void> _upsertDevice({
    required String workspaceId,
    required String deviceId,
    required String platform,
    required String? pushToken,
    required String notificationPermission,
  }) async {
    await _api.post<Object>(
      '/api/v1/mobile/devices',
      data: {
        'workspace_id': workspaceId,
        'device_id': deviceId,
        'platform': platform,
        'push_provider': pushToken == null ? 'none' : 'fcm',
        'push_token': pushToken ?? '',
        'notification_permission': notificationPermission,
        'release_channel': 'mobile',
        'locale': WidgetsBinding.instance.platformDispatcher.locale
            .toLanguageTag(),
        'timezone': DateTime.now().timeZoneName,
      },
    );
  }
}

String _platform() {
  if (Platform.isAndroid) {
    return 'android';
  }
  if (Platform.isIOS) {
    return 'ios';
  }
  return 'desktop';
}

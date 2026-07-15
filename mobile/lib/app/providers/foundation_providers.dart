import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../../core/api/openapi_client_boundary.dart';
import '../../core/database/app_database.dart';
import '../../core/logging/redacting_logger.dart';
import '../../core/network/api_transport.dart';
import '../../core/network/request_id.dart';
import '../../core/security/secure_key_value_store.dart';
import '../../features/auth/application/use_cases/app_lock_use_cases.dart';
import '../../features/auth/application/use_cases/login_use_case.dart';
import '../../features/auth/application/use_cases/logout_use_case.dart';
import '../../features/auth/application/use_cases/refresh_access_token_use_case.dart';
import '../../features/auth/application/use_cases/session_use_cases.dart';
import '../../features/auth/data/datasources/auth_remote_data_source.dart';
import '../../features/auth/data/network/auth_refresh_interceptor.dart';
import '../../features/auth/data/repositories/auth_repository_impl.dart';
import '../../features/auth/data/repositories/local_session_state_repository.dart';
import '../../features/auth/data/repositories/secure_app_lock_repository.dart';
import '../../features/auth/data/repositories/secure_auth_token_repository.dart';
import '../../features/auth/data/repositories/secure_device_identity_repository.dart';
import '../../features/auth/domain/repositories/app_lock_repository.dart';
import '../../features/auth/domain/repositories/auth_repository.dart';
import '../../features/auth/domain/repositories/auth_token_repository.dart';
import '../../features/auth/domain/repositories/device_identity_repository.dart';
import '../../features/auth/domain/repositories/session_state_repository.dart';
import '../../features/conversations/application/use_cases/channel_use_cases.dart';
import '../../features/conversations/application/use_cases/load_conversation_home_use_case.dart';
import '../../features/conversations/application/use_cases/message_use_cases.dart';
import '../../features/conversations/application/use_cases/open_direct_conversation_use_case.dart';
import '../../features/conversations/data/datasources/conversation_remote_data_source.dart';
import '../../features/conversations/data/repositories/conversation_repository_impl.dart';
import '../../features/conversations/data/repositories/local_conversation_draft_repository.dart';
import '../../features/conversations/domain/repositories/conversation_repository.dart';
import '../../features/profile/application/use_cases/profile_use_cases.dart';
import '../../features/profile/data/datasources/avatar_remote_data_source.dart';
import '../../features/profile/data/datasources/profile_remote_data_source.dart';
import '../../features/profile/data/repositories/avatar_upload_repository_impl.dart';
import '../../features/profile/data/repositories/image_picker_avatar_repository.dart';
import '../../features/profile/data/repositories/profile_repository_impl.dart';
import '../../features/profile/domain/repositories/avatar_repository.dart';
import '../../features/profile/domain/repositories/profile_repository.dart';
import '../../features/settings/application/use_cases/app_settings_use_cases.dart';
import '../../features/settings/data/repositories/local_app_settings_repository.dart';
import '../../features/settings/domain/repositories/app_settings_repository.dart';
import '../../features/workspace/application/use_cases/load_workspace_session_use_case.dart';
import '../../features/workspace/application/use_cases/select_workspace_use_case.dart';
import '../../features/workspace/data/datasources/permission_remote_data_source.dart';
import '../../features/workspace/data/datasources/workspace_remote_data_source.dart';
import '../../features/workspace/data/repositories/local_workspace_session_repository.dart';
import '../../features/workspace/data/repositories/permission_repository_impl.dart';
import '../../features/workspace/data/repositories/workspace_repository_impl.dart';
import '../../features/workspace/domain/repositories/permission_repository.dart';
import '../../features/workspace/domain/repositories/workspace_repository.dart';
import '../../features/workspace/domain/repositories/workspace_session_repository.dart';
import '../flavor/app_config.dart';

final redactingLoggerProvider = Provider<RedactingLogger>((_) {
  return RedactingLogger();
});

final requestIdGeneratorProvider = Provider<RequestIdGenerator>((_) {
  return const UuidRequestIdGenerator();
});

final dioProvider = Provider<Dio>((ref) {
  final config = ref.watch(appConfigProvider);
  final logger = ref.watch(redactingLoggerProvider);
  final requestIds = ref.watch(requestIdGeneratorProvider);
  final tokenRepository = ref.watch(authTokenRepositoryProvider);
  final refreshUseCase = ref.watch(refreshAccessTokenUseCaseProvider);

  final dio = _configuredDio(config);

  dio.interceptors.addAll([
    RequestIdInterceptor(requestIds),
    AuthRefreshInterceptor(
      dio: dio,
      tokenRepository: tokenRepository,
      refreshAccessTokenUseCase: refreshUseCase,
    ),
    RedactingDioLogInterceptor(logger),
  ]);

  return dio;
});

final authDioProvider = Provider<Dio>((ref) {
  final config = ref.watch(appConfigProvider);
  final logger = ref.watch(redactingLoggerProvider);
  final requestIds = ref.watch(requestIdGeneratorProvider);

  final dio = _configuredDio(config);
  dio.interceptors.addAll([
    RequestIdInterceptor(requestIds),
    RedactingDioLogInterceptor(logger),
  ]);
  return dio;
});

final apiTransportProvider = Provider<ApiTransport>((ref) {
  return DioApiTransport(ref.watch(dioProvider));
});

final authApiTransportProvider = Provider<ApiTransport>((ref) {
  return DioApiTransport(ref.watch(authDioProvider));
});

final openApiClientBoundaryProvider = Provider<WebTuiOpenApiClientBoundary>((
  ref,
) {
  return WebTuiOpenApiClientBoundary(ref.watch(dioProvider));
});

final appDatabaseProvider = Provider<AppDatabase>((ref) {
  final database = AppDatabase(createDriftConnection());
  ref.onDispose(database.close);
  return database;
});

final secureKeyValueStoreProvider = Provider<SecureKeyValueStore>((_) {
  return const FlutterSecureKeyValueStore(FlutterSecureStorage());
});

final authRemoteDataSourceProvider = Provider<AuthRemoteDataSource>((ref) {
  return AuthRemoteDataSource(ref.watch(authApiTransportProvider));
});

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return AuthRepositoryImpl(ref.watch(authRemoteDataSourceProvider));
});

final authTokenRepositoryProvider = Provider<AuthTokenRepository>((ref) {
  return SecureAuthTokenRepository(ref.watch(secureKeyValueStoreProvider));
});

final deviceIdentityRepositoryProvider = Provider<DeviceIdentityRepository>((
  ref,
) {
  return SecureDeviceIdentityRepository(
    secureStore: ref.watch(secureKeyValueStoreProvider),
  );
});

final sessionStateRepositoryProvider = Provider<SessionStateRepository>((ref) {
  return LocalSessionStateRepository(
    secureStore: ref.watch(secureKeyValueStoreProvider),
    database: ref.watch(appDatabaseProvider),
  );
});

final appLockRepositoryProvider = Provider<AppLockRepository>((ref) {
  return SecureAppLockRepository(ref.watch(secureKeyValueStoreProvider));
});

final loginUseCaseProvider = Provider<LoginUseCase>((ref) {
  return LoginUseCase(
    authRepository: ref.watch(authRepositoryProvider),
    tokenRepository: ref.watch(authTokenRepositoryProvider),
    deviceIdentityRepository: ref.watch(deviceIdentityRepositoryProvider),
  );
});

final refreshAccessTokenUseCaseProvider = Provider<RefreshAccessTokenUseCase>((
  ref,
) {
  return RefreshAccessTokenUseCase(
    authRepository: ref.watch(authRepositoryProvider),
    tokenRepository: ref.watch(authTokenRepositoryProvider),
  );
});

final logoutUseCaseProvider = Provider<LogoutUseCase>((ref) {
  return LogoutUseCase(
    authRepository: ref.watch(authRepositoryProvider),
    tokenRepository: ref.watch(authTokenRepositoryProvider),
    sessionStateRepository: ref.watch(sessionStateRepositoryProvider),
  );
});

final listSessionsUseCaseProvider = Provider<ListSessionsUseCase>((ref) {
  return ListSessionsUseCase(ref.watch(authRepositoryProvider));
});

final revokeSessionUseCaseProvider = Provider<RevokeSessionUseCase>((ref) {
  return RevokeSessionUseCase(ref.watch(authRepositoryProvider));
});

final revokeAllSessionsUseCaseProvider = Provider<RevokeAllSessionsUseCase>((
  ref,
) {
  return RevokeAllSessionsUseCase(ref.watch(authRepositoryProvider));
});

final isAppLockEnabledUseCaseProvider = Provider<IsAppLockEnabledUseCase>((
  ref,
) {
  return IsAppLockEnabledUseCase(ref.watch(appLockRepositoryProvider));
});

final enableAppLockUseCaseProvider = Provider<EnableAppLockUseCase>((ref) {
  return EnableAppLockUseCase(ref.watch(appLockRepositoryProvider));
});

final unlockAppUseCaseProvider = Provider<UnlockAppUseCase>((ref) {
  return UnlockAppUseCase(ref.watch(appLockRepositoryProvider));
});

final disableAppLockUseCaseProvider = Provider<DisableAppLockUseCase>((ref) {
  return DisableAppLockUseCase(ref.watch(appLockRepositoryProvider));
});

final workspaceRemoteDataSourceProvider = Provider<WorkspaceRemoteDataSource>((
  ref,
) {
  return WorkspaceRemoteDataSource(ref.watch(apiTransportProvider));
});

final permissionRemoteDataSourceProvider = Provider<PermissionRemoteDataSource>(
  (ref) {
    return PermissionRemoteDataSource(ref.watch(apiTransportProvider));
  },
);

final workspaceRepositoryProvider = Provider<WorkspaceRepository>((ref) {
  return WorkspaceRepositoryImpl(ref.watch(workspaceRemoteDataSourceProvider));
});

final permissionRepositoryProvider = Provider<PermissionRepository>((ref) {
  return PermissionRepositoryImpl(
    ref.watch(permissionRemoteDataSourceProvider),
  );
});

final workspaceSessionRepositoryProvider = Provider<WorkspaceSessionRepository>(
  (ref) {
    return LocalWorkspaceSessionRepository(
      secureStore: ref.watch(secureKeyValueStoreProvider),
      database: ref.watch(appDatabaseProvider),
    );
  },
);

final loadWorkspaceSessionUseCaseProvider =
    Provider<LoadWorkspaceSessionUseCase>((ref) {
      return LoadWorkspaceSessionUseCase(
        workspaceRepository: ref.watch(workspaceRepositoryProvider),
        permissionRepository: ref.watch(permissionRepositoryProvider),
        sessionRepository: ref.watch(workspaceSessionRepositoryProvider),
      );
    });

final selectWorkspaceUseCaseProvider = Provider<SelectWorkspaceUseCase>((ref) {
  return SelectWorkspaceUseCase(
    permissionRepository: ref.watch(permissionRepositoryProvider),
    sessionRepository: ref.watch(workspaceSessionRepositoryProvider),
  );
});

final profileRemoteDataSourceProvider = Provider<ProfileRemoteDataSource>((
  ref,
) {
  return ProfileRemoteDataSource(ref.watch(apiTransportProvider));
});

final avatarRemoteDataSourceProvider = Provider<AvatarRemoteDataSource>((ref) {
  return AvatarRemoteDataSource(ref.watch(apiTransportProvider));
});

final profileRepositoryProvider = Provider<ProfileRepository>((ref) {
  return ProfileRepositoryImpl(ref.watch(profileRemoteDataSourceProvider));
});

final avatarPickerRepositoryProvider = Provider<AvatarPickerRepository>((ref) {
  return ImagePickerAvatarRepository();
});

final avatarUploadRepositoryProvider = Provider<AvatarUploadRepository>((ref) {
  return AvatarUploadRepositoryImpl(ref.watch(avatarRemoteDataSourceProvider));
});

final loadProfileUseCaseProvider = Provider<LoadProfileUseCase>((ref) {
  return LoadProfileUseCase(ref.watch(profileRepositoryProvider));
});

final updateProfileUseCaseProvider = Provider<UpdateProfileUseCase>((ref) {
  return UpdateProfileUseCase(ref.watch(profileRepositoryProvider));
});

final changeAvatarUseCaseProvider = Provider<ChangeAvatarUseCase>((ref) {
  return ChangeAvatarUseCase(
    pickerRepository: ref.watch(avatarPickerRepositoryProvider),
    uploadRepository: ref.watch(avatarUploadRepositoryProvider),
    profileRepository: ref.watch(profileRepositoryProvider),
    workspaceSessionRepository: ref.watch(workspaceSessionRepositoryProvider),
  );
});

final appSettingsRepositoryProvider = Provider<AppSettingsRepository>((ref) {
  return LocalAppSettingsRepository(ref.watch(appDatabaseProvider));
});

final loadAppSettingsUseCaseProvider = Provider<LoadAppSettingsUseCase>((ref) {
  return LoadAppSettingsUseCase(ref.watch(appSettingsRepositoryProvider));
});

final saveAppSettingsUseCaseProvider = Provider<SaveAppSettingsUseCase>((ref) {
  return SaveAppSettingsUseCase(ref.watch(appSettingsRepositoryProvider));
});

final conversationRemoteDataSourceProvider =
    Provider<ConversationRemoteDataSource>((ref) {
      return ConversationRemoteDataSource(ref.watch(apiTransportProvider));
    });

final conversationRepositoryProvider = Provider<ConversationRepository>((ref) {
  return ConversationRepositoryImpl(
    ref.watch(conversationRemoteDataSourceProvider),
  );
});

final conversationDraftRepositoryProvider =
    Provider<ConversationDraftRepository>((ref) {
      return LocalConversationDraftRepository(ref.watch(appDatabaseProvider));
    });

final loadConversationHomeUseCaseProvider =
    Provider<LoadConversationHomeUseCase>((ref) {
      return LoadConversationHomeUseCase(
        conversationRepository: ref.watch(conversationRepositoryProvider),
        workspaceSessionRepository: ref.watch(
          workspaceSessionRepositoryProvider,
        ),
      );
    });

final openDirectConversationUseCaseProvider =
    Provider<OpenDirectConversationUseCase>((ref) {
      return OpenDirectConversationUseCase(
        ref.watch(conversationRepositoryProvider),
      );
    });

final createChannelUseCaseProvider = Provider<CreateChannelUseCase>((ref) {
  return CreateChannelUseCase(ref.watch(conversationRepositoryProvider));
});

final requestJoinChannelUseCaseProvider = Provider<RequestJoinChannelUseCase>((
  ref,
) {
  return RequestJoinChannelUseCase(ref.watch(conversationRepositoryProvider));
});

final openPrivateChannelSessionUseCaseProvider =
    Provider<OpenPrivateChannelSessionUseCase>((ref) {
      return OpenPrivateChannelSessionUseCase(
        ref.watch(conversationRepositoryProvider),
      );
    });

final loadChannelDetailUseCaseProvider = Provider<LoadChannelDetailUseCase>((
  ref,
) {
  return LoadChannelDetailUseCase(ref.watch(conversationRepositoryProvider));
});

final inviteChannelMemberUseCaseProvider = Provider<InviteChannelMemberUseCase>(
  (ref) {
    return InviteChannelMemberUseCase(
      ref.watch(conversationRepositoryProvider),
    );
  },
);

final loadChannelJoinRequestsUseCaseProvider =
    Provider<LoadChannelJoinRequestsUseCase>((ref) {
      return LoadChannelJoinRequestsUseCase(
        ref.watch(conversationRepositoryProvider),
      );
    });

final approveChannelJoinRequestUseCaseProvider =
    Provider<ApproveChannelJoinRequestUseCase>((ref) {
      return ApproveChannelJoinRequestUseCase(
        ref.watch(conversationRepositoryProvider),
      );
    });

final rejectChannelJoinRequestUseCaseProvider =
    Provider<RejectChannelJoinRequestUseCase>((ref) {
      return RejectChannelJoinRequestUseCase(
        ref.watch(conversationRepositoryProvider),
      );
    });

final loadMessagesUseCaseProvider = Provider<LoadMessagesUseCase>((ref) {
  return LoadMessagesUseCase(ref.watch(conversationRepositoryProvider));
});

final sendMessageUseCaseProvider = Provider<SendMessageUseCase>((ref) {
  return SendMessageUseCase(ref.watch(conversationRepositoryProvider));
});

final markConversationReadUseCaseProvider =
    Provider<MarkConversationReadUseCase>((ref) {
      return MarkConversationReadUseCase(
        ref.watch(conversationRepositoryProvider),
      );
    });

final readDraftUseCaseProvider = Provider<ReadDraftUseCase>((ref) {
  return ReadDraftUseCase(ref.watch(conversationDraftRepositoryProvider));
});

final saveDraftUseCaseProvider = Provider<SaveDraftUseCase>((ref) {
  return SaveDraftUseCase(ref.watch(conversationDraftRepositoryProvider));
});

final clearDraftUseCaseProvider = Provider<ClearDraftUseCase>((ref) {
  return ClearDraftUseCase(ref.watch(conversationDraftRepositoryProvider));
});

Dio _configuredDio(AppConfig config) {
  return Dio(
    BaseOptions(
      baseUrl: config.apiBaseUri.toString(),
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 30),
      sendTimeout: const Duration(seconds: 30),
      headers: const {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    ),
  );
}

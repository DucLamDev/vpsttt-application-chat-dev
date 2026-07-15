import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/providers/foundation_providers.dart';
import '../../application/use_cases/app_settings_use_cases.dart';
import '../../domain/entities/app_settings.dart';

final appSettingsControllerProvider =
    StateNotifierProvider.autoDispose<AppSettingsController, AppSettingsState>((
      ref,
    ) {
      return AppSettingsController(
        loadUseCase: ref.watch(loadAppSettingsUseCaseProvider),
        saveUseCase: ref.watch(saveAppSettingsUseCaseProvider),
      )..load();
    });

final class AppSettingsState {
  const AppSettingsState({
    this.settings = const AppSettings(),
    this.isLoading = false,
    this.errorMessage,
  });

  final AppSettings settings;
  final bool isLoading;
  final String? errorMessage;

  AppSettingsState copyWith({
    AppSettings? settings,
    bool? isLoading,
    String? errorMessage,
    bool clearError = false,
  }) {
    return AppSettingsState(
      settings: settings ?? this.settings,
      isLoading: isLoading ?? this.isLoading,
      errorMessage: clearError ? null : errorMessage ?? this.errorMessage,
    );
  }
}

final class AppSettingsController extends StateNotifier<AppSettingsState> {
  AppSettingsController({required this.loadUseCase, required this.saveUseCase})
    : super(const AppSettingsState());

  final LoadAppSettingsUseCase loadUseCase;
  final SaveAppSettingsUseCase saveUseCase;

  Future<void> load() async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final settings = await loadUseCase.execute();
      state = state.copyWith(settings: settings, isLoading: false);
    } on Object {
      state = state.copyWith(
        isLoading: false,
        errorMessage: 'Không thể tải thiết lập.',
      );
    }
  }

  Future<void> update(AppSettings settings) async {
    state = state.copyWith(settings: settings, clearError: true);
    try {
      await saveUseCase.execute(settings);
    } on Object {
      state = state.copyWith(errorMessage: 'Không thể lưu thiết lập.');
    }
  }
}

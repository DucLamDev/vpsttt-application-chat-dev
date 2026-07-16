import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/providers/foundation_providers.dart';
import '../../../../core/result/result.dart';
import '../../application/use_cases/login_use_case.dart';
import '../../application/use_cases/register_use_case.dart';
import '../../domain/entities/auth_session.dart';

enum AuthFormMode { login, register }

final loginControllerProvider =
    StateNotifierProvider.autoDispose<LoginController, LoginState>((ref) {
      return LoginController(
        loginUseCase: ref.watch(loginUseCaseProvider),
        registerUseCase: ref.watch(registerUseCaseProvider),
        googleLogin: () => ref.read(googleLoginUseCaseProvider).execute(),
      );
    });

final class LoginState {
  const LoginState({
    this.mode = AuthFormMode.login,
    this.displayName = '',
    this.email = '',
    this.username = '',
    this.domain = '',
    this.identifier = '',
    this.password = '',
    this.confirmPassword = '',
    this.remember = true,
    this.showPassword = false,
    this.showConfirmPassword = false,
    this.isLoading = false,
    this.isGoogleLoading = false,
    this.errorMessage,
    this.succeeded = false,
  });

  final AuthFormMode mode;
  final String displayName;
  final String email;
  final String username;
  final String domain;
  final String identifier;
  final String password;
  final String confirmPassword;
  final bool remember;
  final bool showPassword;
  final bool showConfirmPassword;
  final bool isLoading;
  final bool isGoogleLoading;
  final String? errorMessage;
  final bool succeeded;

  bool get isLogin => mode == AuthFormMode.login;

  bool get canSubmit {
    if (isLoading) {
      return false;
    }
    if (isLogin) {
      return identifier.trim().isNotEmpty && password.trim().isNotEmpty;
    }
    return displayName.trim().isNotEmpty &&
        email.trim().isNotEmpty &&
        username.trim().isNotEmpty &&
        password.trim().isNotEmpty &&
        confirmPassword.trim().isNotEmpty;
  }

  LoginState copyWith({
    AuthFormMode? mode,
    String? displayName,
    String? email,
    String? username,
    String? domain,
    String? identifier,
    String? password,
    String? confirmPassword,
    bool? remember,
    bool? showPassword,
    bool? showConfirmPassword,
    bool? isLoading,
    bool? isGoogleLoading,
    String? errorMessage,
    bool clearError = false,
    bool? succeeded,
  }) {
    return LoginState(
      mode: mode ?? this.mode,
      displayName: displayName ?? this.displayName,
      email: email ?? this.email,
      username: username ?? this.username,
      domain: domain ?? this.domain,
      identifier: identifier ?? this.identifier,
      password: password ?? this.password,
      confirmPassword: confirmPassword ?? this.confirmPassword,
      remember: remember ?? this.remember,
      showPassword: showPassword ?? this.showPassword,
      showConfirmPassword: showConfirmPassword ?? this.showConfirmPassword,
      isLoading: isLoading ?? this.isLoading,
      isGoogleLoading: isGoogleLoading ?? this.isGoogleLoading,
      errorMessage: clearError ? null : errorMessage ?? this.errorMessage,
      succeeded: succeeded ?? this.succeeded,
    );
  }
}

final class LoginController extends StateNotifier<LoginState> {
  LoginController({
    required LoginUseCase loginUseCase,
    required RegisterUseCase registerUseCase,
    required Future<Result<AuthSession>> Function() googleLogin,
  }) : _loginUseCase = loginUseCase,
       _registerUseCase = registerUseCase,
       _googleLogin = googleLogin,
       super(const LoginState());

  final LoginUseCase _loginUseCase;
  final RegisterUseCase _registerUseCase;
  final Future<Result<AuthSession>> Function() _googleLogin;

  void showLogin() => _setMode(AuthFormMode.login);
  void showRegister() => _setMode(AuthFormMode.register);

  void _setMode(AuthFormMode mode) {
    if (state.mode == mode || state.isLoading) {
      return;
    }
    state = state.copyWith(mode: mode, clearError: true, succeeded: false);
  }

  void updateDisplayName(String value) {
    state = state.copyWith(
      displayName: value,
      clearError: true,
      succeeded: false,
    );
  }

  void updateEmail(String value) {
    state = state.copyWith(email: value, clearError: true, succeeded: false);
  }

  void updateUsername(String value) {
    state = state.copyWith(username: value, clearError: true, succeeded: false);
  }

  void updateDomain(String value) {
    state = state.copyWith(domain: value, clearError: true, succeeded: false);
  }

  void updateIdentifier(String value) {
    state = state.copyWith(
      identifier: value,
      clearError: true,
      succeeded: false,
    );
  }

  void updatePassword(String value) {
    state = state.copyWith(password: value, clearError: true, succeeded: false);
  }

  void updateConfirmPassword(String value) {
    state = state.copyWith(
      confirmPassword: value,
      clearError: true,
      succeeded: false,
    );
  }

  void updateRemember(bool value) {
    state = state.copyWith(remember: value, clearError: true);
  }

  void togglePasswordVisibility() {
    state = state.copyWith(showPassword: !state.showPassword);
  }

  void toggleConfirmPasswordVisibility() {
    state = state.copyWith(showConfirmPassword: !state.showConfirmPassword);
  }

  Future<void> submit() async {
    if (state.isLoading || !state.canSubmit) {
      return;
    }

    state = state.copyWith(isLoading: true, clearError: true, succeeded: false);
    final result = state.isLogin
        ? await _loginUseCase.execute(
            LoginCommand(
              identifier: state.identifier,
              password: state.password,
            ),
          )
        : await _registerUseCase.execute(
            RegisterCommand(
              displayName: state.displayName,
              email: state.email,
              username: state.username,
              domain: state.domain,
              password: state.password,
              confirmPassword: state.confirmPassword,
            ),
          );

    switch (result) {
      case Success<AuthSession>():
        state = state.copyWith(isLoading: false, succeeded: true);
      case FailureResult<AuthSession>(failure: final failure):
        state = state.copyWith(
          isLoading: false,
          errorMessage: failure.message,
          succeeded: false,
        );
    }
  }

  Future<void> loginWithGoogle() async {
    if (state.isLoading) {
      return;
    }

    state = state.copyWith(
      isLoading: true,
      isGoogleLoading: true,
      clearError: true,
      succeeded: false,
    );
    final result = await _googleLogin();
    switch (result) {
      case Success<AuthSession>():
        state = state.copyWith(
          isLoading: false,
          isGoogleLoading: false,
          succeeded: true,
        );
      case FailureResult<AuthSession>(failure: final failure):
        state = state.copyWith(
          isLoading: false,
          isGoogleLoading: false,
          errorMessage: failure.message,
          succeeded: false,
        );
    }
  }
}

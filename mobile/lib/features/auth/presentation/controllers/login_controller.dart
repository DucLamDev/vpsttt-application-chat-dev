import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/providers/foundation_providers.dart';
import '../../../../core/result/result.dart';
import '../../application/use_cases/login_use_case.dart';
import '../../domain/entities/auth_session.dart';

final loginControllerProvider =
    StateNotifierProvider.autoDispose<LoginController, LoginState>((ref) {
      return LoginController(ref.watch(loginUseCaseProvider));
    });

final class LoginState {
  const LoginState({
    this.identifier = '',
    this.password = '',
    this.isLoading = false,
    this.errorMessage,
    this.succeeded = false,
  });

  final String identifier;
  final String password;
  final bool isLoading;
  final String? errorMessage;
  final bool succeeded;

  bool get canSubmit =>
      identifier.trim().isNotEmpty && password.trim().isNotEmpty && !isLoading;

  LoginState copyWith({
    String? identifier,
    String? password,
    bool? isLoading,
    String? errorMessage,
    bool clearError = false,
    bool? succeeded,
  }) {
    return LoginState(
      identifier: identifier ?? this.identifier,
      password: password ?? this.password,
      isLoading: isLoading ?? this.isLoading,
      errorMessage: clearError ? null : errorMessage ?? this.errorMessage,
      succeeded: succeeded ?? this.succeeded,
    );
  }
}

final class LoginController extends StateNotifier<LoginState> {
  LoginController(this._loginUseCase) : super(const LoginState());

  final LoginUseCase _loginUseCase;

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

  Future<void> submit() async {
    if (state.isLoading) {
      return;
    }

    state = state.copyWith(isLoading: true, clearError: true, succeeded: false);
    final result = await _loginUseCase.execute(
      LoginCommand(identifier: state.identifier, password: state.password),
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
}

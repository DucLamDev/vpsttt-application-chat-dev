import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:webtui_chat/app/providers/foundation_providers.dart';
import 'package:webtui_chat/core/result/result.dart';
import 'package:webtui_chat/features/workspace/application/use_cases/load_workspace_session_use_case.dart';
import 'package:webtui_chat/features/workspace/application/use_cases/select_workspace_use_case.dart';
import 'package:webtui_chat/features/workspace/domain/entities/workspace.dart';
import 'package:webtui_chat/features/workspace/domain/entities/workspace_permission.dart';
import 'package:webtui_chat/features/workspace/domain/repositories/permission_repository.dart';
import 'package:webtui_chat/features/workspace/domain/repositories/workspace_repository.dart';
import 'package:webtui_chat/features/workspace/domain/repositories/workspace_session_repository.dart';
import 'package:webtui_chat/features/workspace/presentation/screens/workspace_selector_screen.dart';

void main() {
  testWidgets('switches workspace and resets scoped runtime state', (
    tester,
  ) async {
    final sessionRepository = _FakeWorkspaceSessionRepository(activeId: 'w1');
    final workspaceRepository = _FakeWorkspaceRepository();
    final permissionRepository = _FakePermissionRepository();
    var selected = false;

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          loadWorkspaceSessionUseCaseProvider.overrideWithValue(
            LoadWorkspaceSessionUseCase(
              workspaceRepository: workspaceRepository,
              permissionRepository: permissionRepository,
              sessionRepository: sessionRepository,
            ),
          ),
          selectWorkspaceUseCaseProvider.overrideWithValue(
            SelectWorkspaceUseCase(
              permissionRepository: permissionRepository,
              sessionRepository: sessionRepository,
            ),
          ),
        ],
        child: MaterialApp(
          home: WorkspaceSelectorScreen(
            onWorkspaceSelected: () => selected = true,
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Công ty A'), findsOneWidget);
    expect(find.text('Công ty B'), findsOneWidget);

    await tester.tap(find.text('Công ty B'));
    await tester.pumpAndSettle();

    expect(selected, isTrue);
    expect(await sessionRepository.readActiveWorkspaceId(), 'w2');
    expect(sessionRepository.previousResetId, 'w1');
    expect(sessionRepository.nextResetId, 'w2');
  });
}

const _workspaces = [
  Workspace(
    id: 'w1',
    slug: 'cong-ty-a',
    name: 'Công ty A',
    plan: 'free',
    status: 'active',
  ),
  Workspace(
    id: 'w2',
    slug: 'cong-ty-b',
    name: 'Công ty B',
    plan: 'pro',
    status: 'active',
  ),
];

final class _FakeWorkspaceRepository implements WorkspaceRepository {
  @override
  Future<Result<Workspace>> get(String workspaceId) async {
    return Success(_workspaces.firstWhere((item) => item.id == workspaceId));
  }

  @override
  Future<Result<List<Workspace>>> listMine() async {
    return const Success(_workspaces);
  }
}

final class _FakePermissionRepository implements PermissionRepository {
  @override
  Future<Result<List<WorkspacePermission>>> listForWorkspace(
    String workspaceId,
  ) async {
    return const Success([
      WorkspacePermission(
        id: 'p1',
        code: 'workspace.view_members',
        module: 'workspace',
        action: 'view_members',
        name: 'Xem thành viên',
      ),
    ]);
  }
}

final class _FakeWorkspaceSessionRepository
    implements WorkspaceSessionRepository {
  _FakeWorkspaceSessionRepository({this.activeId});

  String? activeId;
  String? previousResetId;
  String? nextResetId;

  @override
  Future<String?> readActiveWorkspaceId() async => activeId;

  @override
  Future<void> resetRuntimeForSwitch({
    required String? previousWorkspaceId,
    required String nextWorkspaceId,
  }) async {
    previousResetId = previousWorkspaceId;
    nextResetId = nextWorkspaceId;
  }

  @override
  Future<void> saveActiveWorkspaceId(String workspaceId) async {
    activeId = workspaceId;
  }
}

"use client";

import { useCallback, useEffect, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@webtui/api-client";
import { createPermissionSet, hasPermission } from "@webtui/types";
import type {
  AddWorkspaceMemberInput,
  AuthUser,
  CreateBackupJobInput,
  CreateApiTokenInput,
  CreateBotInput,
  CreateIncomingWebhookInput,
  CreateOutgoingWebhookInput,
  CreateRoleInput,
  InstallBotInput,
  PermissionCode,
  SaveCronJobInput,
  SendBotMessageInput,
  UpdateMemberStatusInput
} from "@webtui/types";
import { api } from "@/lib/api";

export type AdminPermissionValue = PermissionCode | string;

export type AdminDashboardDataOptions = {
  selectedBackupJobId?: string;
  selectedBotId?: string;
  selectedCronJobId?: string;
  selectedMemberId?: string;
  selectedOutgoingWebhookId?: string;
};

type CreateRoleMutationInput = Omit<CreateRoleInput, "workspace_id">;

export function useAdminDashboardData(options: AdminDashboardDataOptions = {}) {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedWorkspaceId = searchParams.get("workspace") ?? "";

  const workspacesQuery = useQuery({
    queryFn: () => api.workspaces.listMine(),
    queryKey: queryKeys.workspaces.all
  });

  const workspaces = workspacesQuery.data ?? [];
  const resolvedWorkspaceId = requestedWorkspaceId || workspaces[0]?.id || "";

  const workspaceQuery = useQuery({
    enabled: Boolean(resolvedWorkspaceId),
    queryFn: () => api.workspaces.get(resolvedWorkspaceId),
    queryKey: queryKeys.workspaces.detail(resolvedWorkspaceId),
    retry: false
  });

  const selectedWorkspace =
    workspaceQuery.data ?? workspaces.find((workspace) => workspace.id === resolvedWorkspaceId) ?? null;
  const workspaceId = selectedWorkspace?.id ?? resolvedWorkspaceId;

  const permissionsQuery = useQuery({
    enabled: Boolean(workspaceId),
    queryFn: () => api.rbac.myPermissions(workspaceId),
    queryKey: queryKeys.rbac.me(workspaceId),
    retry: false
  });

  const permissionCodes = useMemo(
    () => createPermissionSet(permissionsQuery.data ?? []),
    [permissionsQuery.data]
  );

  const can = useCallback(
    (permission: AdminPermissionValue) => hasPermission(permissionCodes, permission),
    [permissionCodes]
  );

  const canViewAdmin = can("admin.view");
  const canViewAudit = can("audit.view");
  const canManageRoles = can("role.manage");
  const canManageUsers = can("user.manage");
  const canManageApiTokens = can("api_token.manage");
  const canManageBots = can("bot.manage");
  const canManageBackups = can("backup.manage");
  const canManageCronjobs = can("cronjob.manage");
  const canManageWebhooks = can("webhook.manage");
  const canManageWorkspace = can("workspace.manage");
  const adminQueryEnabled = Boolean(workspaceId && canViewAdmin);
  const integrationQueryEnabled = Boolean(workspaceId && (canManageApiTokens || canManageBots || canManageWebhooks));
  const operationsQueryEnabled = Boolean(workspaceId && (canManageCronjobs || canManageBackups));

  const statsQuery = useQuery({
    enabled: adminQueryEnabled,
    queryFn: () => api.admin.stats(workspaceId),
    queryKey: queryKeys.admin.stats(workspaceId),
    retry: false
  });

  const healthQuery = useQuery({
    enabled: adminQueryEnabled,
    queryFn: () => api.admin.health(workspaceId),
    queryKey: queryKeys.admin.health(workspaceId),
    retry: false
  });

  const usersQuery = useQuery({
    enabled: adminQueryEnabled,
    queryFn: () => api.users.list({ limit: 100 }),
    queryKey: queryKeys.users.all()
  });

  const membersQuery = useQuery({
    enabled: adminQueryEnabled,
    queryFn: () => api.workspaces.members(workspaceId),
    queryKey: queryKeys.workspaces.members(workspaceId),
    retry: false
  });

  const settingsQuery = useQuery({
    enabled: Boolean(workspaceId),
    queryFn: () => api.workspaces.settings(workspaceId),
    queryKey: queryKeys.workspaces.settings(workspaceId)
  });

  const permissionsCatalogQuery = useQuery({
    enabled: adminQueryEnabled,
    queryFn: () => api.rbac.permissions(),
    queryKey: queryKeys.rbac.permissions,
    retry: false
  });

  const rolesQuery = useQuery({
    enabled: adminQueryEnabled,
    queryFn: () => api.rbac.roles({ workspace_id: workspaceId }),
    queryKey: queryKeys.rbac.roles(workspaceId),
    retry: false
  });

  const selectedMemberRolesQuery = useQuery({
    enabled: Boolean(workspaceId && options.selectedMemberId && adminQueryEnabled),
    queryFn: () => api.rbac.memberRoles(workspaceId, options.selectedMemberId ?? ""),
    queryKey: queryKeys.rbac.memberRoles(workspaceId, options.selectedMemberId ?? ""),
    retry: false
  });

  const auditLogsQuery = useQuery({
    enabled: Boolean(workspaceId && canViewAudit),
    queryFn: () => api.admin.auditLogs(workspaceId, { limit: 50 }),
    queryKey: queryKeys.admin.auditLogs(workspaceId),
    retry: false
  });

  const channelsQuery = useQuery({
    enabled: Boolean(workspaceId && (adminQueryEnabled || integrationQueryEnabled)),
    queryFn: () => api.channels.list(workspaceId),
    queryKey: queryKeys.channels.all(workspaceId),
    retry: false
  });

  const apiScopesQuery = useQuery({
    enabled: canManageApiTokens,
    queryFn: () => api.apiTokens.scopes(),
    queryKey: queryKeys.integrations.apiScopes,
    retry: false
  });

  const apiTokensQuery = useQuery({
    enabled: Boolean(workspaceId && canManageApiTokens),
    queryFn: () => api.apiTokens.list(workspaceId),
    queryKey: queryKeys.integrations.apiTokens(workspaceId),
    retry: false
  });

  const botsQuery = useQuery({
    enabled: Boolean(workspaceId && canManageBots),
    queryFn: () => api.bots.list(workspaceId),
    queryKey: queryKeys.integrations.bots(workspaceId),
    retry: false
  });

  const botInstallationsQuery = useQuery({
    enabled: Boolean(workspaceId && options.selectedBotId && canManageBots),
    queryFn: () => api.bots.installations(workspaceId, options.selectedBotId ?? ""),
    queryKey: queryKeys.integrations.botInstallations(workspaceId, options.selectedBotId ?? ""),
    retry: false
  });

  const incomingWebhooksQuery = useQuery({
    enabled: Boolean(workspaceId && canManageWebhooks),
    queryFn: () => api.webhooks.incoming(workspaceId),
    queryKey: queryKeys.integrations.incomingWebhooks(workspaceId),
    retry: false
  });

  const outgoingWebhooksQuery = useQuery({
    enabled: Boolean(workspaceId && canManageWebhooks),
    queryFn: () => api.webhooks.outgoing(workspaceId),
    queryKey: queryKeys.integrations.outgoingWebhooks(workspaceId),
    retry: false
  });

  const webhookDeliveriesQuery = useQuery({
    enabled: Boolean(workspaceId && options.selectedOutgoingWebhookId && canManageWebhooks),
    queryFn: () => api.webhooks.deliveries(workspaceId, options.selectedOutgoingWebhookId ?? ""),
    queryKey: queryKeys.integrations.webhookDeliveries(workspaceId, options.selectedOutgoingWebhookId ?? ""),
    retry: false
  });

  const cronjobsQuery = useQuery({
    enabled: Boolean(workspaceId && canManageCronjobs),
    queryFn: () => api.cronjobs.list(workspaceId, { limit: 100 }),
    queryKey: queryKeys.operations.cronjobs(workspaceId),
    retry: false
  });

  const cronjobRunsQuery = useQuery({
    enabled: Boolean(workspaceId && options.selectedCronJobId && canManageCronjobs),
    queryFn: () => api.cronjobs.runs(workspaceId, options.selectedCronJobId ?? "", { limit: 50 }),
    queryKey: queryKeys.operations.cronJobRuns(workspaceId, options.selectedCronJobId ?? ""),
    retry: false
  });

  const backupJobsQuery = useQuery({
    enabled: Boolean(workspaceId && canManageBackups),
    queryFn: () => api.backups.jobs(workspaceId, { limit: 100 }),
    queryKey: queryKeys.operations.backupJobs(workspaceId),
    retry: false
  });

  const backupRunsQuery = useQuery({
    enabled: Boolean(workspaceId && options.selectedBackupJobId && canManageBackups),
    queryFn: () => api.backups.runs(workspaceId, options.selectedBackupJobId ?? "", { limit: 50 }),
    queryKey: queryKeys.operations.backupRuns(workspaceId, options.selectedBackupJobId ?? ""),
    retry: false
  });

  const invalidateWorkspaceMembers = useCallback(() => {
    if (workspaceId) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.members(workspaceId) });
    }
  }, [queryClient, workspaceId]);

  const invalidateRoles = useCallback(() => {
    if (workspaceId) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.rbac.roles(workspaceId) });
      if (options.selectedMemberId) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.rbac.memberRoles(workspaceId, options.selectedMemberId)
        });
      }
    }
  }, [options.selectedMemberId, queryClient, workspaceId]);

  const invalidateCronjobs = useCallback(() => {
    if (workspaceId) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.operations.cronjobs(workspaceId) });
      if (options.selectedCronJobId) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.operations.cronJobRuns(workspaceId, options.selectedCronJobId)
        });
      }
    }
  }, [options.selectedCronJobId, queryClient, workspaceId]);

  const invalidateBackupJobs = useCallback(() => {
    if (workspaceId) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.operations.backupJobs(workspaceId) });
      if (options.selectedBackupJobId) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.operations.backupRuns(workspaceId, options.selectedBackupJobId)
        });
      }
    }
  }, [options.selectedBackupJobId, queryClient, workspaceId]);

  const addMemberMutation = useMutation({
    mutationFn: (input: AddWorkspaceMemberInput) =>
      api.workspaces.addMember(requireWorkspaceId(workspaceId), input),
    onSuccess: invalidateWorkspaceMembers
  });

  const updateMemberStatusMutation = useMutation({
    mutationFn: ({ input, userId }: { input: UpdateMemberStatusInput; userId: string }) =>
      api.workspaces.updateMemberStatus(requireWorkspaceId(workspaceId), userId, input),
    onSuccess: invalidateWorkspaceMembers
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ input, userId }: { input: Partial<AuthUser>; userId: string }) =>
      api.users.update(userId, {
        ...input,
        workspace_id: requireWorkspaceId(workspaceId)
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.all() });
    }
  });

  const createRoleMutation = useMutation({
    mutationFn: (input: CreateRoleMutationInput) =>
      api.rbac.createRole({
        ...input,
        workspace_id: requireWorkspaceId(workspaceId)
      }),
    onSuccess: invalidateRoles
  });

  const assignMemberRoleMutation = useMutation({
    mutationFn: ({ roleId, userId }: { roleId: string; userId: string }) =>
      api.rbac.assignMemberRole(requireWorkspaceId(workspaceId), userId, { role_id: roleId }),
    onSuccess: invalidateRoles
  });

  const revokeMemberRoleMutation = useMutation({
    mutationFn: ({ roleId, userId }: { roleId: string; userId: string }) =>
      api.rbac.revokeMemberRole(requireWorkspaceId(workspaceId), userId, roleId),
    onSuccess: invalidateRoles
  });

  const createApiTokenMutation = useMutation({
    mutationFn: (input: CreateApiTokenInput) =>
      api.apiTokens.create(requireWorkspaceId(workspaceId), input),
    onSuccess: () => {
      if (workspaceId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.integrations.apiTokens(workspaceId) });
      }
    }
  });

  const revokeApiTokenMutation = useMutation({
    mutationFn: (tokenId: string) => api.apiTokens.revoke(requireWorkspaceId(workspaceId), tokenId),
    onSuccess: () => {
      if (workspaceId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.integrations.apiTokens(workspaceId) });
      }
    }
  });

  const createBotMutation = useMutation({
    mutationFn: (input: CreateBotInput) => api.bots.create(requireWorkspaceId(workspaceId), input),
    onSuccess: () => {
      if (workspaceId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.integrations.bots(workspaceId) });
      }
    }
  });

  const installBotMutation = useMutation({
    mutationFn: ({ botId, input }: { botId: string; input: InstallBotInput }) =>
      api.bots.install(requireWorkspaceId(workspaceId), botId, input),
    onSuccess: (_, variables) => {
      if (workspaceId) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.integrations.botInstallations(workspaceId, variables.botId)
        });
      }
    }
  });

  const sendBotMessageMutation = useMutation({
    mutationFn: ({ botId, input }: { botId: string; input: SendBotMessageInput }) =>
      api.bots.sendMessage(requireWorkspaceId(workspaceId), botId, input)
  });

  const createIncomingWebhookMutation = useMutation({
    mutationFn: (input: CreateIncomingWebhookInput) =>
      api.webhooks.createIncoming(requireWorkspaceId(workspaceId), input),
    onSuccess: () => {
      if (workspaceId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.integrations.incomingWebhooks(workspaceId) });
      }
    }
  });

  const createOutgoingWebhookMutation = useMutation({
    mutationFn: (input: CreateOutgoingWebhookInput) =>
      api.webhooks.createOutgoing(requireWorkspaceId(workspaceId), input),
    onSuccess: () => {
      if (workspaceId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.integrations.outgoingWebhooks(workspaceId) });
      }
    }
  });

  const createCronjobMutation = useMutation({
    mutationFn: (input: SaveCronJobInput) => api.cronjobs.create(requireWorkspaceId(workspaceId), input),
    onSuccess: invalidateCronjobs
  });

  const updateCronjobMutation = useMutation({
    mutationFn: ({ cronjobId, input }: { cronjobId: string; input: SaveCronJobInput }) =>
      api.cronjobs.update(requireWorkspaceId(workspaceId), cronjobId, input),
    onSuccess: invalidateCronjobs
  });

  const deleteCronjobMutation = useMutation({
    mutationFn: (cronjobId: string) => api.cronjobs.delete(requireWorkspaceId(workspaceId), cronjobId),
    onSuccess: invalidateCronjobs
  });

  const runCronjobMutation = useMutation({
    mutationFn: (cronjobId: string) => api.cronjobs.runNow(requireWorkspaceId(workspaceId), cronjobId),
    onSuccess: invalidateCronjobs
  });

  const createBackupJobMutation = useMutation({
    mutationFn: (input: CreateBackupJobInput) => api.backups.createJob(requireWorkspaceId(workspaceId), input),
    onSuccess: invalidateBackupJobs
  });

  const runBackupJobMutation = useMutation({
    mutationFn: (backupJobId: string) => api.backups.runNow(requireWorkspaceId(workspaceId), backupJobId),
    onSuccess: invalidateBackupJobs
  });

  const setWorkspaceId = useCallback(
    (nextWorkspaceId: string) => {
      const nextParams = new URLSearchParams(searchParams.toString());

      if (nextWorkspaceId) {
        nextParams.set("workspace", nextWorkspaceId);
      } else {
        nextParams.delete("workspace");
      }

      const query = nextParams.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  useEffect(() => {
    if (!requestedWorkspaceId && workspaceId) {
      setWorkspaceId(workspaceId);
    }
  }, [requestedWorkspaceId, setWorkspaceId, workspaceId]);

  return {
    addMemberMutation,
    apiScopes: apiScopesQuery.data ?? [],
    apiScopesQuery,
    apiTokens: apiTokensQuery.data ?? [],
    apiTokensQuery,
    assignMemberRoleMutation,
    auditLogs: auditLogsQuery.data ?? [],
    auditLogsQuery,
    botInstallations: botInstallationsQuery.data ?? [],
    botInstallationsQuery,
    bots: botsQuery.data ?? [],
    botsQuery,
    backupJobs: backupJobsQuery.data ?? [],
    backupJobsQuery,
    backupRuns: backupRunsQuery.data ?? [],
    backupRunsQuery,
    can,
    canManageBackups,
    canManageApiTokens,
    canManageBots,
    canManageCronjobs,
    canManageRoles,
    canManageUsers,
    canManageWebhooks,
    canManageWorkspace,
    canViewAdmin,
    canViewAudit,
    channels: channelsQuery.data ?? [],
    channelsQuery,
    createApiTokenMutation,
    createBackupJobMutation,
    createBotMutation,
    createCronjobMutation,
    createIncomingWebhookMutation,
    createOutgoingWebhookMutation,
    createRoleMutation,
    cronjobRuns: cronjobRunsQuery.data ?? [],
    cronjobRunsQuery,
    cronjobs: cronjobsQuery.data ?? [],
    cronjobsQuery,
    deleteCronjobMutation,
    healthQuery,
    incomingWebhooks: incomingWebhooksQuery.data ?? [],
    incomingWebhooksQuery,
    installBotMutation,
    members: membersQuery.data ?? [],
    membersQuery,
    outgoingWebhooks: outgoingWebhooksQuery.data ?? [],
    outgoingWebhooksQuery,
    permissionCodes,
    permissions: permissionsQuery.data ?? [],
    permissionsCatalog: permissionsCatalogQuery.data ?? [],
    permissionsCatalogQuery,
    permissionsQuery,
    revokeApiTokenMutation,
    revokeMemberRoleMutation,
    roles: rolesQuery.data ?? [],
    rolesQuery,
    runBackupJobMutation,
    runCronjobMutation,
    selectedMemberRoles: selectedMemberRolesQuery.data ?? [],
    selectedMemberRolesQuery,
    selectedWorkspace,
    sendBotMessageMutation,
    setWorkspaceId,
    settings: settingsQuery.data ?? [],
    settingsQuery,
    statsQuery,
    operationsQueryEnabled,
    updateMemberStatusMutation,
    updateCronjobMutation,
    updateUserMutation,
    users: usersQuery.data ?? [],
    usersQuery,
    webhookDeliveries: webhookDeliveriesQuery.data ?? [],
    webhookDeliveriesQuery,
    workspaceQuery,
    workspaceId,
    workspaces,
    workspacesQuery
  };
}

function requireWorkspaceId(workspaceId: string): string {
  if (!workspaceId) {
    throw new Error("Chưa chọn workspace.");
  }

  return workspaceId;
}

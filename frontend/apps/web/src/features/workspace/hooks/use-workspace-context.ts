"use client";

import { useCallback, useEffect, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@webtui/api-client";
import { createPermissionSet, hasPermission, type PermissionCode } from "@webtui/types";
import { api } from "@/lib/api";
import { buildChatRoute, parseChatRoute } from "@/lib/chat-route";

export type PermissionValue = PermissionCode | string;

export function useWorkspaceContext() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const parsedRoute = parseChatRoute(pathname);
  const legacyWorkspaceId = searchParams.get("workspace") ?? "";
  const requestedWorkspaceRef = parsedRoute?.workspaceRef || legacyWorkspaceId;

  const workspacesQuery = useQuery({
    queryFn: () => api.workspaces.listMine(),
    queryKey: queryKeys.workspaces.all
  });

  const workspaces = workspacesQuery.data ?? [];
  const requestedWorkspace = workspaces.find(
    (workspace) => workspace.id === requestedWorkspaceRef || workspace.slug.toLowerCase() === requestedWorkspaceRef.toLowerCase()
  );
  const resolvedWorkspaceId = requestedWorkspace?.id || (!parsedRoute ? legacyWorkspaceId : "") || workspaces[0]?.id || "";

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

  const membersQuery = useQuery({
    enabled: Boolean(workspaceId),
    queryFn: () => api.workspaces.members(workspaceId),
    queryKey: queryKeys.workspaces.members(workspaceId)
  });

  const settingsQuery = useQuery({
    enabled: Boolean(workspaceId),
    queryFn: () => api.workspaces.settings(workspaceId),
    queryKey: queryKeys.workspaces.settings(workspaceId)
  });

  const permissionCodes = useMemo(
    () => createPermissionSet(permissionsQuery.data ?? []),
    [permissionsQuery.data]
  );

  const can = useCallback(
    (permission: PermissionValue) => hasPermission(permissionCodes, permission),
    [permissionCodes]
  );

  const setWorkspaceId = useCallback(
    (nextWorkspaceId: string) => {
      const workspace = workspaces.find((item) => item.id === nextWorkspaceId);
      router.replace(nextWorkspaceId ? buildChatRoute(workspace?.slug || nextWorkspaceId) : "/", { scroll: false });
    },
    [router, workspaces]
  );

  useEffect(() => {
    if (!parsedRoute && !searchParams.get("channel") && workspaceId) {
      setWorkspaceId(workspaceId);
    }
  }, [parsedRoute, searchParams, setWorkspaceId, workspaceId]);

  return {
    can,
    members: membersQuery.data ?? [],
    membersQuery,
    permissionCodes,
    permissions: permissionsQuery.data ?? [],
    permissionsQuery,
    selectedWorkspace,
    setWorkspaceId,
    settings: settingsQuery.data ?? [],
    settingsQuery,
    workspaceQuery,
    workspaceId,
    workspaces,
    workspacesQuery
  };
}

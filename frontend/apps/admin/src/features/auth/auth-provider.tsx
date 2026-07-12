"use client";

import { createContext, type FormEvent, type ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Skeleton } from "@webtui/ui";
import { LockKeyhole, Send, ShieldCheck } from "@webtui/icons";
import type { AuthUser, LoginInput } from "@webtui/types";
import { queryKeys } from "@webtui/api-client";
import { api } from "@/lib/api";
import { useAuthStore } from "./auth-store";

type AuthContextValue = {
  isAuthenticated: boolean;
  logout: () => void;
  user: AuthUser | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((state) => state.accessToken);
  const hydrated = useAuthStore((state) => state.hydrated);
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const user = useAuthStore((state) => state.user);
  const clearSession = useAuthStore((state) => state.clearSession);
  const setSession = useAuthStore((state) => state.setSession);
  const setUser = useAuthStore((state) => state.setUser);
  const [formError, setFormError] = useState<string | null>(null);

  const meQuery = useQuery({
    enabled: hydrated && Boolean(accessToken),
    queryFn: async () => {
      const currentUser = await api.auth.me();
      return currentUser ?? api.users.me();
    },
    queryKey: queryKeys.auth.me,
    retry: false
  });

  useEffect(() => {
    if (meQuery.data) {
      setUser(meQuery.data);
    }
  }, [meQuery.data, setUser]);

  useEffect(() => {
    if (meQuery.isError) {
      clearSession();
    }
  }, [clearSession, meQuery.isError]);

  const loginMutation = useMutation({
    mutationFn: (input: LoginInput) => api.auth.login(input),
    onError: (error) => setFormError(error instanceof Error ? error.message : "Đăng nhập không thành công."),
    onMutate: () => setFormError(null),
    onSuccess: (result) => {
      setSession(result);
      void queryClient.invalidateQueries({ queryKey: queryKeys.auth.me });
    }
  });

  const adminAccessQuery = useQuery({
    enabled: hydrated && Boolean(accessToken) && Boolean(meQuery.data || user),
    queryFn: async () => {
      const workspaces = await api.workspaces.listMine();
      for (const workspace of workspaces) {
        const permissions = await api.rbac.myPermissions(workspace.id);
        if (permissions.some((permission) => permission.code === "admin.view")) {
          return true;
        }
      }
      return false;
    },
    queryKey: ["admin-access", meQuery.data?.id || user?.id || "anonymous"],
    retry: false
  });

  const logoutMutation = useMutation({
    mutationFn: () =>
      refreshToken ? api.auth.logout({ refresh_token: refreshToken }) : Promise.resolve({ status: "ok" }),
    onSettled: () => {
      clearSession();
      queryClient.clear();
    }
  });

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated: Boolean(accessToken),
      logout: () => logoutMutation.mutate(),
      user
    }),
    [accessToken, logoutMutation, user]
  );

  if (!hydrated) {
    return <AuthLoadingState label="Đang khởi tạo phiên quản trị..." />;
  }

  if (!accessToken) {
    return (
      <AdminLoginScreen
        error={formError}
        isPending={loginMutation.isPending}
        onSubmit={(identifier, password) => loginMutation.mutate({
          device_name: "VPSTTT Admin Panel",
          identifier,
          password
        })}
      />
    );
  }

  if ((meQuery.isLoading && !user) || adminAccessQuery.isLoading) {
    return <AuthLoadingState label="Đang tải hồ sơ quản trị..." />;
  }

  if (adminAccessQuery.data !== true) {
    return (
      <main className="admin-access-denied">
        <span><ShieldCheck size={32} /></span>
        <h1>Không có quyền quản trị</h1>
        <p>Tài khoản này không được cấp quyền <code>admin.view</code> trong bất kỳ workspace nào.</p>
        <Button onClick={() => logoutMutation.mutate()} variant="secondary">Quay lại đăng nhập</Button>
      </main>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function AdminLoginScreen({
  error,
  isPending,
  onSubmit
}: {
  error: string | null;
  isPending: boolean;
  onSubmit: (identifier: string, password: string) => void;
}) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(identifier.trim(), password);
  }

  return (
    <main className="admin-login-shell">
      <section className="admin-login-brand">
        <div className="admin-login-brand__mark"><ShieldCheck size={34} /></div>
        <span className="admin-login-brand__eyebrow">VPSTTT · CONTROL CENTER</span>
        <h1>Quản trị vận hành<br />tập trung và an toàn.</h1>
        <p>Không gian riêng dành cho quản trị viên theo dõi người dùng, phân quyền, bot và tự động hóa.</p>
        <div className="admin-login-brand__features">
          <span><ShieldCheck size={18} /><b>RBAC bắt buộc</b><small>Mọi tác vụ đều được kiểm tra quyền tại API.</small></span>
          <span><LockKeyhole size={18} /><b>Không cho đăng ký</b><small>Tài khoản quản trị chỉ được cấp bởi hệ thống.</small></span>
        </div>
      </section>
      <section className="admin-login-panel">
        <form className="admin-login-card" onSubmit={handleSubmit}>
          <div className="admin-login-card__icon"><LockKeyhole size={24} /></div>
          <div>
            <span className="admin-login-card__eyebrow">XÁC THỰC QUẢN TRỊ</span>
            <h2>Đăng nhập Admin Panel</h2>
            <p>Chỉ tài khoản đã được cấp quyền <code>admin.view</code> mới có thể tiếp tục.</p>
          </div>
          {error ? <div className="admin-login-error" role="alert">{error}</div> : null}
          <label>
            Email hoặc tên đăng nhập
            <input
              autoComplete="username"
              autoFocus
              onChange={(event) => setIdentifier(event.target.value)}
              placeholder="admin@vpsttt.com"
              required
              value={identifier}
            />
          </label>
          <label>
            Mật khẩu
            <input
              autoComplete="current-password"
              minLength={8}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Nhập mật khẩu quản trị"
              required
              type="password"
              value={password}
            />
          </label>
          <Button disabled={isPending || !identifier.trim() || !password} type="submit">
            {isPending ? "Đang xác thực..." : "Đăng nhập quản trị"}<Send size={17} />
          </Button>
          <small className="admin-login-card__notice">Không có chức năng đăng ký tại Admin Panel.</small>
        </form>
      </section>
    </main>
  );
}

export function useAuth() {
  const value = useContext(AuthContext);

  if (!value) {
    throw new Error("useAuth phải được dùng bên trong AuthProvider.");
  }

  return value;
}

function AuthLoadingState({ label }: { label: string }) {
  return (
    <main className="auth-loading" aria-label={label}>
      <Skeleton style={{ height: 64, width: 64 }} />
      <Skeleton style={{ height: 24, width: 260 }} />
      <Skeleton style={{ height: 18, width: 360 }} />
    </main>
  );
}

"use client";

import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AuthScreen, Skeleton } from "@webtui/ui";
import type { AuthUser, LoginInput, RegisterInput } from "@webtui/types";
import { queryKeys } from "@webtui/api-client";
import { api } from "@/lib/api";
import { useAuthStore } from "./auth-store";
import { clearMediaObjectUrlCache } from "@/features/chat/model/media-cache";
import { isLikelyOfflineError } from "@/features/chat/model/offline-cache";

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
  const setRememberLogin = useAuthStore((state) => state.setRememberLogin);
  const setUser = useAuthStore((state) => state.setUser);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [formError, setFormError] = useState<string | null>(null);
  const [isRestoringSession, setIsRestoringSession] = useState(false);
  const [restoreAttemptedToken, setRestoreAttemptedToken] = useState<string | null>(null);

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
    if (meQuery.isError && !isLikelyOfflineError(meQuery.error)) {
      clearSession();
    }
  }, [clearSession, meQuery.error, meQuery.isError]);

  useEffect(() => {
    if (!hydrated || accessToken || !refreshToken || restoreAttemptedToken === refreshToken) {
      return;
    }

    let active = true;
    setIsRestoringSession(true);
    setRestoreAttemptedToken(refreshToken);

    api.auth
      .refresh({ refresh_token: refreshToken })
      .then((result) => {
        if (!active) {
          return;
        }
        setSession(result);
        void queryClient.invalidateQueries({ queryKey: queryKeys.auth.me });
      })
      .catch(() => {
        if (active) {
          clearSession();
        }
      })
      .finally(() => {
        if (active) {
          setIsRestoringSession(false);
        }
      });

    return () => {
      active = false;
    };
  }, [accessToken, clearSession, hydrated, queryClient, refreshToken, restoreAttemptedToken, setSession]);

  const loginMutation = useMutation({
    mutationFn: (input: LoginInput) => api.auth.login(input),
    onError: (error) => setFormError(error instanceof Error ? error.message : "Đăng nhập không thành công."),
    onMutate: () => setFormError(null),
    onSuccess: (result) => {
      setSession(result);
      void queryClient.invalidateQueries({ queryKey: queryKeys.auth.me });
    }
  });

  const registerMutation = useMutation({
    mutationFn: (input: RegisterInput) => api.auth.register(input),
    onError: (error) => setFormError(error instanceof Error ? error.message : "Đăng ký không thành công."),
    onMutate: () => setFormError(null),
    onSuccess: (result) => {
      setSession(result);
      void queryClient.invalidateQueries({ queryKey: queryKeys.auth.me });
    }
  });

  const googleMutation = useMutation({
    mutationFn: (credential: string) => api.auth.google({ credential, device_name: browserDeviceName() }),
    onError: (error) => setFormError(error instanceof Error ? error.message : "Đăng nhập Google không thành công."),
    onMutate: () => {
      setFormError(null);
      setRememberLogin(true);
    },
    onSuccess: (result) => {
      setSession(result);
      void queryClient.invalidateQueries({ queryKey: queryKeys.auth.me });
    }
  });

  const logoutMutation = useMutation({
    mutationFn: () =>
      refreshToken ? api.auth.logout({ refresh_token: refreshToken }) : Promise.resolve({ status: "ok" }),
    onSettled: () => {
      clearMediaObjectUrlCache();
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

  if (!hydrated || isRestoringSession) {
    return <AuthLoadingState label="Đang khởi tạo phiên làm việc..." />;
  }

  if (!accessToken) {
    return (
      <AuthScreen
        brandLogoAlt="WebTui Chat"
        brandLogoSrc="/brand/logo_webtui.png"
        error={formError}
        googleClientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID}
        isPending={loginMutation.isPending || registerMutation.isPending || googleMutation.isPending}
        mode={mode}
        onGoogleCredential={(credential) => googleMutation.mutate(credential)}
        onLogin={(values) =>
          {
            setRememberLogin(values.remember);
            loginMutation.mutate({
              device_name: browserDeviceName(),
              identifier: values.identifier,
              password: values.password
            });
          }
        }
        onModeChange={setMode}
        onRegister={(values) =>
          registerMutation.mutate({
            device_name: browserDeviceName(),
            display_name: values.displayName,
            email: values.email,
            password: values.password,
            username: values.username
          })
        }
        panelLogoAlt="WebTui Chat"
        panelLogoSrc="/brand/logo_webtui.png"
      />
    );
  }

  if (meQuery.isLoading && !user) {
    return <AuthLoadingState label="Đang tải hồ sơ người dùng..." />;
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function browserDeviceName() {
  if (typeof navigator === "undefined") {
    return "Web App";
  }
  const platform = navigator.platform || "Web";
  return `Web · ${platform}`.slice(0, 120);
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

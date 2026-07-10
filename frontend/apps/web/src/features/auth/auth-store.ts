"use client";

import type { AuthResult, AuthUser } from "@webtui/types";
import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";

type AuthState = {
  accessToken: string | null;
  hydrated: boolean;
  refreshToken: string | null;
  rememberLogin: boolean;
  sessionId: string | null;
  user: AuthUser | null;
  clearSession: () => void;
  setHydrated: (hydrated: boolean) => void;
  setRememberLogin: (remember: boolean) => void;
  setSession: (result: AuthResult) => void;
  setUser: (user: AuthUser | null) => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      hydrated: false,
      refreshToken: null,
      rememberLogin: true,
      sessionId: null,
      user: null,
      clearSession: () =>
        set({
          accessToken: null,
          refreshToken: null,
          sessionId: null,
          user: null
        }),
      setHydrated: (hydrated) => set({ hydrated }),
      setRememberLogin: (rememberLogin) => set({ rememberLogin }),
      setSession: (result) =>
        set((state) => {
          const accessToken = result.tokens?.access_token ?? result.access_token ?? state.accessToken;
          const refreshToken = result.tokens?.refresh_token ?? result.refresh_token ?? state.refreshToken;

          return {
            accessToken,
            refreshToken,
            sessionId: result.session_id ?? state.sessionId,
            user: result.user ?? state.user
          };
        }),
      setUser: (user) => set({ user })
    }),
    {
      name: "webtui-web-auth",
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        rememberLogin: state.rememberLogin,
        sessionId: state.sessionId,
        user: state.user
      }),
      storage: createJSONStorage(createAuthStorage)
    }
  )
);

function createAuthStorage(): StateStorage {
  return {
    getItem(name) {
      return window.localStorage.getItem(name) ?? window.sessionStorage.getItem(name);
    },
    removeItem(name) {
      window.localStorage.removeItem(name);
      window.sessionStorage.removeItem(name);
    },
    setItem(name, value) {
      let remember = true;
      try {
        const parsed = JSON.parse(value) as { state?: { rememberLogin?: boolean } };
        remember = parsed.state?.rememberLogin !== false;
      } catch {
        // Keep the safer default for data written by older app versions.
      }

      const target = remember ? window.localStorage : window.sessionStorage;
      const stale = remember ? window.sessionStorage : window.localStorage;
      stale.removeItem(name);
      target.setItem(name, value);
    }
  };
}

import {
  createRuntimeEnvironment,
  createWebTuiApiClient
} from "@webtui/api-client";
import { useAuthStore } from "@/features/auth/auth-store";
import { clearMediaObjectUrlCache } from "@/features/chat/model/media-cache";

export const runtimeEnvironment = createRuntimeEnvironment();

let refreshRequest: Promise<string | null> | null = null;

export const api = createWebTuiApiClient({
  baseUrl: runtimeEnvironment.apiBaseUrl,
  getAccessToken: () => useAuthStore.getState().accessToken,
  onUnauthorized: () => {
    clearMediaObjectUrlCache();
    useAuthStore.getState().clearSession();
  },
  refreshAccessToken: () => {
    const refreshToken = useAuthStore.getState().refreshToken;

    if (!refreshToken) {
      return Promise.resolve(null);
    }

    if (!refreshRequest) {
      refreshRequest = api.auth
        .refresh({ refresh_token: refreshToken })
        .then((result) => {
          useAuthStore.getState().setSession(result);
          return result.tokens?.access_token ?? result.access_token ?? null;
        })
        .catch(() => {
          useAuthStore.getState().clearSession();
          return null;
        })
        .finally(() => {
          refreshRequest = null;
        });
    }

    return refreshRequest;
  }
});

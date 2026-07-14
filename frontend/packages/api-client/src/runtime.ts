import type { RuntimeEnvironment } from "@webtui/types";

export const DEFAULT_API_BASE_URL = "https://api.vpsttt.com";
export const DEFAULT_WS_BASE_URL = "wss://api.vpsttt.com/api/v1/ws";
export const DEFAULT_APP_NAME = "WebTui Chat";
export const DEFAULT_APP_VERSION = "0.1.0";
export const DEFAULT_LOCALE = "vi-VN";
export const DEFAULT_RELEASE_CHANNEL = "stable";

type RuntimeSource = {
  NEXT_PUBLIC_API_BASE_URL?: string;
  NEXT_PUBLIC_APP_VERSION?: string;
  NEXT_PUBLIC_WS_BASE_URL?: string;
  NEXT_PUBLIC_APP_NAME?: string;
  NEXT_PUBLIC_DEFAULT_LOCALE?: string;
  NEXT_PUBLIC_RELEASE_CHANNEL?: string;
};

export function createRuntimeEnvironment(
  source: RuntimeSource = {}
): RuntimeEnvironment {
  return {
    apiBaseUrl: normalizeBaseUrl(
      source.NEXT_PUBLIC_API_BASE_URL,
      DEFAULT_API_BASE_URL
    ),
    wsBaseUrl: normalizeBaseUrl(
      source.NEXT_PUBLIC_WS_BASE_URL,
      DEFAULT_WS_BASE_URL
    ),
    appName: source.NEXT_PUBLIC_APP_NAME ?? DEFAULT_APP_NAME,
    appVersion: source.NEXT_PUBLIC_APP_VERSION?.trim() || DEFAULT_APP_VERSION,
    releaseChannel: source.NEXT_PUBLIC_RELEASE_CHANNEL?.trim() || DEFAULT_RELEASE_CHANNEL,
    locale: source.NEXT_PUBLIC_DEFAULT_LOCALE ?? DEFAULT_LOCALE
  };
}

function normalizeBaseUrl(value: string | undefined, fallback: string): string {
  const selected = value?.trim() || fallback;
  return selected.endsWith("/") ? selected.slice(0, -1) : selected;
}

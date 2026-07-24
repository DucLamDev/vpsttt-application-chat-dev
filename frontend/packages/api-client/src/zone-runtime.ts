import type { ZoneRuntime } from "@webtui/types";

export function isLocalHostname(hostname: string): boolean {
  const value = hostname.trim().toLowerCase().replace(/^\[|\]$/g, "");
  return (
    value === "localhost" ||
    value === "127.0.0.1" ||
    value === "::1" ||
    value.endsWith(".localhost")
  );
}

export function localizeZoneRuntime(
  discovered: ZoneRuntime,
  currentOrigin: string,
  apiBaseUrl: string,
  wsBaseUrl: string
): ZoneRuntime {
  return {
    ...discovered,
    web_base_url: trimTrailingSlash(currentOrigin),
    api_base_url: trimTrailingSlash(apiBaseUrl),
    ws_base_url: trimTrailingSlash(wsBaseUrl)
  };
}

export function zoneWebNavigationTarget(
  webBaseUrl: string,
  currentUrl: string
): string | null {
  let current: URL;
  let target: URL;
  try {
    current = new URL(currentUrl);
    target = new URL(webBaseUrl);
  } catch {
    return null;
  }

  if (
    !["http:", "https:"].includes(current.protocol) ||
    !["http:", "https:"].includes(target.protocol) ||
    isLocalHostname(current.hostname) ||
    target.username ||
    target.password
  ) {
    return null;
  }
  if (target.protocol !== "https:" && !isLocalHostname(target.hostname)) {
    return null;
  }
  if (current.origin === target.origin) {
    return null;
  }

  target.search = "";
  target.hash = "";
  return target.toString();
}

function trimTrailingSlash(value: string): string {
  const normalized = value.trim();
  return normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
}

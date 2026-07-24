import { serverDiscoveryBaseUrl } from "@webtui/api-client";
import type { ZoneDiscovery } from "@webtui/types";

export type PortalServer = {
  apiBaseUrl: string;
  appVersion: string;
  domain: string;
  entryUrl: string;
  name: string;
  registrationMode: string;
  webBaseUrl: string;
  wsBaseUrl: string;
};

export function normalizePortalServer(rawServer: string): {
  domain: string;
  origin: string;
} {
  const origin = serverDiscoveryBaseUrl(rawServer, "http://localhost:8080");
  return {
    domain: new URL(origin).hostname.toLowerCase(),
    origin
  };
}

export function parsePortalDiscovery(
  payload: unknown,
  expectedOrigin: string
): PortalServer {
  const expected = new URL(expectedOrigin);
  const discovery = unwrapDiscovery(payload);
  const domain = lowerText(discovery.domain);
  const zone = objectValue(discovery.zone);
  const runtime = objectValue(discovery.runtime);
  const capabilities = objectValue(discovery.capabilities);
  const deployment = objectValue(discovery.deployment);

  if (domain !== expected.hostname.toLowerCase()) {
    throw new Error("Domain discovery không khớp với server đã nhập.");
  }
  if (lowerText(zone.status) !== "active") {
    throw new Error("Instance chưa ở trạng thái hoạt động.");
  }
  if (lowerText(deployment.status) !== "ready") {
    throw new Error("Instance đang cài đặt hoặc chưa sẵn sàng.");
  }
  if (capabilities.self_hosted !== true) {
    throw new Error("Domain này không phải instance WebTUI Chat self-hosted.");
  }

  const webBaseUrl = validatedRuntimeUrl(
    runtime.web_base_url,
    expected,
    ["http:", "https:"],
    "web"
  );
  const apiBaseUrl = validatedRuntimeUrl(
    runtime.api_base_url,
    expected,
    ["http:", "https:"],
    "API"
  );
  const wsBaseUrl = validatedRuntimeUrl(
    runtime.ws_base_url,
    expected,
    ["ws:", "wss:"],
    "WebSocket",
    true
  );
  const registrationMode = lowerText(zone.registration_mode) || "closed";
  const entry = new URL(webBaseUrl);
  entry.searchParams.set(
    "auth",
    registrationMode === "open" ? "register" : "login"
  );
  entry.searchParams.set("source", "portal");

  return {
    apiBaseUrl,
    appVersion: textValue(runtime.app_version) || "unknown",
    domain,
    entryUrl: entry.toString(),
    name: textValue(zone.name) || textValue(runtime.app_name) || domain,
    registrationMode,
    webBaseUrl,
    wsBaseUrl
  };
}

function unwrapDiscovery(payload: unknown): ZoneDiscovery {
  const root = objectValue(payload);
  const data = objectValue(root.data);
  const candidate = Object.keys(data).length ? data.discovery : root.discovery ?? root;
  const discovery = objectValue(candidate);
  if (!Object.keys(discovery).length) {
    throw new Error("Server không trả discovery WebTUI Chat hợp lệ.");
  }
  return discovery as ZoneDiscovery;
}

function validatedRuntimeUrl(
  value: unknown,
  expected: URL,
  schemes: string[],
  label: string,
  allowWebSocketPath = false
): string {
  let parsed: URL;
  try {
    parsed = new URL(textValue(value));
  } catch {
    throw new Error(`Discovery thiếu ${label} URL hợp lệ.`);
  }
  const isLocal = ["localhost", "127.0.0.1"].includes(expected.hostname);
  if (
    !schemes.includes(parsed.protocol) ||
    parsed.hostname.toLowerCase() !== expected.hostname.toLowerCase() ||
    parsed.username ||
    parsed.password ||
    (!isLocal && !["https:", "wss:"].includes(parsed.protocol))
  ) {
    throw new Error(`${label} URL không cùng server hoặc không dùng kết nối an toàn.`);
  }
  if (!allowWebSocketPath && parsed.pathname !== "/" && parsed.pathname !== "") {
    throw new Error(`${label} base URL phải là origin của instance.`);
  }
  return parsed.toString().replace(/\/$/, "");
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function textValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function lowerText(value: unknown): string {
  return textValue(value).toLowerCase();
}

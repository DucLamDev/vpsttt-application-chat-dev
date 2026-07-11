export type ParsedChatRoute = {
  kind?: "channel" | "dm";
  sectionRef?: string;
  targetRef?: string;
  workspaceRef: string;
};

export function parseChatRoute(pathname: string): ParsedChatRoute | null {
  const segments = pathname.split("/").filter(Boolean).map(safeDecode);
  if (segments[0] !== "chat" || !segments[1]) {
    return null;
  }
  const kind = segments[2] === "channel" || segments[2] === "dm" ? segments[2] : undefined;
  return {
    kind,
    targetRef: kind ? segments[3] : undefined,
    workspaceRef: segments[1],
    ...(!kind && segments[2] ? { sectionRef: segments[2] } : {})
  };
}

export function buildWorkspaceSectionRoute(workspaceRef: string, sectionRef: string) {
  return `${buildChatRoute(workspaceRef)}/${encodeURIComponent(sectionRef)}`;
}

export function buildChatRoute(workspaceRef: string, kind?: "channel" | "dm", targetRef?: string) {
  const base = `/chat/${encodeURIComponent(workspaceRef)}`;
  return kind && targetRef ? `${base}/${kind}/${encodeURIComponent(targetRef)}` : base;
}

export function directRouteRef(name: string, channelId: string) {
  const readableName = routeSlug(name) || "hoi-thoai";
  return `${readableName}--${channelId.slice(0, 8)}`;
}

export function directIdPrefix(reference: string) {
  const marker = reference.lastIndexOf("--");
  return marker >= 0 ? reference.slice(marker + 2) : reference;
}

function routeSlug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

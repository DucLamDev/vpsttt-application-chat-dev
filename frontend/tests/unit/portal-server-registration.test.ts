import { describe, expect, it } from "vitest";
import {
  normalizePortalServer,
  parsePortalDiscovery
} from "../../apps/portal/src/lib/server-registration";

describe("portal self-hosted registration", () => {
  it("normalizes a customer domain and builds the first-registration URL", () => {
    const target = normalizePortalServer("Chat.Company.Example");
    const server = parsePortalDiscovery(
      discoveryPayload({ domain: "chat.company.example" }),
      target.origin
    );

    expect(target).toEqual({
      domain: "chat.company.example",
      origin: "https://chat.company.example"
    });
    expect(server.name).toBe("Company Chat");
    expect(server.entryUrl).toBe(
      "https://chat.company.example/?auth=register&source=portal"
    );
  });

  it("sends an activated instance to login", () => {
    const server = parsePortalDiscovery(
      discoveryPayload({
        domain: "chat.company.example",
        registrationMode: "invite_only"
      }),
      "https://chat.company.example"
    );

    expect(server.entryUrl).toContain("auth=login");
  });

  it("rejects discovery that redirects clients to another host", () => {
    expect(() =>
      parsePortalDiscovery(
        discoveryPayload({
          apiBaseUrl: "https://attacker.example",
          domain: "chat.company.example"
        }),
        "https://chat.company.example"
      )
    ).toThrow(/không cùng server/i);
  });
});

function discoveryPayload({
  apiBaseUrl = "https://chat.company.example",
  domain,
  registrationMode = "open"
}: {
  apiBaseUrl?: string;
  domain: string;
  registrationMode?: string;
}) {
  return {
    data: {
      discovery: {
        capabilities: { self_hosted: true },
        deployment: { status: "ready" },
        domain,
        runtime: {
          api_base_url: apiBaseUrl,
          app_name: "Company Chat",
          app_version: "1.0.0",
          web_base_url: "https://chat.company.example",
          ws_base_url: "wss://chat.company.example/ws"
        },
        zone: {
          name: "Company Chat",
          registration_mode: registrationMode,
          status: "active"
        }
      }
    }
  };
}

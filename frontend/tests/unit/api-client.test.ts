import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiClientError, HttpClient } from "@webtui/api-client";

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    headers: {
      "content-type": "application/json"
    },
    status
  });
}

describe("HttpClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("unwraps API envelopes and attaches auth/query headers", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        data: { name: "Kỹ thuật" },
        success: true,
        timestamp: "2026-07-09T00:00:00Z"
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = new HttpClient({
      baseUrl: "https://api.vpsttt.com/",
      getAccessToken: () => "access-token"
    });

    const result = await client.get<{ name: string }>("/api/v1/channels", {
      query: {
        empty: "",
        q: "kỹ thuật",
        tag: ["chat", "ops"]
      }
    });

    expect(result).toEqual({ name: "Kỹ thuật" });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.vpsttt.com/api/v1/channels?q=k%E1%BB%B9+thu%E1%BA%ADt&tag=chat&tag=ops");
    expect((init.headers as Headers).get("Authorization")).toBe("Bearer access-token");
    expect((init.headers as Headers).get("Accept")).toBe("application/json");
  });

  it("serializes JSON bodies without overriding FormData content type", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        data: { id: "msg-1" },
        success: true,
        timestamp: "2026-07-09T00:00:00Z"
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = new HttpClient({ baseUrl: "https://api.vpsttt.com" });

    await client.post("/api/v1/messages", { body: "Xin chào" });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.body).toBe(JSON.stringify({ body: "Xin chào" }));
    expect((init.headers as Headers).get("Content-Type")).toBe("application/json");
  });

  it("refreshes once after a 401 response and retries the request", async () => {
    let token = "expired-token";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(
          {
            error: { code: "UNAUTHORIZED", message: "Hết phiên đăng nhập." },
            success: false,
            timestamp: "2026-07-09T00:00:00Z"
          },
          401
        )
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: { ok: true },
          success: true,
          timestamp: "2026-07-09T00:00:00Z"
        })
      );
    const refreshAccessToken = vi.fn(async () => {
      token = "fresh-token";
      return token;
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = new HttpClient({
      baseUrl: "https://api.vpsttt.com",
      getAccessToken: () => token,
      refreshAccessToken
    });

    await expect(client.get<{ ok: boolean }>("/api/v1/me")).resolves.toEqual({ ok: true });
    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
    expect((fetchMock.mock.calls[1][1].headers as Headers).get("Authorization")).toBe("Bearer fresh-token");
  });

  it("throws ApiClientError with backend request id", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(
          {
            error: {
              code: "VALIDATION_ERROR",
              details: { field: "name" },
              message: "Tên không hợp lệ."
            },
            request_id: "req-123",
            success: false,
            timestamp: "2026-07-09T00:00:00Z"
          },
          422
        )
      )
    );

    const client = new HttpClient({ baseUrl: "https://api.vpsttt.com" });

    await expect(client.get("/api/v1/workspaces")).rejects.toMatchObject<ApiClientError>({
      code: "VALIDATION_ERROR",
      details: { field: "name" },
      message: "Tên không hợp lệ.",
      requestId: "req-123",
      status: 422
    });
  });

  it("returns binary blobs without envelope parsing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("file-content", { status: 200 }))
    );

    const client = new HttpClient({ baseUrl: "https://api.vpsttt.com" });
    const blob = await client.blob("/api/v1/files/file-1/download");

    await expect(blob.text()).resolves.toBe("file-content");
  });
});

"use client";

import { type FormEvent, useState } from "react";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Globe2,
  Server
} from "@webtui/icons";
import {
  normalizePortalServer,
  parsePortalDiscovery,
  type PortalServer
} from "@/lib/server-registration";

type SubmissionState =
  | { status: "idle" }
  | { status: "checking" }
  | { message: string; status: "error" }
  | { server: PortalServer; status: "ready" };

export function DomainOnboarding() {
  const [domain, setDomain] = useState("");
  const [submission, setSubmission] = useState<SubmissionState>({
    status: "idle"
  });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmission({ status: "checking" });

    try {
      const target = normalizePortalServer(domain);
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 12_000);
      let response: Response;
      try {
        const discoveryUrl = new URL("/api/v1/discovery", target.origin);
        discoveryUrl.searchParams.set("domain", target.domain);
        response = await fetch(discoveryUrl, {
          headers: { Accept: "application/json" },
          signal: controller.signal
        });
      } finally {
        window.clearTimeout(timeout);
      }
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(serverErrorMessage(payload));
      }
      const server = parsePortalDiscovery(payload, target.origin);
      setSubmission({ server, status: "ready" });
      window.setTimeout(() => window.location.assign(server.entryUrl), 450);
    } catch (error) {
      const message =
        error instanceof DOMException && error.name === "AbortError"
          ? "Server phản hồi quá chậm. Hãy kiểm tra DNS, firewall và TLS."
          : error instanceof Error
            ? error.message
            : "Không thể kiểm tra instance tại domain này.";
      setSubmission({ message, status: "error" });
    }
  }

  return (
    <section className="onboarding" aria-labelledby="onboarding-title">
      <div className="onboarding__intro">
        <p className="eyebrow"><Server size={16} /> Instance self-hosted</p>
        <h1 id="onboarding-title">Kết nối WebTUI Chat của công ty</h1>
        <p>
          Instance cần được cài trên VPS trước. Portal chỉ kiểm tra server và
          đưa bạn tới đúng nơi đăng ký hoặc đăng nhập.
        </p>
        <div className="trust-row" aria-label="Ranh giới dữ liệu">
          <span><CheckCircle2 size={17} /> Dữ liệu ở server công ty</span>
          <span><CheckCircle2 size={17} /> Token không đi qua portal</span>
        </div>
      </div>

      <form className="domain-form" onSubmit={handleSubmit}>
        <label htmlFor="company-domain">Domain WebTUI Chat</label>
        <div className="domain-input">
          <Globe2 aria-hidden="true" size={20} />
          <input
            autoCapitalize="none"
            autoComplete="url"
            disabled={submission.status === "checking"}
            id="company-domain"
            onChange={(event) => {
              setDomain(event.target.value);
              if (submission.status !== "idle") {
                setSubmission({ status: "idle" });
              }
            }}
            placeholder="chat.company.com"
            required
            spellCheck={false}
            value={domain}
          />
          <button
            disabled={submission.status === "checking" || !domain.trim()}
            type="submit"
          >
            {submission.status === "checking" ? (
              <span className="spinner" aria-hidden="true" />
            ) : (
              <ArrowRight aria-hidden="true" size={19} />
            )}
            {submission.status === "checking" ? "Đang kiểm tra" : "Tiếp tục"}
          </button>
        </div>

        {submission.status === "error" ? (
          <p className="form-message form-message--error" role="alert">
            {submission.message}
          </p>
        ) : null}
        {submission.status === "ready" ? (
          <div className="server-result" role="status">
            <Building2 aria-hidden="true" size={20} />
            <span>
              <strong>{submission.server.name}</strong>
              <small>
                {submission.server.domain} · v{submission.server.appVersion}
              </small>
            </span>
            <CheckCircle2 aria-hidden="true" size={20} />
          </div>
        ) : null}
      </form>
    </section>
  );
}

function serverErrorMessage(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return "Không tìm thấy API WebTUI Chat tại domain này.";
  }
  const root = payload as Record<string, unknown>;
  const error =
    root.error && typeof root.error === "object"
      ? (root.error as Record<string, unknown>)
      : null;
  return typeof error?.message === "string"
    ? error.message
    : "Instance chưa sẵn sàng hoặc không phải WebTUI Chat self-hosted.";
}

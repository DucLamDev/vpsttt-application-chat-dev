# Desktop App Phase D11 Completion

Phase D11 completes the release-readiness layer for the Tauri desktop app:
automated validation, native build workflow, smoke checklist, and release
runbook guardrails.

## Status

| Item | Status | Notes |
|---|---|---|
| D11.1 Unit test chat-core/platform | Done | Added `chat-core-platform.test.ts` to verify platform service injection used by browser/Tauri adapters. |
| D11.2 Rust unit test | Done | Added Rust tests for tray unread tooltip logic in `src-tauri/src/main.rs`. |
| D11.3 Desktop E2E Windows | Prepared | `desktop.yml` builds Windows bundle; manual smoke still needs a real Windows runner with secrets and a staging account. |
| D11.4 Cross-platform smoke test | Prepared | `desktop.yml` runs native bundle build on Windows, macOS, and Linux. |
| D11.5 Security test | Done | CI runs typecheck/lint/unit/build; release checklist keeps CSP/capability/token redaction as a blocking review item. |
| D11.6 Crash reporting redaction | Documented | No crash vendor is wired yet; policy is to never send message body, tokens, file paths, or raw URLs containing credentials. |
| D11.7 Workflow `desktop.yml` | Done | Workflow runs Node checks, desktop static export, Rust fmt/clippy/test, native bundle build, and artifact upload. |
| D11.8 Staging release | Ready for ops | Requires protected GitHub environment, signing secrets, and staging users. |
| D11.9 Production rollout | Ready for ops | Use signed updater manifests and percentage rollout after staging soak. |

## Required Local Commands

From `frontend`:

```bash
npm ci
npm run typecheck
npm run lint
npm run test:unit
npm --workspace @webtui/web run build:desktop
npm --workspace @webtui/desktop run build
```

From `frontend/apps/desktop/src-tauri`:

```bash
cargo fmt -- --check
cargo clippy --all-targets -- -D warnings
cargo test
```

## Release Smoke

- Start app, login, switch workspace, open direct chat and channel.
- Send/receive text, reaction, pin, edit, delete, read state, and typing.
- Upload/download image/file and record/play voice.
- Start voice/video call in a direct chat. Missed and completed call cards must
  appear in the timeline.
- Disable network, verify offline read/outbox, restore network, verify retry.
- Click native notification/deep link and confirm the app focuses the expected
  chat/message.
- Verify no log contains access token, refresh token, message body, file path,
  or WebSocket URL with token.

## Run Guide

See `frontend/apps/desktop/README.md` for local development and build commands.
If `cargo metadata` fails, install Rust/Cargo first and reopen the terminal.

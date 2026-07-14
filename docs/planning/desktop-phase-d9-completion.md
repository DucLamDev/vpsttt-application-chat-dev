# Desktop App Phase D9 Completion

Ngay chot: 2026-07-14

Phase D9 hoan thien lop offline, reliability va performance cho desktop shell. Muc tieu la app khong bi day ve login khi mat mang, van doc duoc cache gan nhat, giu draft/outbox qua restart va retry message theo idempotency key.

## Ra soat Phase D8

| Hang muc | Ket luan |
|---|---|
| Ticket domain/UI | Giu trang thai xong: migration `000018_tickets`, backend module, OpenAPI/client/types va UI ticket that da co. |
| System/announcement message | Giu trang thai xong: timeline render dong he thong rieng, khong action/reaction. |
| Admin deep link | Giu trang thai xong: Settings chi hien link khi co `admin.view`. |
| Native smoke | Van bi chan boi may hien tai thieu `cargo`, nen Tauri native build dung o `cargo metadata`. |

## Ban giao D9

| Hang muc | Trang thai | Ghi chu |
|---|---:|---|
| D9.1 Local cache schema | Xong | Them cache envelope versioned cho workspace shell, chat lists, timeline, draft va outbox. |
| D9.2 Offline read mode | Xong | Auth khong clear session khi loi network; workspace/channel/timeline doc tu cache va hien offline banner. |
| D9.3 Message outbox | Xong | Text message offline duoc luu local outbox va hien lai pending sau restart. File/voice khong persist vi `File` object khong an toan qua restart. |
| D9.4 Idempotent retry | Xong | Backend nhan `client_message_id`/`Idempotency-Key`; migration `000019` tao unique index; retry khong tao duplicate message. |
| D9.5 Sync/catch-up | Xong | Khi online/WebSocket connected lai, app flush outbox va invalidate timeline/channel/direct conversation. |
| D9.6 Cache eviction | Xong | Timeline cache giu toi da 200 message/channel va 24 timeline gan nhat; draft/outbox khong nam trong eviction timeline. |
| D9.7 Draft per conversation | Xong | Draft luu theo workspace/channel va tu khoi phuc khi chuyen conversation/restart. |
| D9.8 Startup optimization | Xong | Shell doc workspace/chat cache truoc, remote query cap nhat sau; static desktop build van sinh `/chat/desktop`. |
| D9.9 Timeline performance | Xong | Message row dung CSS containment/content-visibility, cache window compact de giam DOM/storage pressure. |
| D9.10 Proxy/corporate network test | Xong | Desktop README co checklist offline/proxy/VPN/captive portal va WSS reconnect. |

## Backend va contract

- Migration moi: `backend/db/migrations/000019_messages_client_message_id.up.sql`.
- `SendMessageRequest` ho tro `client_message_id`; route send message cung nhan header `Idempotency-Key`.
- Message service merge `client_message_id` vao metadata va khong republish realtime/auto responder khi retry tra ve message cu.

## Kiem thu

Lenh can chay sau thay doi D9:

```bash
go test ./internal/modules/messages/...
npm.cmd run test:unit -- offline-cache.test.ts
npm.cmd run test:unit -- desktop-openapi-contract.test.ts
npm.cmd run typecheck
npm.cmd --workspace @webtui/web run lint
npm.cmd --workspace @webtui/web run build:desktop
npm.cmd --workspace @webtui/desktop run tauri -- build
```

Ghi chu: `tauri build` van can Rust/Cargo/rustup va Visual Studio Build Tools MSVC SDK tren Windows. Neu may thieu `cargo`, lenh se dung o `cargo metadata`.

Ket qua luot chay 2026-07-14:

- `go test ./internal/modules/messages/...` pass voi `GOCACHE` tro vao workspace.
- `go test ./internal/modules/tickets/...` pass de xac nhan D8 van on.
- `npm.cmd run test:unit -- offline-cache.test.ts` pass.
- `npm.cmd run test:unit -- desktop-openapi-contract.test.ts` pass.
- `npm.cmd run typecheck` pass.
- `npm.cmd --workspace @webtui/web run lint` pass.
- `npm.cmd --workspace @webtui/web run build:desktop` pass va sinh static route `/chat/desktop`.
- `npm.cmd --workspace @webtui/desktop run tauri -- build` van dung o `cargo metadata` vi may hien tai chua co `cargo`.

## Dieu kien chuyen D10

- Chay migration `000019_messages_client_message_id` tren database dev/staging.
- Smoke test offline: load channel online, tat mang, restart app, doc cache, gui text, bat mang va xac nhan server chi co mot message.
- Cai native toolchain de smoke test desktop runtime that truoc khi packaging/signing.

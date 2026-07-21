# Desktop App Phase D0 Completion

Ngày chốt: 2026-07-13

Phase này khóa phạm vi và contract nền tảng cho desktop app Tauri. Đây là “phase đầu” của roadmap desktop hiện tại: chưa dựng native shell Tauri hoàn chỉnh, nhưng đã có quyết định kiến trúc, API contract guard và đường build static cho Next.js để bước D1/D2 không đi sai hướng.

## Quyết định đã chốt

1. UI desktop tái sử dụng `frontend/apps/web`, không viết lại một React/Vite app riêng.
2. Tauri chỉ làm native host, tray, notification, secure storage, file/microphone/deep link ở các phase sau.
3. Development dùng Next.js dev server của web app.
4. Production dùng `TAURI_BUILD=1` để Next.js build static export ra `frontend/apps/web/out`, sau đó Tauri đóng gói thư mục này.
5. Mọi nghiệp vụ vẫn gọi Go API thật qua `@webtui/api-client`; desktop không mock API.
6. Windows là nền tảng ưu tiên đầu tiên; macOS/Linux đi sau khi contract ổn định.
7. RBAC tiếp tục lấy từ backend. Desktop chỉ ẩn/hiện UI theo permission, backend vẫn là lớp chặn cuối cùng.

## Bàn giao đã thực hiện

| Hạng mục | Trạng thái | Ghi chú |
|---|---:|---|
| Parity web sang desktop | Xong | Roadmap desktop đã liệt kê auth, workspace, chat, file, voice, notification, bot, automation, phòng ban, settings. |
| OpenAPI contract test | Xong | Thêm `frontend/tests/unit/desktop-openapi-contract.test.ts`. |
| Static export POC hook | Xong | `frontend/apps/web/next.config.mjs` chỉ bật `output: "export"` khi có `TAURI_BUILD=1`. |
| Desktop build script | Xong | Chạy `npm --workspace @webtui/web run build:desktop` trong thư mục `frontend`. |
| CORS/CSP strategy | Chốt hướng | Desktop production dùng static local bundle và gọi `https://chat.vpsttt.com` / `wss://chat.vpsttt.com/ws`. |
| Telemetry/privacy | Chốt hướng | Không log token, API key, nội dung chat, URL websocket có token hoặc file nhạy cảm. |

## API contract hiện tại

Contract test đang khóa các nhóm API desktop MVP:

- Auth/session: login, refresh, logout, me, sessions.
- Workspace/member/channel/direct conversation.
- Message timeline: send, edit/delete target, thread, attachments, search, read-state.
- File, notification, presence, departments, bots, cronjobs.
- WebSocket `/api/v1/ws`.

## Gap cần xử lý trước các phase native sâu hơn

Các route order bot đã có ở Go handler nhưng chưa được khai báo trong OpenAPI:

- `POST /api/v1/workspaces/{workspace_id}/order-bot/wallet/balance`
- `POST /api/v1/workspaces/{workspace_id}/order-bot/wallet/deposit-qr`
- `POST /api/v1/workspaces/{workspace_id}/order-bot/payment/order-qr`
- `POST /api/v1/workspaces/{workspace_id}/order-bot/services/renew`

Contract test hiện cho phép trạng thái “chưa khai báo route order bot”, nhưng sẽ fail nếu sau này chỉ khai báo một phần. Khi bắt đầu desktop phase bot/automation nghiệp vụ, cần bổ sung đầy đủ OpenAPI và typed client cho nhóm này.

Các gap native chưa triển khai trong D0:

- Secure token storage adapter cho Tauri.
- Native notification preference/device token.
- File save/open native command.
- Microphone permission và voice recorder adapter native.
- Deep link callback cho Google OAuth desktop.
- Offline outbox/idempotency cho mutation.

## Cách chạy kiểm tra Phase D0

Từ thư mục `frontend`:

```bash
npm run test:unit -- desktop-openapi-contract.test.ts
npm --workspace @webtui/web run build:desktop
```

Build web bình thường vẫn giữ nguyên:

```bash
npm --workspace @webtui/web run build
```

## Điều kiện chuyển sang D1/D2

- `npm run test:unit` pass.
- `npm --workspace @webtui/web run typecheck` pass.
- `npm --workspace @webtui/web run lint` pass.
- `build:desktop` sinh được `apps/web/out` hoặc có danh sách server-only blocker rõ ràng để xử lý trước khi scaffold Tauri.

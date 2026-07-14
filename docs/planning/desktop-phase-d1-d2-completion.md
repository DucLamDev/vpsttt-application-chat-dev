# Desktop App Phase D1-D2 Completion

Ngày chốt: 2026-07-14

Phase D1/D2 đã đưa desktop app từ mức contract/POC sang nền tảng có thể phát triển
Tauri thật: web app dùng platform contracts chung, API client hỗ trợ fetcher injection,
và `apps/desktop` đã có native host Windows-first dùng static export từ `apps/web`.

## Bàn giao D1

| Hạng mục | Trạng thái | Ghi chú |
|---|---:|---|
| `packages/chat-core` | Xong | Thêm package dùng chung cho platform contracts và adapters. |
| Platform contracts | Xong | Có storage, notification, media recorder, clipboard, file, link, lifecycle và fetcher. |
| Browser adapter | Xong | Web giữ hành vi hiện tại qua `createBrowserPlatformServices()`. |
| Fetcher injection | Xong | `HttpClient` nhận `fetcher`; web inject từ platform runtime. |
| Auth storage adapter | Xong | Zustand auth store không gọi trực tiếp `localStorage/sessionStorage`. |
| Notification adapter | Xong | Chat notification request/show đi qua `NotificationService`. |
| Media adapter | Xong | Voice recorder và mime support đi qua `MediaService`. |
| Device/preferences storage | Xong | Presence device id và chat preferences đi qua platform storage. |

## Bàn giao D2

| Hạng mục | Trạng thái | Ghi chú |
|---|---:|---|
| `apps/desktop` Tauri scaffold | Xong | App desktop chỉ là native host, không tạo UI React/Vite thứ hai. |
| Next.js desktop static build | Xong | `TAURI_BUILD=1` vẫn sinh `apps/web/out`; Tauri `frontendDist` trỏ tới thư mục này. |
| Dev/build scripts | Xong | `npm run dev:desktop`, `npm run build:desktop`; desktop workspace có `@tauri-apps/cli`. |
| Security baseline | Xong | CSP allowlist API/WS/asset local; capability file chỉ bật core, HTTP, notification, dialog, opener và fs scope tối thiểu. |
| App identity | Xong | `identifier: com.vpsttt.webtui.chat`, product name `WebTui Chat`, window min width 1024px. |
| Native plugins | Xong | Rust host khởi tạo dialog, fs, HTTP, notification và opener plugins. |

## Cách kiểm tra đã chạy

Từ thư mục `frontend`:

```bash
npm run typecheck
npm run test:unit -- desktop-openapi-contract.test.ts
npm --workspace @webtui/web run lint
npm --workspace @webtui/web run build:desktop
npm --workspace @webtui/desktop run tauri -- --version
```

Kết quả:

- `typecheck`, desktop OpenAPI contract, web lint và `build:desktop` đều pass.
- Tauri CLI chạy được với `tauri-cli 2.11.4`.

## Blocker môi trường native build

Máy hiện tại chưa cài Rust/Cargo/rustup và Visual Studio Build Tools MSVC SDK, nên
chưa thể compile native installer. `tauri info` đã xác nhận:

- `rustc`: not installed
- `Cargo`: not installed
- Visual Studio/MSVC Build Tools: not detected

Sau khi cài Rust toolchain và MSVC Build Tools, chạy:

```bash
cd frontend
npm run dev:desktop
npm run build:desktop
```

## Điều kiện chuyển D3

- Native `tauri dev` mở được app Windows sau khi cài toolchain.
- Native `tauri build` sinh artifact local.
- Secure token adapter Tauri/keychain bắt đầu ở D3, không lưu refresh token desktop trong localStorage.

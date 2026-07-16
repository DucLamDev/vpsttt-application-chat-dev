# Desktop App Phase D3-D4 Completion

Ngày chốt: 2026-07-14

Phase D3/D4 hoàn thiện nền auth/session/workspace và shell chat cho desktop static
bundle. Web UI vẫn là nguồn duy nhất; desktop dùng secure storage command ở Tauri host,
route query ổn định cho static export, và toàn bộ workflow channel/direct hiện có được
tái sử dụng qua API thật.

## Bàn giao D3

| Hạng mục | Trạng thái | Ghi chú |
|---|---:|---|
| Secure token adapter | Xong P0 | Desktop platform storage gọi Tauri command `secure_store_*`; Rust host dùng OS keychain qua crate `keyring`. |
| Access token memory-only | Xong P0 | Khi chạy desktop, Zustand persist không lưu `accessToken`; access token chỉ sống trong memory. |
| Restart app khôi phục phiên | Xong P0 | `AuthProvider` tự refresh khi đã hydrate refresh token nhưng chưa có access token. |
| Logout xóa session/cache | Xong P0 | Luồng logout hiện có xóa store, query cache và media object URL cache; storage adapter remove cả session/persistent key. |
| Session list/revoke/revoke-all | Xong P0 | UI settings đang dùng API thật `auth.sessions`, `revokeSession`, `revokeAllSessions`. |
| Workspace list/switch | Xong P0 | `useWorkspaceContext` resolve workspace theo id/slug và scope query cache theo workspace. |
| RBAC permission | Xong P0 | Permission load qua `api.rbac.myPermissions(workspaceId)` và UI gate bằng permission set. |
| Hồ sơ/avatar/phone/theme | Xong P0 | Profile form, avatar URL/upload và theme hiện có dùng API/theme provider thật. |
| Google OAuth desktop redirect | Chuẩn bị P1 | Credential flow hiện có vẫn hoạt động qua Google client id; deep-link protocol callback đầy đủ sẽ đi cùng D7 notification/deep-link workstream. |
| Lock screen khi resume | Deferred P1 | Chưa bật policy idle/resume; giữ trong backlog hardening sau secure storage. |

## Bàn giao D4

| Hạng mục | Trạng thái | Ghi chú |
|---|---:|---|
| Desktop responsive shell | Xong P0 | Shell hiện tại hỗ trợ rail/sidebar/timeline/panel từ min width 1024px trong Tauri config. |
| Direct conversation list | Xong P0 | DM list dùng API direct conversations, preview, unread và relative time thật. |
| Channel public/private/group | Xong P0 | Channel directory/list xử lý membership, private bot session và permission đúng API. |
| Unread/favorite/search | Xong P0 | Read state API, local favorite preference và message search/filter vẫn hoạt động trong desktop route. |
| Create/join/invite/request channel | Xong P0 | Mutations có feedback/refetch; private-session channel mở đúng phiên riêng. |
| Channel info/member/pinned/media/file panel | Xong P0 | Panel phải chỉ dựa trên selected chat/channel, có tab tin ghim, ảnh/video và file. |
| URL/deep route nội bộ | Xong P0 | Desktop static export dùng `/chat/desktop?workspace=...&kind=...&target=...` để reload/reopen không cần dynamic HTML mới. |
| Keyboard navigation nền | Xong P1 | Ctrl/Cmd+K mở search, `/` focus composer, Escape đóng overlay. |

## Cách kiểm tra đã chạy

Từ thư mục `frontend`:

```bash
npm run typecheck
npm --workspace @webtui/web run lint
npm --workspace @webtui/web run build:desktop
npm run test:unit -- desktop-openapi-contract.test.ts
npm --workspace @webtui/desktop run tauri -- --version
npm --workspace @webtui/desktop run tauri -- build
```

Kết quả:

- Typecheck toàn workspace pass.
- Web lint pass.
- Desktop static export pass và vẫn sinh route `/chat/desktop`.
- Desktop OpenAPI contract pass.
- Tauri CLI chạy được với `tauri-cli 2.11.4`.
- Native `tauri build` vẫn dừng ở `cargo metadata` vì môi trường chưa cài Cargo/Rust/MSVC Build Tools.

## Blocker môi trường native build

Code D3/D4 đã sẵn cho native host, nhưng máy hiện tại vẫn thiếu:

- `rustc`
- `cargo`
- `rustup`
- Visual Studio Build Tools MSVC SDK

Sau khi cài toolchain native, chạy lại:

```bash
cd frontend
npm run dev:desktop
npm run build:desktop
```

## Điều kiện chuyển D5

- Native `tauri dev` mở được app và khôi phục session từ OS keychain.
- Chọn workspace/channel/DM rồi reload vẫn mở đúng target qua desktop query route.
- Realtime/message lifecycle có thể được harden tiếp ở D5.

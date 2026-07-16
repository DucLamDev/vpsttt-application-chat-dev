# Desktop App Phase D5 Completion

Ngày chốt: 2026-07-14

Phase D5 hoàn thiện lớp message và realtime cho desktop static bundle. Trọng tâm là timeline cursor không nhảy vị trí, composer đủ text/markdown/emoji/mention, mutation message dùng cache optimistic, realtime không nhân bản message và có catch-up khi app quay lại từ offline/sleep.

## Rà soát D1-D4

| Nhóm | Trạng thái | Ghi chú |
|---|---:|---|
| D1 platform contracts | Xong | `chat-core` có storage, notification, media, clipboard, file, link, lifecycle và fetcher contract; web/Tauri dùng chung runtime adapter. |
| D1 fetcher/storage/media | Xong | `HttpClient` nhận fetcher; auth, chat preference, device id, notification và voice recorder không gọi trực tiếp browser API ở feature layer. |
| D1.1 tách `ChatWorkspace` | Bổ sung một phần | Message/realtime/cache đã nằm trong hook/model riêng và có test cache. `ChatWorkspace` vẫn còn lớn; phần tách shell/panel/settings còn là cleanup kiến trúc sau D5, không chặn desktop runtime. |
| D2 Tauri foundation | Xong code | Static export, CSP/capabilities tối thiểu, identity, opener/link policy và scripts desktop đã có. Native build vẫn cần Rust/Cargo/MSVC trên máy chạy. |
| D3 auth/session | Xong P0 | Refresh token dùng secure storage Tauri command; access token memory-only trong desktop; app restart tự refresh session khi đã hydrate refresh token. |
| D4 shell/channel/route | Xong P0 | Desktop query route, conversation/channel list, scoped detail panel, unread/favorite/search, join/request/private channel và shortcut nền đã hoạt động trên web bundle desktop. |
| D3/D4 P1 | Deferred | Google deep-link callback desktop và lock screen khi resume vẫn để backlog hardening vì chưa có policy/provider native đầy đủ. |

## Bàn giao D5

| Hạng mục | Trạng thái | Ghi chú |
|---|---:|---|
| D5.1 Timeline cursor/infinite scroll | Xong | `useInfiniteQuery` dùng cursor `before`; timeline tự tải thêm khi cuộn lên đầu và giữ scroll anchor sau khi prepend tin cũ. |
| D5.2 Text/markdown/emoji/mention | Xong | Composer gửi text/file; markdown render bằng React node an toàn; emoji picker giữ nguyên; mention autocomplete `@` gửi `mentioned_user_ids` cho backend. |
| D5.3 Edit/delete/recall | Xong | Edit/delete có owner/permission gate và optimistic cache rollback khi lỗi. |
| D5.4 Reaction đầy đủ | Xong | Add/remove reaction gọi API thật; realtime `ReactionChanged` merge vào timeline bằng id nên không nhân bản count. |
| D5.5 Reply/thread | Xong | Thread panel và composer riêng; gửi reply dùng `parent_id` và invalidate thread query. |
| D5.6 Pin/unpin/forward | Xong | Pin merge timeline và invalidate pins; unpin dùng nguồn pins query; forward chỉ liệt kê target mà user đang có trong chat targets. |
| D5.7 Message search/filter | Xong | Search có filter channel, sender, kind, date; kết quả dùng API search theo workspace và chỉ mở target có quyền. |
| D5.8 WebSocket lifecycle | Xong | Connect/join/leave/reconnect có exponential backoff và status store. |
| D5.9 Merge realtime cache | Xong | Create/update/delete/reaction/pin dùng helper cache chung; unit test cover dedupe, optimistic replace và update ở page cũ. |
| D5.10 Typing/read/presence | Xong | Typing tự hết hạn; read state gọi API theo last message; presence heartbeat dùng device id ổn định trên desktop storage. |
| D5.11 Sleep/wake/network change | Xong | `online`, `focus`, `visibilitychange` trigger REST catch-up và reconnect; `offline` đưa realtime status về offline. |

## Kiểm thử

Chạy từ thư mục `frontend`:

```bash
npm.cmd run typecheck
npm.cmd --workspace @webtui/web run lint
npm.cmd run test:unit -- message-cache.test.ts
npm.cmd run test:unit -- chat-route.test.ts
npm.cmd run test:unit -- desktop-openapi-contract.test.ts
npm.cmd --workspace @webtui/web run build:desktop
npm.cmd --workspace @webtui/desktop run tauri -- --version
```

Ghi chú môi trường: PowerShell trên máy này chặn `npm.ps1`, nên dùng `npm.cmd`. Native `tauri build` vẫn cần cài Rust/Cargo/rustup và Visual Studio Build Tools MSVC SDK trước khi sinh installer.

Kết quả lượt chạy 2026-07-14:

- `typecheck`, web lint, `message-cache.test.ts`, `chat-route.test.ts`, `desktop-openapi-contract.test.ts` đều pass.
- `build:desktop` pass và sinh static route `/chat/desktop`.
- Tauri CLI chạy được với `tauri-cli 2.11.4`.
- `tauri build` dừng ở `cargo metadata` vì máy hiện tại chưa có `cargo`.

## Điều kiện chuyển D6

- Cài native toolchain để smoke test `tauri dev`/`tauri build` trên Windows thật.
- Bắt đầu D6 bằng native file picker/save dialog và upload queue hardening.
- Nếu cần đóng tuyệt đối D1.1, tách tiếp `ChatWorkspace` thành shell/sidebar/composer/detail modules trước khi mở rộng media flow.

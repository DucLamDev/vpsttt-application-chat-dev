# Desktop App Phase D7 Completion

Ngày chốt: 2026-07-14

Phase D7 hoàn thiện lớp notification và trải nghiệm desktop native quanh app shell: notification center, native notification, preference/mute/quiet hours, deep link `webtui://`, click notification mở đúng hội thoại, system tray, single instance và autostart.

## Rà soát Phase D6

| Hạng mục | Kết luận |
|---|---|
| File picker/save | Giữ trạng thái hoàn thành: web dùng fallback browser, desktop dùng Tauri dialog/fs adapter. |
| Upload queue/media/voice | Queue, drag/drop, paste ảnh, preview media, voice record/playback và checksum save đều đã có trong static bundle. |
| File policy/security | UI reject file >100MB, validate MIME theo backend và hiển thị trạng thái scanning/quarantine/infected nếu backend trả `status`. |
| Native smoke | Vẫn cần Rust/Cargo/MSVC để kiểm thử `tauri dev` thật trên Windows. |

## Bàn giao D7

| Hạng mục | Trạng thái | Ghi chú |
|---|---:|---|
| D7.1 In-app notification center | Xong | Badge, dropdown list, contact requests, mark read và mark-all-read dùng API thật. |
| D7.2 Native notification adapter | Xong | Tauri adapter dùng `@tauri-apps/plugin-notification`; request permission, send native notification và nhận click action. |
| D7.3 Notification preference/mute | Xong | Settings có All/Mention/Mute, preview privacy, quiet hours; backend lưu theo user/workspace qua `/api/v1/notifications/preferences`, frontend có local cache/fallback. |
| D7.4 Deep link protocol `webtui://` | Xong | Tauri deep-link plugin cấu hình scheme `webtui`; frontend parse `webtui://chat?workspace=...&kind=...&target=...&message=...`. |
| D7.5 Click native notification | Xong | Notification payload chứa workspace/channel/message; click mở hội thoại và highlight message nếu đã có trong timeline. |
| D7.6 System tray | Xong code native | Rust host tạo tray menu Hiện/Ẩn/Thoát, click trái focus cửa sổ chính và nhận unread count để cập nhật tooltip tray. |
| D7.7 Single instance | Xong code native | Rust host đăng ký `tauri-plugin-single-instance`; mở lần hai focus instance hiện có. |
| D7.8 Auto start tùy chọn | Xong P1 | Settings có toggle autostart; Tauri adapter dùng `@tauri-apps/plugin-autostart`; mặc định tắt. |
| D7.9 Quiet hours/Do Not Disturb | Xong P1 | Local quiet hours chặn native notification trong khung giờ cấu hình. |

## Kiểm thử

Chạy từ thư mục `frontend`, riêng lệnh Go chạy từ `backend`:

```bash
npm.cmd run typecheck
npm.cmd --workspace @webtui/web run lint
npm.cmd run test:unit -- message-cache.test.ts
npm.cmd run test:unit -- chat-route.test.ts
npm.cmd run test:unit -- desktop-openapi-contract.test.ts
npm.cmd --workspace @webtui/web run build:desktop
npm.cmd --workspace @webtui/desktop run tauri -- --version
npm.cmd --workspace @webtui/desktop run tauri -- build
go test ./internal/modules/notifications/...
```

Ghi chú: `tauri build` vẫn cần Rust/Cargo/rustup và Visual Studio Build Tools MSVC SDK. Nếu máy thiếu `cargo`, lệnh dừng ở `cargo metadata`.

Kết quả lượt chạy 2026-07-14:

- `typecheck`, web lint, `message-cache.test.ts`, `chat-route.test.ts`, `desktop-openapi-contract.test.ts` đều pass.
- `go test ./internal/modules/notifications/...` pass với notification preference service coverage.
- `build:desktop` pass và sinh static route `/chat/desktop`.
- Tauri CLI chạy được với `tauri-cli 2.11.4`.
- `tauri build` dừng ở `cargo metadata` vì máy hiện tại chưa có `cargo`.

## Điều kiện chuyển D8

- Cài native toolchain để smoke test tray, single-instance, deep-link và notification click thật trên Windows.
- Chạy migration `000017_notification_preferences` trước khi test server sync preference trên môi trường có database thật.
- Bắt đầu D8 bằng module nghiệp vụ: department/bot/order/automation parity và ticket API thật.

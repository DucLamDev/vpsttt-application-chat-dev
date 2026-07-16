# Desktop App Phase D6 Completion

Ngày chốt: 2026-07-14

Phase D6 hoàn thiện luồng ảnh, file, voice và preview media cho desktop bundle. Web vẫn dùng cùng UI, còn desktop có điểm cắm native qua platform adapter để chọn file và lưu file bằng dialog hệ điều hành.

## Rà soát Phase D5

| Hạng mục | Kết luận |
|---|---|
| Timeline/realtime | Giữ trạng thái D5 đã hoàn thành: cursor pagination, scroll anchor, realtime merge cache, reconnect/catch-up khi resume/offline. |
| Composer message | Đã bổ sung mention autocomplete và `mentioned_user_ids`; Phase D6 không phát hiện thêm gap P0 ở D5. |
| Cache/test | `message-cache.test.ts` tiếp tục cover dedupe, optimistic replace và update message ở page cũ. |

## Bàn giao D6

| Hạng mục | Trạng thái | Ghi chú |
|---|---:|---|
| D6.1 Native file picker | Xong | `FileService.pickFiles()` có browser fallback và Tauri adapter dùng `@tauri-apps/plugin-dialog` + `@tauri-apps/plugin-fs`; picker áp dụng MIME/extension policy. |
| D6.2 Drag/drop và clipboard ảnh | Xong | Composer nhận drop file, paste ảnh, preview trước gửi và validate trước khi vào queue. Tauri fs scope vẫn giới hạn đường đọc/ghi đã cấu hình. |
| D6.3 Upload queue/progress/retry/remove | Xong | Queue có trạng thái queued/uploading/attached/failed, retry/remove giữ item lỗi để gửi lại, không xóa nhầm file đã attach. |
| D6.4 Attachment preview | Xong | Timeline preview ảnh/audio/video; media resolver dùng cache object URL và attachment loading state. |
| D6.5 Native save/download | Xong | Download gọi `FileService.saveBlob()`; desktop mở save dialog native, web dùng browser download. Nếu backend trả checksum SHA-256 thì verify trước khi lưu. |
| D6.6 Voice recording | Xong | Recorder hỗ trợ start, pause, resume, stop, cancel; duration loại trừ thời gian pause và giới hạn 5 phút. |
| D6.7 Voice playback | Xong | Voice player có play/pause/seek/speed và event global để chỉ một voice phát cùng lúc. |
| D6.8 Microphone permission UX | Xong | Browser media adapter phân biệt lỗi denied/not found và trả thông báo hướng dẫn cấp quyền micro rõ hơn. |
| D6.9 Large file/network interruption | Xong P1 | UI reject file >100MB trước khi upload; file upload lỗi giữ lại trong queue để retry, composer không bị treo. |
| D6.10 File security state | Xong P1 | File/attachment hiển thị trạng thái scanning/quarantine/infected nếu backend trả `status`. |

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
npm.cmd --workspace @webtui/desktop run tauri -- build
```

Ghi chú: `tauri build` vẫn cần Rust/Cargo/rustup và Visual Studio Build Tools MSVC SDK trên máy chạy. Nếu thiếu `cargo`, lệnh sẽ dừng ở `cargo metadata`.

Kết quả lượt chạy 2026-07-14:

- `typecheck`, web lint, `message-cache.test.ts`, `chat-route.test.ts`, `desktop-openapi-contract.test.ts` đều pass.
- `build:desktop` pass và sinh static route `/chat/desktop`.
- Tauri CLI chạy được với `tauri-cli 2.11.4`.
- `tauri build` dừng ở `cargo metadata` vì máy hiện tại chưa có `cargo`.

## Điều kiện chuyển D7

- Cài native toolchain để smoke test picker/save/voice trên `tauri dev`.
- Bắt đầu D7 bằng native notification click/deep link/system tray.
- Nếu backend mở thêm video upload chính thức, cập nhật allowlist MIME tương ứng ở backend và UI policy cùng lúc.

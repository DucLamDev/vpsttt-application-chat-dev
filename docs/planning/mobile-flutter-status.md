# Trạng thái khởi động Mobile App Flutter

Ngày cập nhật: 2026-07-15

## Tóm tắt nhanh

Mobile app Flutter chưa được scaffold trong repo. Hiện chưa có `mobile/pubspec.yaml`, chưa có file Dart, chưa có thư mục `mobile/android` hoặc `mobile/ios`.

Ảnh reference UI đã có trong repo và đã được chuẩn hóa đúng path mà roadmap/skill yêu cầu:

```text
docs/design/mobile/references/webtui-mobile-zalo-reference.png
```

Ảnh gốc hiện cũng còn tại:

```text
docs/design/mobile/references/design-mobile-app.png
```

Phase M0 đã hoàn thành ở mức planning/contract readiness qua `docs/planning/mobile-contract-gap.md`. Có thể tiếp tục chuẩn bị M1 sau khi backend owner chốt thứ tự triển khai các API P0 như push device, sync cursor, call session và bot/AI config theo workspace.

## Tài liệu đã đọc

| Tài liệu | Mục đích |
|---|---|
| `docs/planning/mobile-flutter-roadmap.md` | Roadmap M0-M13, Clean Architecture, release Android/iOS |
| `.agents/webtui-chat-mobile/SKILL.md` | Quy tắc mobile Flutter, UI reference, Clean Architecture |
| `docs/design/mobile/references/mobile-ui-reference.md` | Design guideline từ ảnh mẫu Zalo-like/WebTui |
| `.agents/webtui-chat-architecture/SKILL.md` | Quy tắc kiến trúc chung, backend module, OpenAPI |
| `backend/api/openapi/openapi.yaml` | Đã kiểm tra mục lục endpoint để xác nhận có contract nền cho auth/workspace/message/file/notification/bot/ticket |

## Kết quả rà soát repo

| Hạng mục | Trạng thái | Ghi chú |
|---|---|---|
| Flutter project | Chưa có | Không tìm thấy `pubspec.yaml` hoặc file `.dart` trong workspace |
| Mobile folder | Chưa có | Roadmap đề xuất tạo `mobile/` ở root |
| UI reference image | Đã có | Đã copy chuẩn tên `webtui-mobile-zalo-reference.png` |
| Mobile skill | Đã có | `.agents/webtui-chat-mobile/SKILL.md` đã được tạo |
| Mobile UI guideline | Đã có | `docs/design/mobile/references/mobile-ui-reference.md` |
| OpenAPI nền | Đã có một phần | Có auth, workspace, RBAC, channel, message, file, notification, presence, direct conversation, ticket, bot |
| API cần gap analysis | Đã làm | Xem `docs/planning/mobile-contract-gap.md`; các API P0 còn là backlog backend cần owner chốt |
| CI mobile | Chưa có | Chưa có `.github/workflows/mobile.yml` |

## Checklist trạng thái M0-M13

| Phase | Trạng thái | Lý do | Việc tiếp theo |
|---|---|---|---|
| M0 Contract và mobile readiness | Hoàn thành phần phân tích | Đã có ma trận parity, đối chiếu OpenAPI với route Go, API gap P0/P1, idempotency, sync, device registration, notification preference, call signaling, Android matrix và privacy policy | Backend owner chốt P0 contract trước khi sinh Dart client |
| M1 Flutter foundation | Chưa bắt đầu một phần | Chưa scaffold Flutter app; riêng UI reference/skill và M0 contract gap đã sẵn | Sau khi P0 contract tối thiểu ổn định, scaffold `mobile/` và CI nền |
| M2 Auth và secure session | Bị chặn bởi M1 | Chưa có Flutter app/core auth abstraction | Chờ M1 foundation |
| M3 Workspace, RBAC, profile | Bị chặn bởi M2 | Cần auth/session và workspace scope trước | Chờ M2 |
| M4 Conversation và channel | Bị chặn bởi M3 | Cần workspace/RBAC và app shell | Chờ M3 |
| M5 Message và realtime | Bị chặn bởi M4 | Cần conversation/channel foundation | Chờ M4 |
| M6 Media, voice note và call | Bị chặn bởi M5 và backend call API | Cần message timeline, upload, signaling contract | Chờ M5 và API call signaling |
| M7 Push, background và deep link | Bị chặn bởi M0/M2 | Cần device registration, notification worker, auth device identity | Chốt API push trong M0 |
| M8 Offline, sync và reliability | Bị chặn bởi M0/M5 | Cần sync cursor và message/outbox model | Chốt idempotency/sync trong M0 |
| M9 Module nghiệp vụ đầy đủ | Bị chặn bởi M3-M8 | Cần foundation, API thật và permission | Rà backend ticket/bot/automation API trước |
| M10 Native UX, accessibility và performance | Bị chặn bởi UI app thật | Cần các màn P0 để audit accessibility/performance | Chờ M4-M8 |
| M11 Android packaging | Bị chặn bởi app build được | Cần Flutter project và test/build | Chuẩn bị signing strategy sau M1 |
| M12 CH Play và kênh tải Android | Bị chặn bởi M11 | Cần AAB/APK signed, Play Console, privacy/data safety | Làm sau internal distribution |
| M13 iOS hardening và release | Bị chặn bởi app ổn định và macOS signing | Cần iOS runner, APNs, TestFlight | Làm sau Android MVP hoặc song song cuối M11 |

## Các phần đã sẵn sàng

- Roadmap M0-M13 đã có.
- Mobile skill đã có và bắt buộc đọc ảnh reference trước khi làm UI.
- Ảnh reference đã ở đúng path chuẩn.
- Prompt playbook đã có tại `docs/prompt/prompts.md`.
- OpenAPI hiện có nền tương đối rộng cho auth, workspace, RBAC, chat, file, notification, presence, ticket, bot.

## Blocker hiện tại

| Blocker | Ảnh hưởng | Cách gỡ |
|---|---|---|
| Chưa có Flutter project | Không thể chạy `flutter analyze`, test hoặc build APK | Hoàn thành M0 rồi scaffold `mobile/` trong M1 |
| API P0 mobile chưa có backend implementation | Push/call/sync/release metadata chưa thể dùng trong app thật | Backend owner chốt và triển khai theo `docs/planning/mobile-contract-gap.md` |
| Chưa xác nhận thứ tự P0 contract | M1 có thể scaffold được nhưng M5-M8/M11 sẽ bị chặn nếu contract chưa ổn định | Ưu tiên push device, sync cursor, call session, bot/AI config và mobile release metadata |
| Chưa có `.github/workflows/mobile.yml` | Không có quality gate mobile | Tạo trong M1 sau khi có Flutter project |

## Thứ tự triển khai 3 sprint đầu

### Sprint 1: Contract và nền kiến trúc

1. Tạo `docs/planning/mobile-contract-gap.md`.
2. Rà parity web/desktop -> mobile.
3. Đối chiếu `backend/api/openapi/openapi.yaml` với route Go cho các nhóm API P0.
4. Chốt API gap cho push devices, notification preference, idempotency, sync cursor, call signaling, bot/AI flow, release metadata.
5. Chốt `applicationId`, flavor naming, target platform và device matrix sơ bộ.

Kết quả mong muốn: M0 đủ rõ để scaffold Flutter mà không phải đoán contract.

### Sprint 2: Flutter foundation

1. Scaffold `mobile/` Flutter app.
2. Tạo Clean Architecture skeleton: `core`, `app`, `features/*`.
3. Thiết lập Riverpod, go_router, Dio boundary, Drift foundation, secure storage abstraction.
4. Tạo design tokens từ ảnh reference.
5. Tạo CI nền: format/analyze/test/build debug APK.
6. Viết README cách chạy mobile local.

Kết quả mong muốn: M1 foundation pass `flutter analyze` và có app shell trống đúng kiến trúc.

### Sprint 3: Auth, workspace và app shell Zalo-like

1. Làm M2 auth secure session.
2. Làm M3 workspace/RBAC/profile nền.
3. Dựng app shell mobile bám ảnh reference: bottom navigation, segmented tabs, list item, search, settings row.
4. Chỉ dùng API thật hoặc empty/loading/error state trung thực, không dùng mock production.
5. Chụp screenshot app shell và đối chiếu reference.

Kết quả mong muốn: người dùng đăng nhập, chọn workspace và vào app shell mobile đúng phong cách WebTui/Zalo-like.

## Verification đã chạy

| Kiểm tra | Kết quả |
|---|---|
| Kiểm tra Flutter files bằng `rg --files -g "pubspec.yaml" -g "*.dart"` | Không tìm thấy Flutter project |
| Kiểm tra ảnh reference chuẩn | Đã có sau khi copy từ `design-mobile-app.png` |
| Xem ảnh reference bằng `view_image` | Đúng mẫu mobile WebTui/Zalo-like đã chốt |
| Kiểm tra mục lục OpenAPI | Có các nhóm endpoint nền; đã đối chiếu gap trong `mobile-contract-gap.md` |
| Kiểm tra route Go | Đã rà route HTTP trong `backend/internal/**/delivery/http/handler.go` |

## Quyết định hiện tại

- Không scaffold Flutter trong lượt khởi động này vì prompt yêu cầu không viết code vội khi chưa có contract/gap rõ.
- Bước tiếp theo nên là chốt backend API P0 hoặc scaffold M1 nếu chấp nhận để các API P0 chưa có ở trạng thái blocked contract.
- Khi bắt đầu UI, bắt buộc mở `docs/design/mobile/references/webtui-mobile-zalo-reference.png` và đọc `.agents/webtui-chat-mobile/SKILL.md`.

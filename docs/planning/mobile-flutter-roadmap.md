# Kế hoạch triển khai Mobile App Flutter cho WebTui Chat

Tài liệu này chia việc triển khai Mobile App thành các phase và task có thể đưa thẳng vào backlog. Mục tiêu cuối là đạt đầy đủ chức năng người dùng trên Android và iOS, dùng API/WebSocket thật, hỗ trợ native push, camera, file, voice, deep link, offline và lifecycle nền; không mock nghiệp vụ trong bản phát hành.

## 1. Mục tiêu

- Cung cấp trải nghiệm mobile native, không nhúng WebView của web app.
- Dùng chung backend, OpenAPI contract, event schema và permission model với web/desktop.
- Có đầy đủ auth, workspace, chat, channel, direct message, media, notification, bot, automation, phòng ban và settings.
- Hoạt động tốt khi mạng yếu, app background/foreground, thiết bị bị kill và token push thay đổi.
- Bảo vệ refresh token bằng secure storage và dữ liệu cache bằng cơ chế phù hợp với dữ liệu nội bộ.
- Android phát hành trước, sau đó iOS qua TestFlight/App Store.

Admin Panel tiếp tục là web riêng. Mobile chỉ hiển thị chức năng người dùng được permission cho phép và có thể mở Admin Panel ngoài app cho quản trị viên.

## 2. Quan hệ với source Next.js hiện tại

Source web/admin hiện tại dùng Next.js `16.2.10` App Router và React `19.2.7`. Flutter không thay thế hoặc biên dịch lại source Next.js:

- Next.js tiếp tục phục vụ Web App và Admin Panel.
- Flutter là native client độc lập cho Android/iOS.
- Flutter không tái sử dụng React component, Next.js route hoặc Zustand/React Query.
- Phần dùng chung giữa Next.js và Flutter là Go backend, OpenAPI schema, DTO, permission code, quy ước error envelope và WebSocket event contract.
- Dart API client được sinh từ OpenAPI; không dịch thủ công TypeScript API client sang Dart.

Vì vậy roadmap Flutter dùng khái niệm parity với Next.js web, không phải chuyển đổi source Next.js sang Flutter.

## 3. Nguyên tắc bắt buộc

- Không viết URL API rải rác trong widget/repository; dùng Dart API client sinh từ OpenAPI hoặc wrapper thống nhất.
- Không sao chép TypeScript DTO thủ công nếu có thể sinh từ contract.
- Access token giữ trong memory; refresh token dùng `flutter_secure_storage`/Keychain/Keystore.
- Dữ liệu luôn scope theo `workspace_id`, `channel_id`, `user_id`.
- UI gate theo permission code, backend vẫn là lớp kiểm tra cuối.
- WebSocket chỉ phân phối event; REST/local database là nguồn để phục hồi trạng thái.
- Message retry phải có idempotency key.
- Push payload không chứa token/secret và tuân thủ tùy chọn ẩn preview.
- Không log nội dung message, Authorization header, refresh token hoặc URL có access token.
- Mọi phase phải chạy `flutter analyze`, unit/widget test và không thêm mock vào flavor production.

## 4. Stack đề xuất

| Thành phần | Lựa chọn |
|---|---|
| Flutter/Dart | Flutter stable, Dart stable đi kèm |
| State management | Riverpod |
| Navigation | `go_router` |
| REST | Client sinh từ OpenAPI + Dio transport/interceptor |
| Realtime | `web_socket_channel` |
| Secure storage | `flutter_secure_storage` |
| Local database | Drift + SQLite |
| Immutable/model | Code generation phù hợp contract, hạn chế model trùng |
| Push | Firebase Messaging; APNs qua Firebase cho iOS |
| Local notification | `flutter_local_notifications` |
| File/image | `file_picker`, `image_picker` |
| Voice | `record`, `just_audio` |
| Connectivity | `connectivity_plus` kết hợp request thực tế, không chỉ tin trạng thái mạng |
| Crash report | Provider có redaction; không gửi nội dung chat |

## 5. Cấu trúc source đề xuất

```text
mobile/
├── android/
├── ios/
├── assets/
├── integration_test/
├── lib/
│   ├── main.dart
│   ├── app/
│   │   ├── bootstrap.dart
│   │   ├── router.dart
│   │   └── theme/
│   ├── core/
│   │   ├── api/
│   │   ├── auth/
│   │   ├── database/
│   │   ├── error/
│   │   ├── realtime/
│   │   ├── security/
│   │   ├── sync/
│   │   └── telemetry/
│   └── features/
│       ├── auth/
│       ├── workspace/
│       ├── conversations/
│       ├── channels/
│       ├── messages/
│       ├── files/
│       ├── notifications/
│       ├── profile/
│       ├── departments/
│       ├── bots/
│       ├── automation/
│       ├── tickets/
│       └── settings/
├── test/
└── pubspec.yaml
```

Mỗi feature chia `data`, `domain`, `application` và `presentation` ở mức vừa đủ; không tạo abstraction hình thức nếu feature nhỏ.

## 6. Phạm vi chức năng hoàn chỉnh

| Nhóm | Chức năng phải có |
|---|---|
| Auth | Login email/username, Google khi cấu hình, refresh, logout, remember login, session list/revoke |
| Workspace/RBAC | Chọn workspace, permission gate, membership, chuyển workspace, profile |
| Conversation | DM, channel public/private/group, unread, favorite, search, read state |
| Message | Text, markdown, emoji, mention, reaction, reply, thread, pin, forward, edit, recall/delete |
| Media | Camera, gallery, file, paste/share intent, voice record/play, video, preview/download |
| Realtime | Message, typing, reaction, pin, update/delete, notification, presence, reconnect/catch-up |
| Notification | FCM/APNs, local notification, badge, deep link, mark read, preference, mute/quiet hours |
| Offline | Cache đọc, draft, outbox, upload queue, retry/idempotency, migration/eviction |
| Phòng ban | Cây, chi tiết, member và channel liên kết theo permission |
| Bot | Bot workspace, session riêng, CSKH/order tra ví/gia hạn/QR theo quyền |
| Automation | Danh sách, CRUD, run-now, pause/resume, lịch sử, webhook theo permission |
| Ticket | Lifecycle đầy đủ sau khi backend ticket domain/API thật hoàn thành |
| Native | Deep link/universal link, share intent, biometric app lock, camera/mic permission, background lifecycle |
| Accessibility | Font scaling, screen reader, contrast, touch target, reduced motion |

## 7. Bảng phase tổng quan

| Phase | Tên | Kết quả bàn giao | Điều kiện chuyển phase |
|---|---|---|---|
| M0 | Contract và mobile readiness | API gap list, generated client, ADR | Contract mobile được khóa |
| M1 | Flutter foundation | App flavors, theme, router, DI/state, CI nền | Analyze/test/build Android pass |
| M2 | Auth và secure session | Login/refresh/logout/session | Token được lưu an toàn |
| M3 | Workspace, RBAC và profile | Chọn workspace/hồ sơ/settings | Data scope và permission đúng |
| M4 | Conversation và channel | Danh sách DM/channel, unread/search | Điều hướng mobile hoàn chỉnh |
| M5 | Message và realtime | Chat nâng cao, typing/presence/reconnect | Hai thiết bị nhận event đúng |
| M6 | Camera, file, voice và video | Media flow hoàn chỉnh | Upload/record/play/download pass |
| M7 | Push, background và deep link | FCM/APNs, badge, notification preference | Push mở đúng message |
| M8 | Offline, sync và reliability | Cache/outbox/idempotency | Mạng yếu không mất/trùng dữ liệu |
| M9 | Module nghiệp vụ đầy đủ | Phòng ban, bot, automation, ticket | Không còn placeholder thuộc scope |
| M10 | Native UX, accessibility và performance | Biometric/share/accessibility/tối ưu | Đạt quality gate thiết bị thật |
| M11 | Test, security và release Android | Internal/closed production rollout | Android production ready |
| M12 | iOS hardening và release | TestFlight/App Store | iOS production ready |

## Phase M0: Contract và backend mobile readiness

| Task | Công việc | Phụ thuộc | Kết quả/Acceptance | Ưu tiên |
|---|---|---|---|---|
| M0.1 | Lập ma trận parity web → mobile | Không | Mọi chức năng có phase/owner | P0 |
| M0.2 | Đối chiếu OpenAPI với route Go | Không | Không thiếu endpoint mobile cần | P0 |
| M0.3 | Hoàn thiện schema/error/meta/event | M0.2 | Dart generator đọc được contract không lỗi | P0 |
| M0.4 | Sinh Dart client tự động | M0.3 | Model/request/response không viết tay trùng lặp | P0 |
| M0.5 | Contract test trong CI | M0.3 | Route/schema lệch làm CI fail | P0 |
| M0.6 | Thiết kế device registration API | M0.2 | Register/update/unregister token và platform | P0 |
| M0.7 | Thiết kế notification preference API | M0.6 | all/mention/mute/quiet hours/preview policy | P0 |
| M0.8 | Thiết kế message idempotency | M0.2 | Retry cùng client ID chỉ tạo một message | P0 |
| M0.9 | Thiết kế sync/catch-up cursor | M0.2 | Phục hồi sau background/offline dài | P0 |
| M0.10 | Chốt Android-first và device matrix | Không | Danh sách Android/iOS version hỗ trợ | P0 |
| M0.11 | Chốt privacy/data retention | Không | Cache/push/crash log có policy rõ | P0 |

Điều kiện hoàn thành M0: generated client build được, API push/idempotency/sync có contract và không còn endpoint giả định.

## Phase M1: Flutter foundation và design system

| Task | Công việc | Phụ thuộc | Kết quả/Acceptance | Ưu tiên |
|---|---|---|---|---|
| M1.1 | Scaffold Flutter app | M0 | Android/iOS project và package ID ổn định | P0 |
| M1.2 | Tạo flavors dev/staging/prod | M1.1 | Base URL không hard-code và không trỏ localhost ở prod | P0 |
| M1.3 | Theme sáng/tối VPSTTT | M1.1 | Token màu, typography, spacing, component nền | P0 |
| M1.4 | Router và auth guard | M1.1 | Deep route chuẩn bị từ đầu | P0 |
| M1.5 | Riverpod provider architecture | M1.1 | Scope provider rõ, không global mutable state tùy tiện | P0 |
| M1.6 | API interceptor/error mapper | M0.4 | Envelope, 401 refresh, request ID và lỗi tiếng Việt | P0 |
| M1.7 | Local database foundation | M1.1 | Drift schema/version/migration test | P0 |
| M1.8 | Logging có redaction | M1.1 | Không log token/message/file path nhạy cảm | P0 |
| M1.9 | Widget loading/empty/error/toast | M1.3 | Trạng thái dùng nhất quán toàn app | P0 |
| M1.10 | CI nền | M1.1 | format/analyze/test/build APK chạy tự động | P0 |

## Phase M2: Auth, secure session và app lock

| Task | Công việc | Phụ thuộc | Kết quả/Acceptance | Ưu tiên |
|---|---|---|---|---|
| M2.1 | Secure token repository | M1 | Refresh token trong Keystore/Keychain; access token memory | P0 |
| M2.2 | Login email/username | M2.1 | Error/rate-limit/loading đúng | P0 |
| M2.3 | Refresh queue | M2.1 | Nhiều request 401 chỉ refresh một lần | P0 |
| M2.4 | Logout và clear local state | M2.2 | Token/cache nhạy cảm/outbox theo policy được xử lý | P0 |
| M2.5 | Google Sign-In | Backend/provider config | OAuth native và backend exchange an toàn | P1 |
| M2.6 | Session list/revoke | M2.2 | Thu hồi thiết bị hiện tại làm app logout | P0 |
| M2.7 | Device identity | M2.2 | Device ID ổn định, không dùng hardware identifier nhạy cảm | P0 |
| M2.8 | Biometric/PIN app lock tùy chọn | M2.1 | Không thay thế backend auth; chỉ bảo vệ app cục bộ | P1 |
| M2.9 | Background screenshot privacy | M2.8 | App switcher có thể che nội dung nhạy cảm | P1 |

## Phase M3: Workspace, RBAC, profile và settings

| Task | Công việc | Phụ thuộc | Kết quả/Acceptance | Ưu tiên |
|---|---|---|---|---|
| M3.1 | List/select workspace | M2 | Khôi phục workspace cuối nếu membership còn hợp lệ | P0 |
| M3.2 | Permission repository | M3.1 | Gate bằng code từ `/rbac/me` | P0 |
| M3.3 | Workspace switch isolation | M3.1 | Cache/database/query không lẫn tenant | P0 |
| M3.4 | Profile view/update | M2 | Display name, phone, avatar dùng API thật | P0 |
| M3.5 | Avatar camera/gallery/upload | M3.4 | Crop/compress/permission/error đầy đủ | P0 |
| M3.6 | Theme/language/notification settings | M1/M7 | Lưu local và sync preference khi có API | P0 |
| M3.7 | Privacy/session screen | M2.6 | Revoke và logout-all có confirm | P0 |
| M3.8 | Permission denied UX | M3.2 | 403 không biến thành lỗi hệ thống chung | P0 |

## Phase M4: Hội thoại, channel và mobile navigation

| Task | Công việc | Phụ thuộc | Kết quả/Acceptance | Ưu tiên |
|---|---|---|---|---|
| M4.1 | Conversation list screen | M3 | DM/channel preview, time, unread, avatar/status | P0 |
| M4.2 | Tabs tất cả/chưa đọc/yêu thích | M4.1 | Filter đồng bộ read/favorite state | P0 |
| M4.3 | Search conversation/user/channel | M4.1 | Debounce, empty/error và permission đúng | P0 |
| M4.4 | Direct conversation create/open | M3.2 | Không tạo DM duplicate | P0 |
| M4.5 | Channel public/private/group list | M3.2 | Chỉ hiển thị channel user được phép | P0 |
| M4.6 | Create/join/invite/request channel | M3.2 | Mutation và approval flow đầy đủ | P0 |
| M4.7 | Channel details/member | M4.5 | Member/pin/media/file/settings trong màn riêng/bottom sheet | P0 |
| M4.8 | Read state/unread badge | M4.1 | Mở/scroll đọc cập nhật đúng API | P0 |
| M4.9 | Mobile navigation state | M4.1 | Back gesture/system back không mất draft | P0 |
| M4.10 | Tablet adaptive layout | M4.1 | Tablet có list-detail, phone dùng từng màn | P1 |

## Phase M5: Tin nhắn và realtime

| Task | Công việc | Phụ thuộc | Kết quả/Acceptance | Ưu tiên |
|---|---|---|---|---|
| M5.1 | Cursor timeline và reverse list | M4 | Load cũ không nhảy scroll | P0 |
| M5.2 | Composer text/markdown/emoji/mention | M5.1 | Draft, keyboard, safe area và limit đúng | P0 |
| M5.3 | Edit/delete/recall | M5.2 | Permission/owner đúng, UI cập nhật realtime | P0 |
| M5.4 | Reaction picker và summary | M5.2 | Add/remove/count không trùng | P0 |
| M5.5 | Reply/thread | M5.2 | Thread screen có pagination/composer riêng | P0 |
| M5.6 | Pin/unpin | M5.2 | Pin list và event realtime đúng | P0 |
| M5.7 | Forward | M5.2 | Chọn đích, membership và attachment đúng | P0 |
| M5.8 | Message search/filter | M5.1 | Date/sender/type/channel và jump-to-message | P0 |
| M5.9 | WebSocket manager | M2/M3 | Auth, join/leave, backoff, lifecycle | P0 |
| M5.10 | Realtime event reducer | M5.9 | Create/update/delete/reaction/pin/notification merge idempotent | P0 |
| M5.11 | Typing/presence | M5.9 | Throttle/timeout/background behavior đúng | P0 |
| M5.12 | Foreground catch-up | M5.9/M0.9 | Quay lại app không bỏ sót tin | P0 |

## Phase M6: Ảnh, file, camera, voice và video

| Task | Công việc | Phụ thuộc | Kết quả/Acceptance | Ưu tiên |
|---|---|---|---|---|
| M6.1 | Camera/gallery picker | M5 | Permission denied/permanently denied có hướng dẫn | P0 |
| M6.2 | File picker | M5 | MIME/size validation trước upload | P0 |
| M6.3 | Image resize/compress/EXIF policy | M6.1 | Giảm dung lượng và xử lý orientation/privacy | P1 |
| M6.4 | Upload queue/progress | M6.1-M6.2 | Multiple upload, cancel, retry, background state | P0 |
| M6.5 | Attach file vào message | M6.4 | Message/attachment liên kết đúng API | P0 |
| M6.6 | Image gallery/viewer | M6.5 | Zoom, swipe, save/share theo permission | P0 |
| M6.7 | File download/open/share | M6.5 | Scoped storage và MIME intent đúng | P0 |
| M6.8 | Voice recorder | M5 | Hold/tap record, timer, cancel, preview trước gửi | P0 |
| M6.9 | Voice player | M6.8 | Play/pause/seek/speed/progress; một audio cùng lúc | P0 |
| M6.10 | Video player | M6.5 | Streaming/download/error/fullscreen cơ bản | P1 |
| M6.11 | Share intent vào WebTui | M6.2 | Nhận ảnh/file/text từ app khác và chọn conversation | P1 |
| M6.12 | File security state | Backend scan API | Scanning/quarantine không cho mở file nguy hiểm | P1 |

## Phase M7: Native push, background và deep link

| Task | Công việc | Phụ thuộc | Kết quả/Acceptance | Ưu tiên |
|---|---|---|---|---|
| M7.1 | Firebase project/flavor config | M1 | Dev/staging/prod tách project/token | P0 |
| M7.2 | Register/update/unregister push token | M0.6/M2 | Token refresh và logout xử lý đúng | P0 |
| M7.3 | Backend notification worker FCM/APNs | M0.6 | Retry/DLQ/idempotency và delivery log | P0 |
| M7.4 | Foreground local notification | M7.2 | Không hiển thị trùng khi đang mở đúng channel | P0 |
| M7.5 | Background/terminated notification | M7.3 | Nhận được khi app nền/bị kill theo OS policy | P0 |
| M7.6 | Badge count | M7.3 | Đồng bộ unread khi mark read/all read | P0 |
| M7.7 | Deep link/universal link/app link | M1/M4 | Mở đúng workspace/channel/message | P0 |
| M7.8 | Notification preference/mute | M0.7 | all/mention/mute/quiet hours/preview | P0 |
| M7.9 | Sensitive preview policy | M7.8 | Màn hình khóa ẩn nội dung theo setting | P0 |
| M7.10 | Duplicate suppression | M7.3-M7.4 | Một event không sinh hai notification | P0 |

## Phase M8: Offline, sync và reliability

| Task | Công việc | Phụ thuộc | Kết quả/Acceptance | Ưu tiên |
|---|---|---|---|---|
| M8.1 | Cache workspace/conversation/message | M1/M5 | App mở offline xem dữ liệu gần nhất | P0 |
| M8.2 | Cache migration/versioning | M8.1 | Upgrade app không mất/crash database | P0 |
| M8.3 | Draft per conversation | M4/M5 | Draft qua restart và workspace switch đúng | P0 |
| M8.4 | Message outbox | M0.8/M5 | Pending/failed/sent có trạng thái rõ | P0 |
| M8.5 | Idempotent retry | M8.4 | Retry nhiều lần chỉ có một message server | P0 |
| M8.6 | Attachment outbox | M6/M8.4 | File retry độc lập, không nhân attachment | P0 |
| M8.7 | Reconnect sync/catch-up | M0.9/M5 | Không bỏ event sau offline/background | P0 |
| M8.8 | Conflict policy | M8.7 | Edit/delete/read state có quy tắc server-wins rõ | P1 |
| M8.9 | Cache eviction/storage settings | M8.1 | Giới hạn dung lượng, clear cache không xóa outbox/draft | P1 |
| M8.10 | Network quality UX | M8.4 | Banner offline/reconnecting và retry minh bạch | P0 |

## Phase M9: Module nghiệp vụ đầy đủ

| Task | Công việc | Phụ thuộc | Kết quả/Acceptance | Ưu tiên |
|---|---|---|---|---|
| M9.1 | Phòng ban | M3 | Cây, chi tiết, member, channel liên kết theo permission | P0 |
| M9.2 | Bot workspace | M3 | Danh sách, trạng thái, session riêng | P0 |
| M9.3 | Bot CSKH/order tra ví | M9.2 | Dữ liệu API thật, lỗi rõ, không lộ thông tin chéo user | P0 |
| M9.4 | Bot gia hạn | M9.2 | Danh sách sắp hết hạn và yêu cầu gia hạn | P0 |
| M9.5 | Bot thanh toán | M9.2 | QR nạp ví/đơn hàng hiển thị native và lưu/chia sẻ theo policy | P0 |
| M9.6 | Automation list/detail | M3 | Status, next run và history | P0 |
| M9.7 | Automation CRUD/run/pause | M9.6 | Permission gate và API mutation đầy đủ | P0 |
| M9.8 | Webhook/API token screens theo quyền | M9.6 | Secret không lưu cache/log trái policy | P1 |
| M9.9 | Ticket lifecycle | Backend ticket API | Tạo/phân công/trạng thái/comment/attachment/notification | P0 trước final parity |
| M9.10 | Announcement/system message | Backend producer | Hiển thị/acknowledge theo contract | P1 |
| M9.11 | Admin external link | M3.2 | Chỉ admin thấy link mở Admin Panel browser | P1 |

## Phase M10: Native UX, accessibility và performance

| Task | Công việc | Phụ thuộc | Kết quả/Acceptance | Ưu tiên |
|---|---|---|---|---|
| M10.1 | Android/iOS permission UX | M6/M7 | Camera/mic/photo/notification có rationale và settings link | P0 |
| M10.2 | Keyboard/safe area/rotation | M4-M6 | Composer không bị che, tablet/landscape dùng được | P0 |
| M10.3 | Accessibility semantics | M1 | TalkBack/VoiceOver đọc đúng message/action/status | P0 |
| M10.4 | Dynamic font/touch target/contrast | M1 | Không vỡ layout ở font lớn | P0 |
| M10.5 | Reduced motion | M1 | Animation tuân thủ setting hệ điều hành | P1 |
| M10.6 | Timeline virtualization/performance | M5 | Cuộn channel lớn mượt trên thiết bị tầm trung | P0 |
| M10.7 | Image/memory optimization | M6 | Không OOM khi mở gallery/channel nhiều ảnh | P0 |
| M10.8 | Battery/background optimization | M5/M7 | Không giữ WebSocket/heartbeat trái lifecycle | P0 |
| M10.9 | Localization | M1 | Tiếng Việt hoàn chỉnh, sẵn đường thêm ngôn ngữ | P1 |
| M10.10 | App update/version gate | Backend version API | Cảnh báo/bắt buộc update khi contract không tương thích | P0 |

## Phase M11: Test, security và Android release

| Task | Công việc | Phụ thuộc | Kết quả/Acceptance | Ưu tiên |
|---|---|---|---|---|
| M11.1 | Unit test domain/repository | M2-M9 | Auth, reducer, sync, outbox, permission được test | P0 |
| M11.2 | Widget/golden test | M1-M10 | Login/list/timeline/composer/error/theme pass | P0 |
| M11.3 | Integration E2E | M2-M9 | Login → chat → file → voice → push → deep link pass | P0 |
| M11.4 | Realtime multi-device test | M5 | Create/update/delete/reaction/read/presence đúng | P0 |
| M11.5 | Offline/network chaos test | M8 | Airplane mode, timeout, token expiry, process death pass | P0 |
| M11.6 | Security test | M2/M7/M8 | Token/cache/log/deep link/push payload được audit | P0 |
| M11.7 | Device matrix Android | M10 | OS/version/screen/device tầm thấp-trung-cao | P0 |
| M11.8 | Workflow `mobile.yml` | M1 | analyze/test/build/sign/upload artifact | P0 |
| M11.9 | Firebase App Distribution | M11.8 | Nhóm nội bộ dùng tối thiểu một chu kỳ | P0 |
| M11.10 | Play Internal/Closed testing | M11.9 | Crash/ANR/auth/realtime metric đạt ngưỡng | P0 |
| M11.11 | Play production staged rollout | M11.10 | Rollout theo phần trăm và có khả năng dừng | P0 |

## Phase M12: iOS hardening và release

| Task | Công việc | Phụ thuộc | Kết quả/Acceptance | Ưu tiên |
|---|---|---|---|---|
| M12.1 | Bundle/signing/provisioning | M11 | Build signed trên macOS runner | P0 |
| M12.2 | APNs/Firebase push | M7 | Foreground/background/terminated pass trên thiết bị thật | P0 |
| M12.3 | Universal Links | M7 | Link đã xác minh domain mở đúng app/message | P0 |
| M12.4 | Keychain/biometric/privacy screen | M2/M10 | Security behavior đúng iOS | P0 |
| M12.5 | Camera/mic/photo/file UX | M6 | Permission và picker đúng iOS | P0 |
| M12.6 | Background/lifecycle test | M5/M7/M8 | Resume/catch-up không trùng/mất message | P0 |
| M12.7 | Privacy manifest/Store metadata | M10 | Khai báo data/permission đúng thực tế | P0 |
| M12.8 | TestFlight internal/external | M12.1-M12.7 | Nhóm test xác nhận parity | P0 |
| M12.9 | App Store submission/rollout | M12.8 | Release có monitoring và rollback version plan | P0 |

## 8. Backend backlog bắt buộc cho bản đầy đủ

| ID | Backend/API cần bổ sung | Lý do |
|---|---|---|
| MB-1 | `push_devices` và device register/update/delete API | FCM/APNs token lifecycle |
| MB-2 | Notification preference/mute/quiet hours | Push đúng lựa chọn và privacy |
| MB-3 | FCM/APNs worker, retry và delivery log | Push production ổn định |
| MB-4 | `Idempotency-Key`/`client_message_id` | Offline retry không tạo tin trùng |
| MB-5 | Sync/event cursor hoặc catch-up contract | Phục hồi sau background/offline |
| MB-6 | Minimum supported client version | Mobile release chậm hơn backend |
| MB-7 | Ticket domain/API thật | Xóa placeholder và đạt full parity |
| MB-8 | Upload resume/chunk nếu file lớn | Mạng mobile yếu và process interruption |
| MB-9 | Notification target chuẩn | Deep link workspace/channel/message ổn định |
| MB-10 | Account deletion/export policy nếu public store yêu cầu | Tuân thủ store/privacy policy |

## 9. CI/CD đề xuất

Tạo `.github/workflows/mobile.yml` gồm:

1. Checkout và setup Flutter stable có version pin.
2. `flutter pub get`, format check, analyze và unit/widget test.
3. Sinh Dart client/model và fail nếu diff chưa commit.
4. Build APK debug cho pull request.
5. Build signed AAB cho staging/release bằng GitHub Environment secrets.
6. Chạy integration test trên emulator/device farm theo lịch.
7. Phân phối Firebase App Distribution hoặc Play Internal.
8. macOS job riêng build/sign IPA và upload TestFlight.

## 10. Release checklist chung

- [ ] Không có mock/fallback dữ liệu mẫu trong flavor production.
- [ ] Refresh token chỉ nằm trong secure storage.
- [ ] Cache/outbox không lẫn workspace hoặc user.
- [ ] Session revoke làm thiết bị logout.
- [ ] Permission UI và lỗi 403 hoạt động đúng.
- [ ] Realtime/reconnect/catch-up không mất hoặc trùng message.
- [ ] Tin pending retry bằng idempotency key.
- [ ] Camera/file/voice/video pass trên thiết bị thật.
- [ ] Push foreground/background/terminated và deep link pass.
- [ ] Nội dung nhạy cảm có thể ẩn trên lock screen/app switcher.
- [ ] TalkBack/VoiceOver, font lớn và touch target đạt yêu cầu.
- [ ] Crash report/log không chứa token hoặc nội dung chat.
- [ ] Store privacy/permission declaration đúng thực tế.
- [ ] Có tài liệu hỗ trợ đăng nhập, notification, microphone, cache và logout.

## 11. Ước lượng

Với hai lập trình viên Flutter và một backend hỗ trợ bán thời gian:

| Mốc | Thời gian dự kiến |
|---|---:|
| M0-M2 foundation/auth | 3–4 tuần |
| M3-M5 workspace/chat/realtime | 4–5 tuần |
| M6-M8 media/push/offline | 4–5 tuần |
| M9-M10 module đầy đủ/hardening | 3–4 tuần, chưa tính ticket backend |
| M11 Android release | 2 tuần |
| M12 iOS release | 2–3 tuần |

Android MVP nội bộ nên được phát hành sau M8. Production “đầy đủ toàn bộ chức năng” chỉ đạt khi M9-M12 và các backend backlog P0 hoàn thành.

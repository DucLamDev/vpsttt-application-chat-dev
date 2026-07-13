# Kế hoạch triển khai Desktop App Tauri cho WebTui Chat

Tài liệu này chia việc triển khai Desktop App thành các phase và task có thể đưa thẳng vào backlog. Mục tiêu cuối là đạt đầy đủ chức năng người dùng của WebTui Chat trên Windows, macOS và Linux, dùng hoàn toàn API thật, WebSocket thật và dữ liệu production/staging; không mock nghiệp vụ trong bản phát hành.

## 1. Mục tiêu

- Giữ nguyên Next.js App Router hiện tại, đồng thời tái sử dụng TypeScript, React component, design system, typed API client và nghiệp vụ client của `frontend/apps/web`.
- Chạy như ứng dụng desktop native bằng Tauri, không tải giao diện production từ một website bên ngoài.
- Có đăng nhập, session, workspace, chat, channel, direct message, file, ảnh, voice, notification, bot, automation, phòng ban và cài đặt cá nhân đầy đủ.
- Có system tray, deep link, native notification, secure token storage, file picker/save, microphone và auto update.
- Hoạt động ổn định khi mất mạng, chuyển mạng, sleep/wake và cập nhật phiên bản.
- Tôn trọng RBAC từ backend; user thường không thấy hoặc không gọi được chức năng quản trị.

Admin Panel tiếp tục là ứng dụng web riêng. Desktop chỉ mở liên kết Admin Panel cho tài khoản có quyền; không trộn bundle quản trị vào ứng dụng chat người dùng.

## 2. Nghiệm chứng stack source hiện tại

Source hiện tại **không phải React SPA thuần**:

- `frontend/apps/web/package.json` dùng Next.js `16.2.10`, React `19.2.7` và script `next dev`, `next build`, `next start`.
- `frontend/apps/admin/package.json` cũng dùng Next.js App Router với cùng phiên bản Next.js/React.
- Cả hai app đều có `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/providers.tsx` và `src/app/globals.css`, đúng cấu trúc App Router.
- `frontend/apps/web` hiện chưa có `next.config.*` và chưa bật `output: "export"`; đây là hạng mục phải triển khai và kiểm thử ở D0/D2, không phải khả năng đã có sẵn.
- React là thư viện render nằm dưới Next.js; nhắc tới React chỉ có nghĩa tái sử dụng component/hook, không có nghĩa chuyển source sang Vite hoặc React SPA.

Quyết định cho Desktop:

- Không chuyển `apps/web` sang Vite.
- Không tạo một UI React mới trong `apps/desktop`.
- Development: Tauri trỏ `devUrl` tới Next.js dev server của `apps/web`.
- Production: chạy Next.js static export có điều kiện, sau đó Tauri đóng gói thư mục `out` vào app.
- Không chạy `next start` hoặc nhúng Node.js server bên trong installer.
- Các tính năng cần Next.js server runtime/API routes không được thêm vào desktop bundle; client tiếp tục gọi Go API qua HTTPS/WSS.

Luồng build dự kiến:

```text
Development
Tauri -> http://localhost:3000 -> Next.js dev server

Production
TAURI_BUILD=1 -> next build (output: export) -> apps/web/out
-> Tauri frontendDist -> signed desktop installer
```

## 3. Nguyên tắc bắt buộc

- REST base URL production: `https://api.vpsttt.com`.
- WebSocket production: `wss://api.vpsttt.com/api/v1/ws`.
- Mọi request đi qua `packages/api-client`; component không tự gọi URL backend.
- Access token giữ trong memory; refresh token lưu bằng OS keychain hoặc Tauri Stronghold.
- Không ghi token, API key, nội dung nhạy cảm hoặc URL WebSocket chứa token vào log.
- Tauri capability theo allowlist tối thiểu; không bật shell/filesystem toàn cục.
- Không dùng role name để gate UI; luôn dùng permission từ API RBAC.
- Không phát hành auto update nếu artifact chưa được ký.
- Mỗi mutation có loading, success, error và chống thao tác lặp.
- Không coi WebSocket là nguồn dữ liệu bền vững; reconnect phải đồng bộ lại bằng REST.

## 4. Kiến trúc source đề xuất

```text
frontend/
├── apps/
│   ├── web/
│   ├── admin/
│   └── desktop/
│       ├── package.json
│       └── src-tauri/
│           ├── capabilities/
│           ├── icons/
│           ├── src/
│           │   ├── commands/
│           │   ├── deep_link.rs
│           │   ├── tray.rs
│           │   └── lib.rs
│           ├── Cargo.toml
│           └── tauri.conf.json
└── packages/
    ├── api-client/
    ├── chat-core/
    ├── platform/
    │   ├── contracts/
    │   ├── browser/
    │   └── tauri/
    ├── types/
    └── ui/
```

`apps/desktop` chỉ chứa native host và cấu hình Tauri. UI entrypoint vẫn là Next.js `apps/web`. `chat-core` chứa hook, mapper và use case client có thể dùng trong Next.js nhưng không phụ thuộc DOM; `platform` cung cấp adapter cho storage, notification, file, clipboard, voice, link và lifecycle.

## 5. Phạm vi chức năng hoàn chỉnh

| Nhóm | Chức năng phải có |
|---|---|
| Auth | Login email/username, Google khi backend cấu hình, refresh, logout, remember login, quản lý và thu hồi session |
| Workspace | Chọn workspace, quyền RBAC, thông tin workspace, chuyển workspace, trạng thái membership |
| Cá nhân | Hồ sơ, avatar, số điện thoại, theme, quyền riêng tư, phiên đăng nhập |
| Hội thoại | Direct message, channel public/private, nhóm, yêu thích, chưa đọc, tìm kiếm, read state |
| Tin nhắn | Text, markdown, emoji, reaction, reply, thread, forward, pin, edit, delete/recall, mention |
| Media | Ảnh, file, paste, drag/drop, voice record/play, video player, preview/download |
| Realtime | Message event, typing, reaction, pin, delete/update, notification, presence, reconnect |
| Notification | In-app, native desktop, badge, deep link, mark read/all read, preference/mute |
| Phòng ban | Cây phòng ban, thành viên, kênh liên kết theo đúng permission |
| Bot | Danh sách bot, bot session, CSKH/order actions và kết quả QR theo đúng quyền |
| Automation | Danh sách job, tạo/sửa/xóa, run-now, pause/resume, lịch sử chạy, webhook được cấp quyền |
| Ticket | Chỉ hoàn thành khi backend ticket domain/API thật đã có; không giữ placeholder trong bản final |
| Native | Tray, single instance, deep link, auto start tùy chọn, updater, file association phù hợp |
| Resilience | Offline cache đọc, outbox, retry, idempotency, sleep/wake, proxy và network change |

## 6. Bảng phase tổng quan

| Phase | Tên | Kết quả bàn giao | Điều kiện chuyển phase |
|---|---|---|---|
| D0 | Contract và phạm vi | API/client gap list, ADR và backlog | Contract cần cho desktop được khóa |
| D1 | Tách platform khỏi web | `chat-core` và platform contracts | Web vẫn build/test thành công |
| D2 | Tauri foundation | App mở được trên Windows với CSP/capability đúng | Dev/build Tauri chạy ổn định |
| D3 | Auth, session và workspace | Đăng nhập/khôi phục phiên/chọn workspace | Token không nằm trong localStorage |
| D4 | Shell, channel và hội thoại | Điều hướng đầy đủ | Mở đúng conversation/channel |
| D5 | Message và realtime | Chat nâng cao và reconnect | Hai desktop nhận event đúng |
| D6 | File, ảnh, voice và video | Media flow native hoàn chỉnh | Upload/download/record/play pass |
| D7 | Notification và desktop UX | Tray, badge, deep link, native notification | Click notification mở đúng tin |
| D8 | Module nghiệp vụ mở rộng | Phòng ban, bot, automation, ticket | Không còn màn placeholder thuộc scope |
| D9 | Offline và hardening | Cache/outbox/retry/performance | Mạng yếu không mất hoặc trùng tin |
| D10 | Packaging và updater | Installer ba hệ điều hành | Artifact được ký và update được |
| D11 | Test, observability và release | CI/CD, E2E, crash report, runbook | Đạt release checklist |

## Phase D0: Contract, audit và quyết định kiến trúc

| Task | Công việc | Phụ thuộc | Kết quả/Acceptance | Ưu tiên |
|---|---|---|---|---|
| D0.1 | Lập ma trận parity web → desktop | Không | Mọi chức năng trong bảng phạm vi có owner và phase | P0 |
| D0.2 | Đối chiếu OpenAPI với route Go và TypeScript client | Không | Không thiếu endpoint app desktop sử dụng | P0 |
| D0.3 | Thêm contract test OpenAPI | D0.2 | CI fail khi schema/route quan trọng lệch | P0 |
| D0.4 | Chốt Windows-first, macOS/Linux tiếp theo | Không | ADR nền tảng và matrix hỗ trợ | P0 |
| D0.5 | Chốt static bundle, không remote URL | D0.4 | Production không phụ thuộc frontend server để render UI | P0 |
| D0.6 | Thiết kế `PlatformServices` | D0.1 | Interface cho auth storage, notify, file, voice, clipboard, link, lifecycle | P0 |
| D0.7 | Audit API còn thiếu cho native | D0.2 | Backlog device token, preference, idempotency, sync | P0 |
| D0.8 | Chốt CSP, origin và CORS strategy | D0.5 | API gọi được từ Tauri mà không mở CORS `*` | P0 |
| D0.9 | Chốt telemetry/privacy policy | Không | Không thu nội dung chat trong crash/analytics | P1 |
| D0.10 | Chạy proof-of-concept Next.js static export trên `apps/web` và audit server-only feature | D0.5 | Sinh được `apps/web/out`; auth/chat/realtime chạy mà không cần `next start` | P0 |

Điều kiện hoàn thành D0: có ADR được review, contract test chạy trong CI và không còn endpoint giả định.

## Phase D1: Refactor web thành core dùng chung

| Task | Công việc | Phụ thuộc | Kết quả/Acceptance | Ưu tiên |
|---|---|---|---|---|
| D1.1 | Tách `ChatWorkspace` theo feature | D0.6 | Shell, timeline, composer, panel, settings không còn trong một file khổng lồ | P0 |
| D1.2 | Tạo `packages/chat-core` | D1.1 | Mapper/use case/query key không import `window`/`document` | P0 |
| D1.3 | Tạo platform contracts | D0.6 | Browser và Tauri cùng implement một interface | P0 |
| D1.4 | Inject `fetcher` vào `HttpClient` | D0.8 | Dùng browser fetch hoặc Tauri HTTP plugin mà không sửa feature | P0 |
| D1.5 | Tách auth persistent storage | D1.3 | Zustand không gọi localStorage trực tiếp | P0 |
| D1.6 | Tách browser notification | D1.3 | Feature gọi `NotificationService`, không gọi `new Notification` | P0 |
| D1.7 | Tách media recorder/file save/clipboard | D1.3 | Web adapter giữ hành vi hiện tại; Tauri có điểm cắm native | P0 |
| D1.8 | Test regression web | D1.1-D1.7 | Web typecheck, lint, unit, build và E2E chat pass | P0 |

Điều kiện hoàn thành D1: web không suy giảm chức năng và platform-specific code chỉ nằm trong adapter.

## Phase D2: Tauri foundation và security baseline

| Task | Công việc | Phụ thuộc | Kết quả/Acceptance | Ưu tiên |
|---|---|---|---|---|
| D2.1 | Scaffold `apps/desktop` với Tauri stable | D1 | App dev mở được | P0 |
| D2.2 | Thêm Next.js desktop build có điều kiện (`TAURI_BUILD=1`, `output: "export"`) và cấu hình `frontendDist` tới `apps/web/out` | D2.1 | Web deploy bình thường vẫn dùng `next build/start`; installer chứa UI Next.js static nội bộ và không load remote page | P0 |
| D2.3 | Cấu hình dev URL và environment staging/prod | D2.1 | Không hard-code localhost trong production | P0 |
| D2.4 | Thiết lập capabilities tối thiểu | D2.1 | Chỉ bật HTTP, notification, dialog, fs scope, deep-link cần thiết | P0 |
| D2.5 | Thiết lập CSP | D2.2 | Chặn inline script/remote origin ngoài allowlist cần thiết | P0 |
| D2.6 | Cấu hình app identity, icon, version | D2.1 | Bundle ID ổn định trên ba OS | P1 |
| D2.7 | Chặn navigation ngoài app | D2.2 | Link ngoài mở bằng browser mặc định | P0 |
| D2.8 | Smoke test Windows | D2.1-D2.7 | App start/close/reopen không crash | P0 |

## Phase D3: Auth, secure session, workspace và hồ sơ

| Task | Công việc | Phụ thuộc | Kết quả/Acceptance | Ưu tiên |
|---|---|---|---|---|
| D3.1 | Implement secure token adapter | D2.4 | Refresh token ở keychain/Stronghold; access token memory | P0 |
| D3.2 | Login/refresh/logout | D3.1 | Restart app khôi phục phiên; logout xóa sạch token/cache | P0 |
| D3.3 | Google OAuth desktop redirect | D3.1 | Deep-link/callback an toàn khi provider được cấu hình | P1 |
| D3.4 | Session list/revoke/revoke-all | D3.2 | Thu hồi session desktop làm phiên mất hiệu lực | P0 |
| D3.5 | Workspace list/switch | D3.2 | Query cache scope đúng workspace | P0 |
| D3.6 | Load RBAC permission | D3.5 | Action ẩn/disabled và API vẫn chặn 403 | P0 |
| D3.7 | Hồ sơ/avatar/phone/theme/privacy | D3.2 | Lưu và đồng bộ qua API thật | P0 |
| D3.8 | Lock screen khi máy resume tùy policy | D3.1 | Có thể yêu cầu xác thực lại sau thời gian idle | P1 |

## Phase D4: App shell, hội thoại, channel và điều hướng

| Task | Công việc | Phụ thuộc | Kết quả/Acceptance | Ưu tiên |
|---|---|---|---|---|
| D4.1 | Desktop responsive shell | D3 | Rail/sidebar/timeline/panel hoạt động từ 1024px trở lên | P0 |
| D4.2 | Direct conversation list | D3.5 | Tạo/mở DM, preview, thời gian, unread đúng | P0 |
| D4.3 | Channel public/private/group | D3.6 | Danh sách và membership đúng permission | P0 |
| D4.4 | Chưa đọc/yêu thích/tìm kiếm conversation | D4.2-D4.3 | Bộ lọc cập nhật theo API/read state | P0 |
| D4.5 | Create/join/invite/request channel | D3.6 | Toàn bộ mutation có feedback và refetch đúng | P0 |
| D4.6 | Channel info/member/pinned/media/file tabs | D4.3 | Panel phải đầy đủ và có thể đóng/mở | P0 |
| D4.7 | URL/deep route nội bộ | D4.2 | Reload/reopen giữ đúng workspace/channel | P0 |
| D4.8 | Keyboard navigation và shortcut nền | D4.1 | Ctrl/Cmd+K, focus composer, đổi conversation | P1 |

## Phase D5: Message, realtime và tương tác nâng cao

| Task | Công việc | Phụ thuộc | Kết quả/Acceptance | Ưu tiên |
|---|---|---|---|---|
| D5.1 | Timeline cursor/infinite scroll | D4 | Load lịch sử không nhảy vị trí | P0 |
| D5.2 | Send text/markdown/emoji/mention | D5.1 | Nội dung render an toàn, giới hạn đúng backend | P0 |
| D5.3 | Edit/delete/recall | D5.2 | Owner/permission gate đúng | P0 |
| D5.4 | Reaction đầy đủ | D5.2 | Add/remove và realtime count không trùng | P0 |
| D5.5 | Reply/thread | D5.2 | Thread panel và composer độc lập | P0 |
| D5.6 | Pin/unpin và forward | D5.2 | Đích forward kiểm tra membership | P0 |
| D5.7 | Message search/filter/date/sender/type | D5.1 | Chỉ trả nội dung user có quyền xem | P0 |
| D5.8 | WebSocket lifecycle | D3.2 | Connect/join/leave/reconnect có backoff | P0 |
| D5.9 | Merge realtime cache | D5.8 | Create/update/delete/reaction/pin không nhân bản | P0 |
| D5.10 | Typing, read state và presence | D5.8 | Trạng thái tự hết hạn và đúng conversation | P0 |
| D5.11 | Sleep/wake/network change | D5.8 | Resume tự reconnect và REST catch-up | P0 |

## Phase D6: Ảnh, file, voice và video

| Task | Công việc | Phụ thuộc | Kết quả/Acceptance | Ưu tiên |
|---|---|---|---|---|
| D6.1 | Native file picker | D2.4 | Chọn nhiều file theo MIME/size policy | P0 |
| D6.2 | Drag/drop và clipboard ảnh | D6.1 | Preview trước gửi, không đọc path ngoài scope | P0 |
| D6.3 | Upload queue/progress/retry/remove | D6.1 | Mỗi file có trạng thái rõ; retry không gửi trùng message | P0 |
| D6.4 | Attachment preview | D6.3 | Ảnh/audio/video hiển thị trong timeline | P0 |
| D6.5 | Native save/download | D6.4 | Chọn nơi lưu, checksum/error được xử lý | P0 |
| D6.6 | Voice recording | D1.7 | Start/pause/stop/cancel, duration và waveform | P0 |
| D6.7 | Voice playback | D6.6 | Play/pause/seek/speed; chỉ một voice phát cùng lúc | P0 |
| D6.8 | Microphone permission UX | D6.6 | Denied có hướng dẫn mở OS settings | P0 |
| D6.9 | Large file/network interruption | D6.3 | Giữ trạng thái retry; không treo composer | P1 |
| D6.10 | File security state | D6.3 | Hiển thị scanning/quarantine khi backend hỗ trợ | P1 |

## Phase D7: Notification và trải nghiệm desktop native

| Task | Công việc | Phụ thuộc | Kết quả/Acceptance | Ưu tiên |
|---|---|---|---|---|
| D7.1 | In-app notification center | D5 | Badge, list, mark read/all read | P0 |
| D7.2 | Native notification adapter | D2.4 | App background nhận notification từ realtime/worker | P0 |
| D7.3 | Notification preference/mute | Backend preference API | All/mention/mute và preview privacy hoạt động | P0 |
| D7.4 | Deep link protocol `webtui://` | D2 | Mở đúng workspace/channel/message | P0 |
| D7.5 | Click native notification | D7.2-D7.4 | Focus cửa sổ và scroll đúng message | P0 |
| D7.6 | System tray | D2 | Show/hide, unread badge/menu, quit thật | P0 |
| D7.7 | Single instance | D7.4 | Mở link lần hai không tạo app instance mới | P0 |
| D7.8 | Auto start tùy chọn | D7.6 | Mặc định tắt; user bật/tắt được | P1 |
| D7.9 | Quiet hours/Do Not Disturb | D7.3 | Không phát native notification ngoài policy | P1 |

## Phase D8: Module nghiệp vụ đầy đủ

| Task | Công việc | Phụ thuộc | Kết quả/Acceptance | Ưu tiên |
|---|---|---|---|---|
| D8.1 | Phòng ban | D3.6 | Cây, chi tiết, thành viên và kênh liên kết theo quyền | P0 |
| D8.2 | Bot workspace | D3.6 | Danh sách, trạng thái, session và channel kết nối | P0 |
| D8.3 | Bot CSKH/order tra ví | D8.2 | Kết quả API thật, lỗi 4xx/5xx rõ ràng | P0 |
| D8.4 | Bot gia hạn | D8.2 | Thống kê sắp hết hạn và yêu cầu gia hạn | P0 |
| D8.5 | Bot thanh toán | D8.2 | QR nạp ví/đơn hàng hiển thị ảnh và metadata gọn | P0 |
| D8.6 | Automation CRUD/run/history | D3.6 | Tạo/sửa/xóa/pause/run-now dùng API thật | P0 |
| D8.7 | Webhook/API token view theo permission | D8.6 | Secret không bị log hoặc hiện lại trái policy | P1 |
| D8.8 | Ticket domain và UI | Backend ticket API | Không còn placeholder; lifecycle ticket đầy đủ | P0 trước final parity |
| D8.9 | Announcement/system message | Backend producer | Hiển thị, acknowledge nếu contract yêu cầu | P1 |
| D8.10 | Admin deep link | D3.6 | Chỉ user có `admin.view` mới thấy link mở Admin Panel browser | P1 |

## Phase D9: Offline, reliability và performance

| Task | Công việc | Phụ thuộc | Kết quả/Acceptance | Ưu tiên |
|---|---|---|---|---|
| D9.1 | Local cache schema | D5 | Cache workspace/channel/message gần nhất, có version migration | P0 |
| D9.2 | Offline read mode | D9.1 | Mở app mất mạng vẫn xem dữ liệu cache có nhãn offline | P0 |
| D9.3 | Message outbox | Backend idempotency | Tin chờ gửi tồn tại qua restart | P0 |
| D9.4 | Idempotent retry | D9.3 | Retry nhiều lần chỉ tạo một message | P0 |
| D9.5 | Sync/catch-up | D5.11 | Không bỏ sót event sau offline dài | P0 |
| D9.6 | Cache eviction | D9.1 | Giới hạn dung lượng, không xóa draft/outbox | P1 |
| D9.7 | Draft per conversation | D4 | Draft tồn tại qua chuyển channel/restart | P1 |
| D9.8 | Startup optimization | D9.1 | Shell hiển thị nhanh, query chạy theo nhu cầu | P1 |
| D9.9 | Timeline virtualization | D5.1 | Channel lớn vẫn cuộn mượt | P1 |
| D9.10 | Proxy/corporate network test | D5.8 | REST/WSS hoạt động hoặc báo cấu hình rõ | P1 |

## Phase D10: Packaging, signing và auto update

| Task | Công việc | Phụ thuộc | Kết quả/Acceptance | Ưu tiên |
|---|---|---|---|---|
| D10.1 | Windows MSI/NSIS | D2-D9 | Cài/nâng cấp/gỡ sạch, giữ dữ liệu người dùng cần thiết | P0 |
| D10.2 | Windows code signing | D10.1 | Installer/executable có chữ ký hợp lệ | P0 |
| D10.3 | macOS universal build/sign/notarize | D9 | DMG chạy trên Intel/Apple Silicon | P1 |
| D10.4 | Linux AppImage/deb | D9 | Chạy trên distro mục tiêu | P1 |
| D10.5 | Signed updater | D10.1 | Chỉ cài manifest/artifact hợp lệ | P0 |
| D10.6 | Stable/beta channel | D10.5 | Chuyển channel có kiểm soát | P1 |
| D10.7 | Rollback/runbook | D10.5 | Có hướng xử lý update lỗi mà không mất local data | P0 |
| D10.8 | Version compatibility | Backend version policy | App chặn/nhắc update khi API không còn tương thích | P0 |

## Phase D11: Test, CI/CD, observability và release

| Task | Công việc | Phụ thuộc | Kết quả/Acceptance | Ưu tiên |
|---|---|---|---|---|
| D11.1 | Unit test chat-core/platform | D1 | Mapper, storage, retry, deep-link parser được test | P0 |
| D11.2 | Rust unit test | D2 | Command/capability/deep-link/tray logic được test | P0 |
| D11.3 | Desktop E2E Windows | D3-D9 | Login → chat → file → voice → notification pass | P0 |
| D11.4 | Cross-platform smoke test | D10 | Start/login/update trên OS matrix | P0 |
| D11.5 | Security test | D10 | Không lộ token/log; CSP/capability được audit | P0 |
| D11.6 | Crash reporting có redaction | D9 | Không gửi nội dung message/token/file | P1 |
| D11.7 | Workflow `desktop.yml` | D10 | fmt/clippy/test/build/sign/artifact tự động | P0 |
| D11.8 | Staging release | D11.1-D11.7 | Nhóm nội bộ dùng tối thiểu một chu kỳ | P0 |
| D11.9 | Production rollout theo phần trăm | D11.8 | Có metric crash/update/auth/realtime | P0 |

## 7. Backend backlog bắt buộc cho bản đầy đủ

| ID | Backend/API cần bổ sung | Lý do |
|---|---|---|
| DB-D1 | `Idempotency-Key` hoặc `client_message_id` unique | Chống gửi trùng khi retry/offline |
| DB-D2 | Device registration | Nhận dạng installation desktop và policy notification |
| DB-D3 | Notification preference/mute/quiet hours | Native notification đúng lựa chọn người dùng |
| DB-D4 | Sync cursor/event catch-up | Đồng bộ sau sleep/offline dài |
| DB-D5 | Minimum supported client version | Buộc update khi contract không tương thích |
| DB-D6 | Ticket domain/API thật | Hoàn thành module ticket thay placeholder |
| DB-D7 | Upload retry/resume nếu hỗ trợ file lớn | Mạng yếu không phải tải lại toàn bộ |

## 8. CI/CD đề xuất

Tạo `.github/workflows/desktop.yml` gồm:

1. Checkout, Node setup, Rust stable setup và cache.
2. `npm ci`, typecheck, lint, unit test, build Next.js web bình thường và build Next.js static export dành cho Tauri.
3. `cargo fmt --check`, `cargo clippy -- -D warnings`, `cargo test`.
4. Matrix build `windows-latest`, `macos-latest`, `ubuntu-latest`.
5. Ký artifact bằng GitHub Secrets/environment protection.
6. Upload artifact cho staging hoặc tạo GitHub Release khi tag.
7. Sinh signed updater manifest.

## 9. Release checklist

- [ ] Không có mock/fallback dữ liệu mẫu trong production.
- [ ] Desktop UI được sinh từ Next.js `apps/web/out`, không có React/Vite app thứ hai.
- [ ] Build web production bình thường không bị đổi sang static export ngoài ý muốn.
- [ ] Refresh token không nằm trong localStorage hoặc file plain text.
- [ ] User thường không truy cập module quản trị.
- [ ] Hai máy nhận realtime create/update/delete/reaction/pin đúng.
- [ ] Sleep/wake và mất mạng không làm mất hoặc trùng message.
- [ ] Upload ảnh/file, voice record/play và download pass.
- [ ] Native notification/deep link mở đúng message.
- [ ] Tray/quit/single-instance hoạt động đúng trên OS mục tiêu.
- [ ] Installer và updater đều có chữ ký.
- [ ] Log/crash report không chứa token hoặc nội dung chat.
- [ ] Backup/restore local cache migration được test.
- [ ] Tài liệu cài đặt, update, rollback và hỗ trợ người dùng đã có.

## 10. Ước lượng

Với hai lập trình viên có kinh nghiệm Next.js/Tauri:

| Mốc | Thời gian dự kiến |
|---|---:|
| D0-D2 foundation | 2–3 tuần |
| D3-D7 desktop MVP đầy đủ chat/native | 4–6 tuần |
| D8 module nghiệp vụ | 2–3 tuần, chưa tính ticket backend |
| D9 hardening/offline | 2–3 tuần |
| D10-D11 release ba OS | 2–3 tuần |

Windows production là mốc đầu; macOS/Linux phát hành sau khi Windows staging ổn định.

# Frontend Implementation Status

## Cập nhật luồng chat ngày 2026-07-10

- Web chat đã đổi hướng sang Zalo-like cho tin nhắn 1-1: tìm bạn bè qua `/api/v1/users?q=...`, gửi lời mời qua `/api/v1/contact-requests`, người nhận đồng ý rồi mới mở direct conversation.
- Contacts page gộp dữ liệu từ `contacts`, `contactRequests`, workspace members và search results; có nút gửi lời mời, đồng ý, từ chối, hủy lời mời và nhắn tin.
- Sidebar chat ưu tiên `Hội thoại` trước, `Kênh & bot` sau. Đã bỏ UI chọn member để tạo hội thoại thủ công vì luồng này bypass kết bạn.
- Backend direct conversation đã kiểm contact accepted và tự đảm bảo người bạn accepted có workspace membership `workspace_member`; frontend không cần gọi `addMember` trước khi mở DM.
- Message timeline đã có `isMine` để căn phải tin của người đang đăng nhập, giúp bubble chat gần Zalo hơn. Composer dark mode giữ chữ rõ trên nền input.
- Tin ghim đã nối API thật và realtime invalidation: list/pin/unpin message dùng `messagesClient`, panel phải hiển thị dữ liệu từ `/pins`.
- WebSocket browser dùng query `access_token`; khi nhận message event, frontend invalidate timeline/sidebar direct conversations/channels/notifications để UI cập nhật nhanh hơn.
- WebSocket backend tự đưa socket vào phòng cá nhân `user:{userId}`; contact request publish event `ContactRequestCreated/Updated/Cancelled`, frontend invalidate contacts và hiển thị lời mời trong popup thông báo.
- Admin/RBAC đã bổ sung permission `user.manage`; `workspace_owner` bị gỡ `admin.view`, route update/delete user backend kiểm `user.manage` theo `workspace_id`.

### Kiểm tra gần nhất

- `npm.cmd run typecheck --workspace @webtui/web`
- `npm.cmd run typecheck --workspace @webtui/admin`
- Chưa chạy được Go compile/gofmt trên máy này vì `go` và `gofmt` không có trong PATH.

## Cập nhật UI app shell ngày 2026-07-09

- Login/register đã chuyển sang layout nền xanh công nghệ giống mockup ảnh số 2, vẫn dùng callback auth hiện có và không thêm OAuth giả.
- Web sidebar đã có màn riêng cho `Tin nhắn`, `Bạn bè`, `Kênh`, `Ticket`, `File`, `Bot`, `Automation`, `Cài đặt`; thông báo mở bằng popup ở đầu panel chat thay vì nằm trên sidebar.
- Mục `Bạn bè` lấy dữ liệu từ `contacts`, `contactRequests`, search user toàn hệ thống và một phần workspace members để gợi ý. Nút `Nhắn tin` chỉ mở DM khi quan hệ bạn bè đã được đồng ý.
- Không thêm dữ liệu áp cứng cho các trang mới; dữ liệu hiển thị lấy từ API production hoặc loading/empty/error state.
- Kiểm tra đã chạy: `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run build:web`.

## Cập nhật polish chat và deploy ngày 2026-07-09

- Sidebar web đã bỏ `Công việc` và không còn tab `Thông báo`; thông báo mở bằng popup ở đầu panel `Kênh & Hội thoại`, dùng API notification/presence hiện có và giữ badge chưa đọc realtime/polling theo hook.
- `Bạn bè` tìm user global qua `GET /api/v1/users?q=...&status=active`, không chỉ lọc workspace members. Khi người nhận đồng ý kết bạn, backend tự đảm bảo membership cần thiết trước khi tạo direct conversation.
- Backend đã bổ sung `users.phone_number`, trả `phone_number` trong user/member DTO và cho `/api/v1/users?q=` tìm theo email, username, display name hoặc số điện thoại đã chuẩn hóa chữ số.
- Composer web hỗ trợ emoji nhanh, gửi ảnh, gửi file và ghi âm giọng nói bằng MediaRecorder rồi đưa vào upload queue hiện có; typing indicator dùng ba chấm animation.
- Login/register dùng header logo/tên `WEBTUI CHAT` có animation nằm ngoài form, form gọn để tránh scroll ở viewport 100%.
- Deploy frontend production dùng image `WEBTUI_WEB_IMAGE`, compose service `web`, Nginx proxy `FRONTEND_DOMAIN=chat.vpsttt.com` về `web:3000`, Dockerfile web nhận `NEXT_PUBLIC_API_BASE_URL=https://api.vpsttt.com` và `NEXT_PUBLIC_WS_URL=wss://api.vpsttt.com/api/v1/ws` lúc build.

Tài liệu này dùng khi tiếp tục triển khai frontend theo `docs/planning/frontend-roadmap.md`.

## Phase đã hoàn thành

| Phase | Trạng thái | Tài liệu bàn giao |
|---|---|---|
| F0 | Hoàn thành | `docs/planning/frontend-phase-f0.md` |
| F1 | Hoàn thành | `docs/planning/frontend-phase-f1.md` |
| F2 | Hoàn thành | `docs/planning/frontend-phase-f2.md` |

## Quyết định đã khóa

- Package manager hiện tại: npm workspaces.
- REST base URL mặc định: `https://api.vpsttt.com`.
- WebSocket endpoint mặc định: `wss://api.vpsttt.com/api/v1/ws`.
- Không dùng backend `localhost` cho frontend MVP/production nếu user không yêu cầu riêng.
- UI copy tiếng Việt phải có dấu. Code identifier, route và env giữ theo chuẩn kỹ thuật.
- WebSocket browser mặc định dùng query `?access_token=...`; subprotocol `["webtui.jwt", accessToken]` chỉ là fallback cấu hình.
- Component không gọi API trực tiếp; mọi request đi qua `@webtui/api-client`.

## Scaffold hiện có

```text
frontend/
├── apps/
│   ├── admin/
│   └── web/
├── packages/
│   ├── api-client/
│   ├── config/
│   ├── icons/
│   ├── types/
│   └── ui/
└── .env.example
```

## Kiểm tra F1 đã xanh

- `npm.cmd install`
- `npm.cmd run typecheck`
- `npm.cmd run lint`
- `npm.cmd run build:web`
- `npm.cmd run build:admin`

## Cập nhật F11/F12 ngày 2026-07-09

### Rà soát F9/F10

- F9/F10 không còn gap P0 chặn admin phase. Upload queue, attachment query riêng, notification dropdown, mark read/read-all và presence heartbeat vẫn giữ nguyên contract API thật.
- Lưu ý tiếp tục cho các phase sau: backend `MessageDTO` chưa hydrate attachment, nên mọi màn cần attachment vẫn phải gọi endpoint `/attachments` hoặc chờ backend bổ sung hydrate chính thức.

### Phase đã hoàn thành thêm

| Phase | Trạng thái | Bàn giao |
|---|---|---|
| F11 | Hoàn thành P0/P1 chính | Admin guard `admin.view`, stats/health, user table/update status, workspace members, role/RBAC, assign/revoke role, audit log |
| F12 | Hoàn thành P0/P1 chính | API scopes/tokens, revoke token, incoming/outgoing webhook, one-time secret display, delivery logs, bot create/install/send test |

### Ghi chú F11

- `useAdminDashboardData` là điểm gom duy nhất cho admin data và mutation; component không gọi API trực tiếp.
- Admin dashboard tiếp tục gate màn chính bằng `admin.view`; các thao tác nhạy cảm dùng permission riêng: `workspace.manage`, `role.manage`, `audit.view`.
- User list lấy từ `/api/v1/users`; thao tác khóa/mở khóa qua `users.update` cần `workspace_id` và backend kiểm permission `user.manage`.
- Workspace member list, thêm member và cập nhật trạng thái dùng `/workspaces/{workspace_id}/members`.
- RBAC dùng `/rbac/permissions`, `/rbac/roles`, `/members/{user_id}/roles` để tạo role, gán role và gỡ role.
- Audit log dùng `/workspaces/{workspace_id}/audit-logs`; nếu thiếu `audit.view`, UI hiển thị permission notice thay vì dữ liệu giả.

### Ghi chú F12

- `packages/types` có thêm DTO typed cho API token, bot, bot installation/message, incoming/outgoing webhook và delivery log.
- `packages/api-client` không còn dùng `ModuleRecord` cho F12 chính; token/bot/webhook client trả type cụ thể.
- API token UI dùng scope thật từ `/api-scopes`; token secret chỉ hiển thị sau mutation tạo token.
- Incoming webhook UI tạo webhook theo channel tùy chọn, hiển thị URL và secret one-time từ backend.
- Outgoing webhook UI tạo target URL, nhập event types theo backend/outbox đang dùng và đọc delivery logs theo webhook được chọn.
- Bot UI tạo bot, cài bot vào kênh và gửi tin test qua API thật.

### Hướng phase sau

- F13 nên tái sử dụng pattern F12 cho cronjob/backup: query typed, form mutation, bảng run history, permission notice theo `cronjob.manage` và `backup.manage`.
- Nên tách `AdminDashboard` thành các file section riêng trước khi F13 mở rộng để tránh component quá lớn: `overview-section`, `users-section`, `roles-section`, `integrations-section`, `bots-section`.
- Backend user admin API đã được harden bước đầu bằng permission `user.manage`; các phase sau chỉ cần mở rộng test/coverage cho rule này.

## Cập nhật F13/F14 ngày 2026-07-09

### Rà soát F11/F12

- F11/F12 đã đủ P0/P1 chính để tiếp tục: admin data, RBAC, audit, token, webhook, bot và delivery đều đi qua API thật, không dùng dữ liệu mẫu.
- Gap còn lại là nợ kiến trúc: `AdminDashboard` đang gom nhiều section trong một file lớn; lần mở rộng tiếp theo nên tách file section trước khi tăng thêm màn.

### Phase đã hoàn thành thêm

| Phase | Trạng thái | Bàn giao |
|---|---|---|
| F13 | Hoàn thành P0 chính | Typed operations DTO/client, cronjob list/create/update/delete/run/history, backup job create/run/history |
| F14 | Hoàn thành hardening bước đầu | Loading/empty/error/permission state cho operations, responsive mobile admin/web, bảng operations cuộn ngang an toàn |

### Ghi chú F13

- Cronjob UI dùng permission `cronjob.manage`; payload form phải parse thành JSON object trước khi gọi backend.
- Backup UI dùng permission `backup.manage`; frontend chỉ hỗ trợ tạo và chạy thủ công vì backend hiện chưa có update/delete backup job.
- Query key operations được tách theo workspace và selected job để invalidation run history rõ ràng.

### Ghi chú F14

- Admin breakpoint mobile chuyển navigation rail thành hàng ngang, tránh ép màn thành nhiều cột trên viewport hẹp.
- Web chat breakpoint nhỏ hơn giữ composer đủ nút, ẩn chip phụ trong input và chuyển rail ngang trên mobile.
- Empty state vẫn là lựa chọn bắt buộc khi backend chưa trả pinned/media/file/operation data; không thêm dữ liệu áp cứng.

### Hướng phase sau

- F15 nên ưu tiên test: type/lint/build tiếp tục giữ, thêm component tests cho operations form và E2E admin smoke.
- Nên refactor admin sections trước khi thêm màn production mới để giữ Clean Architecture dễ bảo trì.

## Cập nhật F15 ngày 2026-07-09

### Phase đã hoàn thành thêm

| Phase | Trạng thái | Bàn giao |
|---|---|---|
| F15 | Hoàn thành P0/P1 chính | Vitest setup, API/permission/message-cache/component tests, Playwright smoke specs, CI frontend đầy đủ, Dockerfile web/admin, release checklist |

### Ghi chú F15

- Root frontend có script `test`, `test:unit`, `test:unit:watch`, `test:e2e`.
- Unit tests nằm trong `frontend/tests/unit` và component smoke test nằm trong `frontend/tests/component`.
- E2E smoke specs nằm trong `frontend/tests/e2e`; mặc định skip nếu chưa có `E2E_RUN=true` và credentials.
- `PermissionGate` đã có component smoke test; permission logic dùng helper chung `createPermissionSet` và `hasPermission`.
- Message cache reducer đã tách sang `apps/web/src/features/chat/model/message-cache.ts` để test dedupe/replace/remove không kéo React hook vào test.
- CI frontend chạy `typecheck`, `lint`, `test:unit`, `build:web`, `build:admin`.
- Dockerfile web/admin dùng build context `frontend`; build lệnh nằm trong `docs/deploy/frontend-release.md`.
- Local Docker daemon hiện chưa chạy hoặc chưa kết nối được pipe `docker_engine`, nên Docker image chưa được build thử ở máy này.
- Sau khi cài dependency test, `npm audit` báo 2 cảnh báo moderate; chưa chạy `npm audit fix --force` để tránh nâng major không kiểm soát.

### Hướng phase sau

- Khi có tài khoản staging ổn định, bật E2E thật bằng `E2E_RUN=true` và đưa job Playwright vào CI theo lịch hoặc workflow thủ công.
- Nên tiếp tục tách `AdminDashboard` thành các section file riêng trước khi mở rộng test component sâu hơn cho operations form.

### Kiểm tra gần nhất

- `npm.cmd run typecheck`
- `npm.cmd run lint`
- `npm.cmd run build:web`
- `npm.cmd run build:admin`

## Cập nhật F9/F10 ngày 2026-07-09

### Phase đã hoàn thành thêm

| Phase | Trạng thái | Bàn giao |
|---|---|---|
| F9 | Hoàn thành P0/P1 chính | File DTO/attachment contract, upload queue nhiều file, retry/remove, attach từng file vào message, download attachment và file panel |
| F10 | Hoàn thành P0/P1 chính | Notification typed client, dropdown thông báo, mark read/read-all, presence client, heartbeat loop, avatar status từ API |

### Rà soát F7/F8

- F7/F8 không còn gap P0 trước khi làm F9/F10. Timeline REST, optimistic message, edit/delete/reaction, thread/search và realtime join/merge cache vẫn giữ nguyên.
- F8 còn backlog P1 về refresh token chủ động cho WebSocket khi token hết hạn giữa phiên dài; hiện refresh HTTP vẫn xử lý request REST, WebSocket reconnect dùng access token hiện có trong auth store.
- Không thêm dữ liệu mẫu vào chat shell. Tin ghim vẫn empty state vì backend chưa có endpoint pin chuyên biệt.

### Ghi chú F9

- `filesClient.attachments` và `filesClient.attach` đã sửa đúng contract backend: response là attachment có `file` lồng bên trong, không phải `FileObject` phẳng.
- `FileObject` type đã bổ sung `byte_size`, `owner_id`, `checksum_sha256`, `status`; mapper file ưu tiên `byte_size` từ backend Go.
- Upload trong composer dùng Zustand `useUploadStore`, hỗ trợ nhiều file, trạng thái `queued/uploading/attached/failed`, remove và retry file lỗi.
- Gửi message tạo tin nhắn trước, sau đó upload từng file và attach vào message. Nếu file lỗi, tin nhắn không bị rollback; file lỗi ở lại queue để user thử lại.
- Timeline hiển thị toàn bộ attachment từ API và có action download blob trực tiếp bằng `file_id`.
- Backend `MessageDTO` hiện chưa hydrate attachment, nên `useMessageTimeline` gọi `/attachments` theo các message đang load và invalidate query này sau khi attach file.
- Panel phải vẫn dùng `/files` thật cho recent files và media grid; chưa dựng file version UI vì F9.9 là P2.

### Ghi chú F10

- `notificationsClient` trả `Notification[]` typed, hỗ trợ `listMine({ workspace_id, limit })`, `markRead`, `markAllRead({ workspace_id })`.
- `presenceClient` hỗ trợ `list(workspaceId)` và `heartbeat(workspaceId, input)` theo route Go `/workspaces/{workspace_id}/presence`.
- `useNotificationPresence` gom notification query, presence query, heartbeat mỗi 30 giây, visibility `away`, cleanup `offline` khi unmount và cache presence theo user.
- Chat header có badge unread; dropdown thông báo dùng dữ liệu API, click notification mark read và mở channel/message nếu backend trả `channel_id/message_id`.
- Direct conversation/member avatar status lấy từ presence API; `away` được map sang trạng thái UI `busy`.

### Hướng phase sau

- F11 nên ưu tiên admin guard `admin.view`, dashboard stats/health/users/RBAC/audit bằng API thật, tiếp tục giữ component không gọi API trực tiếp.
- Nếu cần polish trước F11, F14 backlog nên thêm responsive drawer cho right panel và upload queue compact trên mobile.
- Cần bổ sung test cache/mutation cho upload queue, notification mark read và heartbeat ở F15.

### Kiểm tra gần nhất

- `npm.cmd run typecheck`
- `npm.cmd run lint`
- `npm.cmd run build:web`
- `npm.cmd run build:admin`

`npm install` hiện báo 2 lỗ hổng mức moderate. Không tự chạy `npm audit fix --force` vì có thể tạo breaking change ngoài phạm vi phase.

Ghi chú F2: PostCSS config hiện export object rỗng. Chỉ bật Tailwind plugin khi bắt đầu dùng directive Tailwind thật sự; bật sớm có thể làm Turbopack dev server lỗi module `@tailwindcss/postcss` trong workspace.

## Hướng làm tốt hơn cho F2

F2 đã hoàn thành. Khi chỉnh tiếp UI shell, không đưa dữ liệu mẫu trở lại `page.tsx`; dữ liệu phải đi qua data source/hook và component nhận props.

## Hướng làm tốt hơn cho F3

- Giữ `HttpClient` hiện có làm nền, nhưng bổ sung `post`, `patch`, `delete`, upload multipart, download blob và refresh queue.
- Tách `RuntimeEnvironment` khỏi component; chỉ đọc env tại adapter/config.
- Tạo DTO mapper theo từng module thay vì để component nhận trực tiếp response backend.
- Tạo `RealtimeGateway` cùng package `@webtui/api-client`, nhưng hook merge cache đặt trong feature.
- Thay `chat-workspace-source.ts` và `dashboard-source.ts` bằng TanStack Query hook gọi API sau khi auth/session có token.
- Giữ component F2; chỉ thay data adapter để tránh quay lại UI đóng cứng.

## Cập nhật ngày 2026-07-08

### Phase đã hoàn thành thêm

| Phase | Trạng thái | Bàn giao |
|---|---|---|
| F3 | Hoàn thành | `packages/api-client`, `packages/types`, module clients, query keys, realtime gateway base |
| F4 | Hoàn thành | Auth provider/store, login/register/logout, session restore, protected app shell web/admin |

### Ghi chú F3

- `HttpClient` hiện hỗ trợ REST method chính, bearer token, refresh queue, envelope unwrap, typed error, multipart upload và blob download.
- Auth contract đã được sửa đúng với backend Go: login/register/refresh trả token trong `data.tokens.*`; store vẫn chịu được fallback token phẳng nếu backend thay đổi.
- Module clients đã bám route Go cho auth, users, workspaces, channels, messages, files, RBAC, admin, notifications, API tokens, webhooks, bots, cronjobs và backups.
- `RealtimeGateway` đang là nền kết nối. Phase F8 cần thêm room join/leave, reconnect, socket state và merge cache.

### Ghi chú F4

- Web/admin dùng `@tanstack/react-query` cho server state và Zustand cho auth session.
- Không còn source snapshot dữ liệu mẫu trong web/admin. UI hiện chỉ hiển thị dữ liệu từ API hoặc empty/loading/error state.
- Web chat hiện gọi API thật cho workspace, channel, message, direct conversation, file list, send message, upload/attach/download file.
- Admin dashboard hiện gọi API thật cho workspace, stats, health, settings và users. Biểu đồ/ranking chỉ hiển thị khi backend trả dữ liệu tương ứng.

### Hướng phase sau

- F5 đã đưa permission từ `/api/v1/rbac/me` vào `can(permission)` và `PermissionGate`.
- F6 đã tách query/mutation khỏi component lớn thành hooks/use-case theo feature.
- Không đưa lại dữ liệu mẫu vào UI production. Nếu backend thiếu endpoint, dùng empty state và ghi backlog backend.
- Ưu tiên kiểm tra thực tế với tài khoản có workspace và quyền `admin.view` trên `https://api.vpsttt.com`.

### Kiểm tra gần nhất

- `npm.cmd run typecheck`
- `npm.cmd run lint`
- `npm.cmd run build:web`
- `npm.cmd run build:admin`

## Cập nhật F7/F8 ngày 2026-07-09

### Phase đã hoàn thành thêm

| Phase | Trạng thái | Bàn giao |
|---|---|---|
| F7 | Hoàn thành P0/P1 chính | `useMessageTimeline`, infinite cursor, optimistic sending, edit/delete/reaction, thread, search, read-state có last message |
| F8 | Hoàn thành P0 chính | `useChannelRealtime`, `useRealtimeStore`, join/leave room, reconnect backoff, cache merge/dedupe |

### Rà soát F0-F6

- Không phát hiện gap P0 chặn F7/F8. Các phần còn lại của F5/F6 là P1/P2: invite member, save workspace settings, stale-RBAC toast, update/archive channel và department grouping.
- UI chính vẫn không dùng dữ liệu mẫu nghiệp vụ. Tin ghim đã dùng API thật; các vùng backend chưa có endpoint riêng như media chuyên biệt vẫn dùng empty state.
- Base URL frontend tiếp tục mặc định `https://api.vpsttt.com`; không thêm localhost backend vào component.

### Ghi chú F7

- `messagesClient` có thêm `listPage`, `threadPage`, `searchPage` để giữ `meta.next_cursor` và `meta.has_more`.
- `useMessageTimeline` dùng `useInfiniteQuery` với cursor `before`, map DTO sang UI model, sort timeline theo thời gian tăng dần và chống trùng message.
- Gửi tin nhắn có optimistic local message, rollback khi lỗi và replace bằng message thật khi API trả về.
- Sửa, xóa, reaction gọi API thật và cập nhật cache. UI chỉ cho sửa/xóa nếu là owner hoặc có `message.manage`; backend vẫn kiểm quyền cuối cùng.
- Search tin nhắn gọi `/messages/search` khi từ khóa đủ dài; thread gọi `/messages/{message_id}/thread` theo yêu cầu.
- Read-state tự gửi `last_read_message_id` theo tin nhắn cuối đã load.

### Ghi chú F8

- `RealtimeGateway` có helper `send`, `join`, `leave`.
- `useChannelRealtime` kết nối bằng query token mặc định, join room `workspace:{workspaceId}:channel:{channelId}` khi socket mở và leave room khi đổi kênh/unmount.
- Reconnect dùng exponential backoff tối đa 15 giây.
- Cache timeline merge realtime cho `MessageCreated`, `MessageUpdated`, `ReactionChanged`; xóa khỏi cache cho `MessageDeleted`.
- Zustand `useRealtimeStore` giữ `status`, `room`, `retryAttempt`, `lastEventAt`; UI hiển thị trạng thái realtime trên toolbar.

### Hướng phase sau

- F9: nâng upload kèm message hiện tại thành upload queue có progress, retry/remove, preview attachment trong timeline và download action ngay trên message.
- F10: nối notification dropdown, mark read/all read và presence heartbeat/avatar status.
- F14: cân nhắc route alias đẹp hơn cho workspace/channel và responsive drawer cho thread/detail panel.

### Kiểm tra gần nhất

- `npm.cmd run typecheck`
- `npm.cmd run lint`
- `npm.cmd run build:web`
- `npm.cmd run build:admin`

## Cập nhật F5/F6 ngày 2026-07-08

### Phase đã hoàn thành thêm

| Phase | Trạng thái | Bàn giao |
|---|---|---|
| F5 | Hoàn thành P0 | `useWorkspaceContext`, workspace switcher, workspace detail query, permission query, `can(permission)`, `PermissionGate`, member/settings query |
| F6 | Hoàn thành P0/P1 chính | `useChatWorkspaceData`, channel/direct sidebar từ API, URL state workspace/channel, tạo kênh, tạo hội thoại riêng, read-state, message/file mutations |

### Rà soát F3/F4

- F3/F8 đã cập nhật WebSocket browser auth: `RealtimeGateway` mặc định dùng query `access_token`; subprotocol chỉ còn là fallback cấu hình `authMode: "subprotocol"`.
- F4 không còn dữ liệu snapshot trong màn hình chính; auth/session, restore, refresh và protected shell vẫn giữ nguyên.
- Base URL production vẫn là `https://api.vpsttt.com`; không có endpoint localhost trong component.

### Ghi chú F5

- Web app và admin đều chọn workspace bằng URL query `workspace`, tự chọn workspace đầu tiên từ API khi URL chưa có giá trị.
- Hook workspace gọi `listMine`, `get`, `members`, `settings` và RBAC `myPermissions`; component chỉ nhận dữ liệu đã map từ hook.
- Action nhạy cảm đang gate bằng permission: tạo kênh `channel.create`, gửi tin `message.send`, upload file `file.upload`, admin dashboard `admin.view`.
- Invite member, lưu workspace settings và stale-RBAC toast khi bị 403 là P1, chưa nhồi vào màn hình chat để tránh vượt scope.

### Ghi chú F6

- Channel list, direct conversations, messages, tin ghim, recent files và media grid đều lấy từ API. Khi backend chưa có media chuyên biệt, panel phải hiển thị empty state thay vì số liệu mẫu.
- Form tạo kênh thật đã có validate name/slug cơ bản và gọi `/workspaces/{workspace_id}/channels`.
- Tạo hội thoại riêng dùng member list từ workspace và gọi `/workspaces/{workspace_id}/direct-conversations`.
- Gửi tin nhắn gọi `/messages`; nếu có file thì upload `/files` rồi attach bằng `/channels/{channel_id}/messages/{message_id}/attachments`.
- URL state hiện dùng query `workspace` và `channel` trên root app shell. Nếu cần deep route đẹp hơn ở F14/F15, có thể thêm route alias mà vẫn dùng chung hook hiện tại.

### Hướng phase sau

- F7 nên ưu tiên message timeline REST đầy đủ: infinite cursor, optimistic sending, retry, edit/delete, reaction, thread và mention suggest.
- F8 nên nối realtime bằng `RealtimeGateway`, thêm join/leave room, reconnect backoff, socket state store và cache merge dedupe.
- F9 nên tách upload queue có progress/retry; hiện F6 mới có luồng upload một file kèm message.

### Kiểm tra gần nhất

- `npm.cmd run typecheck`
- `npm.cmd run lint`
- `npm.cmd run build:web`
- `npm.cmd run build:admin`

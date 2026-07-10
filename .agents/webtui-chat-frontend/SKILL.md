---
name: webtui-chat-frontend
description: Hướng dẫn agent xây dựng, rà soát và mở rộng frontend WebTui Chat bằng Next.js App Router, shadcn/ui, TanStack Query và Zustand dựa trên backend Go + Gin, OpenAPI, REST/WebSocket, RBAC, file upload, admin APIs và theme giao diện chat nội bộ màu xanh-trắng như mockup. Dùng khi làm web app chat, admin panel, API client, realtime, upload file, notification, bot/webhook/cronjob/backup UI, hoặc khi đánh giá frontend theo Clean Architecture.
---

# WebTui Chat Frontend

## Cập nhật luồng Zalo/Discord ngày 2026-07-10

- Luồng mặc định của web chat là Zalo-like: tìm người dùng qua email/tên/số điện thoại, gửi lời mời kết bạn, người nhận đồng ý rồi mới mở hội thoại riêng 1-1.
- Tạo kênh, bot, webhook và automation là luồng riêng kiểu Discord; không bắt người dùng tạo kênh để nhắn tin 1-1.
- Backend có `contact_requests` và API `/api/v1/contacts`, `/api/v1/contact-requests`; UI phải dùng trạng thái `pending/accepted/rejected/cancelled` để hiện nút `Gửi lời mời`, `Đồng ý`, `Từ chối`, `Hủy lời mời`, `Nhắn tin`.
- Direct conversation backend tự kiểm quan hệ bạn bè `accepted`; nếu đủ điều kiện, backend tự đảm bảo participants là workspace members với role `workspace_member` trước khi tạo direct channel. Frontend không gọi `addMember` như bước bắt buộc của DM nữa.
- Sidebar chat ưu tiên `Hội thoại` trước, `Kênh & bot` sau. Empty state hội thoại phải hướng người dùng sang `Bạn bè`, không nói lỗi backend.
- Message bubble dùng `isMine` để căn phải mọi tin của người đang đăng nhập, không chỉ optimistic `local-*`.
- Tin ghim dùng API thật: `GET /pins`, `POST /messages/{message_id}/pin`, `DELETE /messages/{message_id}/pin`; WebSocket invalidates pins khi nhận `MessagePinned/MessageUnpinned`.
- Browser WebSocket mặc định dùng query token `?access_token=...`; không dùng header Authorization trong native WebSocket.
- WebSocket có phòng cá nhân `user:{userId}` cho event như lời mời kết bạn; frontend phải invalidate `contacts/contactRequests/notifications` khi nhận `ContactRequestCreated`, `ContactRequestUpdated`, `ContactRequestCancelled`.
- RBAC admin đã harden thêm: `workspace_owner` không còn `admin.view`; thao tác quản lý user cần permission `user.manage`. Admin UI phải disable action khi thiếu `user.manage`.

## Cập nhật UI app shell ngày 2026-07-09

- `AuthScreen` trong `packages/ui` dùng layout nền xanh công nghệ, form sáng ở giữa, copy tiếng Việt có dấu và submit qua callback auth hiện có. Không thêm social login nếu backend chưa có endpoint OAuth.
- `AuthScreen` hiện đặt logo/tên `WEBTUI CHAT` ở header có animation, không đặt logo trong form; form phải nằm gọn trong viewport 100% và không tạo thanh cuộn.
- `apps/web` có rail item `Bạn bè`; tìm bạn bè dùng `GET /api/v1/users?q=...&status=active`, merge với contacts/contact requests và direct conversations. Không mở DM trước khi request accepted.
- Không còn rail item `Công việc`; thông báo không nằm ở sidebar mà mở bằng popup ở đầu panel `Kênh & Hội thoại`, dùng notification hook/API hiện có.
- Composer chat hỗ trợ emoji nhanh, ảnh, file, voice recording qua MediaRecorder và typing dots animation; tất cả file/voice/image phải đi qua upload queue + API upload/attach hiện có.
- Các mục sidebar web phải có màn riêng. Tin nhắn dùng chat shell; Kênh, File, Cài đặt dùng dữ liệu API hiện có; Ticket/Bot/Automation chỉ hiển thị empty/chờ API, không dựng dữ liệu mẫu.
- Hành động `Nhắn tin` trong danh bạ chỉ khả dụng khi hai người đã là bạn bè; gọi mutation tạo hội thoại riêng rồi chuyển về trang Tin nhắn với channel vừa tạo.
- Deploy web production dùng Docker image `WEBTUI_WEB_IMAGE`, domain `https://chat.vpsttt.com`, REST `https://api.vpsttt.com`, WebSocket `wss://api.vpsttt.com/api/v1/ws`.

Luôn thiết kế frontend như một ứng dụng vận hành nội bộ: nhanh, rõ trạng thái, giàu dữ liệu, ít trang trí thừa.

## Cập nhật F11/F12 ngày 2026-07-09

- Admin app đã mở rộng `useAdminDashboardData` thành hook/use-case chính cho stats, health, users, members, roles, audit, API tokens, bots và webhooks. Khi thêm màn admin mới, tiếp tục đưa query/mutation vào hook hoặc hook con, không gọi API trực tiếp trong component.
- F11 dùng permission `admin.view` cho màn quản trị chính; thao tác chuyên biệt cần permission riêng như `workspace.manage`, `role.manage`, `audit.view`.
- F12 đã có type cụ thể trong `packages/types/src/integration.ts`; không dùng `ModuleRecord` cho các luồng chính của API token, bot, incoming webhook, outgoing webhook và delivery log.
- Secret của API token và webhook chỉ hiển thị một lần sau mutation tạo mới. Không log secret, không lưu vào local storage, không dựng lại secret giả trong UI.
- F13 nên tách admin section thành file nhỏ trước khi thêm cronjob/backup, rồi tái sử dụng pattern typed client, query key, permission notice và table run history.

## Cập nhật F13/F14 ngày 2026-07-09

- Operations đã có type riêng trong `packages/types/src/operations.ts`; không dùng `ModuleRecord` cho cronjob, cronjob run, backup job hoặc backup run.
- Admin hook đã nối cronjob/backup bằng query/mutation thật. Màn Cronjob phải gate `cronjob.manage`, validate payload là JSON object, hỗ trợ create/update status/delete/run/history.
- Màn Backup phải gate `backup.manage`, hỗ trợ create/run/history. Không dựng UI update/delete backup nếu backend chưa có endpoint.
- F14 đã có baseline responsive cho admin và web chat: rail chuyển ngang trên mobile, bảng operations cuộn ngang, loading/empty/error/permission state rõ ràng.
- Phase tiếp theo nên tách `AdminDashboard` thành các section file riêng trước khi thêm test/E2E hoặc màn production mới.

## Cập nhật F15 ngày 2026-07-09

- Test setup chuẩn hiện là Vitest ở `frontend/vitest.config.ts`; chạy `npm.cmd test` hoặc `npm.cmd run test:unit` trong thư mục `frontend`.
- Playwright smoke specs ở `frontend/tests/e2e` mặc định skip nếu chưa đặt `E2E_RUN=true`; không ép CI phụ thuộc tài khoản production.
- Permission logic dùng helper chung `createPermissionSet` và `hasPermission` từ `@webtui/types`; không viết lại logic wildcard trong hook mới.
- Message cache pure helpers nằm ở `apps/web/src/features/chat/model/message-cache.ts`; test reducer/cache nên import file này thay vì import React hook.
- Dockerfile web/admin dùng build context là thư mục `frontend`: `docker build -f apps/web/Dockerfile ... .` và `docker build -f apps/admin/Dockerfile ... .`.
- Không chạy `npm audit fix --force` nếu chưa có yêu cầu riêng, vì lệnh này có thể nâng major dependency và làm lệch build.

## Quy trình bắt buộc

1. Đọc `frontend/ARCHITECTURE.md` trước khi tạo cấu trúc app, feature, API client hoặc state.
2. Đọc `references/backend-api-map.md` khi cần gọi API, sinh DTO, hook TanStack Query, mock data hoặc test contract.
3. Đọc `references/frontend-clean-architecture.md` khi cần thêm feature, route, package, state store hoặc review kiến trúc.
4. Đọc `references/ui-theme.md` khi dựng layout, component, màu sắc, spacing hoặc màn hình giống mockup ảnh số 3.
5. Đọc `references/frontend-implementation-status.md` trước khi tiếp tục phase mới để không làm lại quyết định đã khóa.
6. Đối chiếu `backend/api/openapi/openapi.yaml` và route trong `backend/internal/**/delivery/http/handler.go`; route Go là nguồn sự thật nếu OpenAPI thiếu endpoint.
7. Không gọi `fetch`, `axios` hoặc WebSocket trực tiếp trong React component. Component gọi feature hook/use case; hook dùng API client tập trung.
8. Gate UI bằng permission từ `GET /api/v1/rbac/me?workspace_id=...` hoặc `GET /api/v1/rbac/check`, không suy từ tên role.
9. Với thay đổi API hoặc workflow quan trọng, cập nhật reference tương ứng của skill này trong cùng lượt làm.

## Những điểm dễ sai

- Response JSON luôn là envelope `success`, `data`, `error`, `meta`, `request_id`, `timestamp`; list nằm trong key như `messages`, `channels`, `api_tokens`, `presence`.
- Frontend mặc định gọi backend đã deploy: REST `https://api.vpsttt.com`, WebSocket `wss://api.vpsttt.com/api/v1/ws`; không dùng `localhost` trừ khi user yêu cầu riêng cho backend-dev.
- UI copy tiếng Việt phải dùng đầy đủ dấu; không viết tiếng Việt không dấu trong label, trạng thái, placeholder hoặc tài liệu bàn giao.
- `GET /files/{file_id}/download` trả binary, không phải envelope JSON.
- WebSocket backend hỗ trợ token qua `Authorization: Bearer ...`, query `access_token` và browser subprotocol `["webtui.jwt", accessToken]`; frontend browser mặc định dùng query token qua `RealtimeGateway`, tránh log URL chứa token.
- Nhóm `/api/v1/users/{user_id}` dành cho admin phải truyền `workspace_id`; backend kiểm `user.manage` cho update/delete. UI vẫn phải gate/disable action bằng permission.
- API token/webhook endpoints dành cho tích hợp ngoài hệ thống, không dùng thay thế JWT user session trong web app.
- Secret API token, webhook secret chỉ hiển thị một lần khi tạo; UI phải có trạng thái copy và cảnh báo mất secret.

## Hướng build mặc định

- Dùng `apps/web` cho chat người dùng, `apps/admin` cho quản trị.
- Dùng `packages/api-client` cho REST client, WebSocket gateway, envelope unwrap, refresh token, upload/download.
- Dùng `packages/types` cho DTO/domain types sinh từ OpenAPI hoặc map thủ công.
- Dùng `packages/ui` cho primitive/pattern component chung; feature-specific component đặt trong app/feature.
- Dùng TanStack Query cho server state; Zustand chỉ cho client state như auth session cache, selected workspace/channel, composer draft, sidebar state, socket status.
- Với scaffold hiện tại, bắt đầu từ `frontend/apps/web`, `frontend/apps/admin` và các package `@webtui/*`; không tạo cấu trúc song song mới nếu không có lý do rõ.
- Sau F2, không thêm mảng dữ liệu hoặc JSX lớn trực tiếp vào `app/page.tsx`; page chỉ compose feature component, dữ liệu đi qua data source/hook, và component nhận props rõ ràng.

## Cập nhật F3/F4 ngày 2026-07-08

- `@webtui/api-client` hiện là nguồn duy nhất cho REST client, query keys, module clients và realtime gateway base.
- Auth result backend dùng `data.tokens.access_token` và `data.tokens.refresh_token`; khi viết auth/session mới phải đọc token nested trước, fallback token phẳng sau.
- `apps/web` và `apps/admin` đã có AuthProvider, QueryClientProvider và Zustand auth store riêng.
- Không khôi phục `chat-workspace-source.ts` hoặc `dashboard-source.ts`. Dữ liệu UI phải đến từ API hoặc empty/loading/error state.
- Với upload file trong chat: gọi upload `/files`, sau đó attach bằng `/channels/{channel_id}/messages/{message_id}/attachments`; upload endpoint không tự gắn file vào message.

## Cập nhật F5/F6 ngày 2026-07-08

- Web chat dùng `useWorkspaceContext` và `useChatWorkspaceData`; không đặt query/mutation trực tiếp trong component màn hình.
- Workspace được chọn bằng URL query `workspace`, channel bằng query `channel`; hook tự đồng bộ giá trị đầu tiên từ API khi URL chưa có state.
- RBAC dùng `GET /api/v1/rbac/me?workspace_id=...` qua `can(permission)`; action tạo kênh, gửi tin, upload file và admin dashboard phải gate bằng permission.
- `PermissionGate` là boundary dùng chung cho vùng UI cần chặn quyền rõ ràng; action nhỏ có thể dùng disabled state kèm lý do.
- Admin dashboard dùng `useAdminDashboardData`; stats, health và users chỉ query khi có quyền `admin.view`.
- F6/F7/F9 đã nối API thật cho list channels, messages, tin ghim, direct conversations, create channel, create direct conversation, read-state, upload/attach/download file. Không thêm dữ liệu mẫu khi backend chưa có media chuyên biệt.
- Hướng F7/F8: tách message timeline/use-case sâu hơn, thêm infinite cursor, optimistic sending, edit/delete/reaction, rồi nối realtime join/leave room bằng `RealtimeGateway`.

## Cập nhật F7/F8 ngày 2026-07-09

- Timeline REST dùng `useMessageTimeline` với `useInfiniteQuery`, cursor `before`, `limit=50`, sort hiển thị tăng dần theo thời gian và helper cache chống trùng message.
- `messagesClient` có `listPage`, `threadPage`, `searchPage` để giữ `meta.next_cursor/has_more`; không dùng response list mất meta cho timeline mới.
- Gửi tin nhắn qua `useChatWorkspaceData` có optimistic message `local-*`, rollback khi lỗi và replace bằng message thật khi API trả về.
- Sửa, xóa và reaction dùng mutation API thật; quyền UI dựa trên owner hoặc `message.manage`, backend vẫn là nguồn quyết định cuối cùng.
- Thread và search là luồng on-demand: UI chỉ hiển thị dữ liệu API, không tạo placeholder nội dung giả.
- Realtime dùng `useChannelRealtime`, `RealtimeGateway`, room `workspace:{workspaceId}:channel:{channelId}`, join/leave khi đổi kênh, reconnect backoff và merge cache cho `MessageCreated`, `MessageUpdated`, `MessageDeleted`, `ReactionChanged`.
- Trạng thái socket nằm trong Zustand `useRealtimeStore`; UI hiển thị connected/connecting/reconnecting/offline/idle bằng tiếng Việt có dấu.
- F9 nên tập trung upload queue/progress/retry và attachment display sâu hơn; F10 nối notification/presence thay vì nhồi vào timeline.

## Cập nhật F9/F10 ngày 2026-07-09

- File/attachment contract đã sửa đúng backend: endpoint attachment trả object có `file` lồng bên trong; UI không giả định attachment là `FileObject` phẳng.
- Composer dùng `useUploadStore` cho upload queue nhiều file, trạng thái `queued/uploading/attached/failed`, remove và retry. Nếu attach file lỗi sau khi message đã gửi, không rollback message; giữ file lỗi trong queue.
- Timeline phải render `message.attachments[]` từ API và download bằng `file_id`; không chỉ hiện tên file đầu tiên.
- Vì backend `MessageDTO` chưa hydrate attachment, timeline cần query `/channels/{channel_id}/messages/{message_id}/attachments` cho các message đang hiển thị và invalidate query này sau upload/attach.
- Notification và presence đi qua `useNotificationPresence`; component không gọi API trực tiếp.
- Notification dropdown dùng `/api/v1/notifications`, mark read/read-all có `workspace_id`; click notification mở channel/message nếu backend trả id tương ứng.
- Presence dùng `/workspaces/{workspace_id}/presence` và heartbeat 30 giây; `away` map sang trạng thái UI `busy`, cleanup gửi `offline` khi unmount.
- F11 tiếp theo nên tập trung admin MVP bằng API thật: guard `admin.view`, stats, health, users, RBAC, audit. Không đưa dữ liệu mẫu trở lại dashboard.

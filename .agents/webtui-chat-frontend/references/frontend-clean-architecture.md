# Frontend Clean Architecture

## Đánh giá hiện trạng

`frontend/ARCHITECTURE.md` hiện tại đúng hướng ở mức tool chọn: Next.js App Router, shadcn/ui, TanStack Query, Zustand, API client dùng chung. Tuy nhiên chưa đủ "clean" cho dự án chat nội bộ vì còn thiếu:

- Hướng phụ thuộc giữa app, feature, domain, API client, UI.
- Quy định nơi đặt use case, query/mutation hook, DTO mapper, WebSocket gateway.
- Ranh giới server state/client state và lifecycle realtime.
- Cách gate UI theo RBAC.
- Quy ước upload/download, error handling, optimistic update, testing.
- Quy tắc để `apps/web` và `apps/admin` chia sẻ package mà không phụ thuộc ngược.

## Hướng phụ thuộc

```text
apps/* route/page
  -> features/*
    -> domain/use-cases
    -> adapters/api-client
    -> adapters/realtime
  -> packages/ui
  -> packages/types

packages/api-client -> packages/types
packages/ui -> packages/icons
packages/types -> không phụ thuộc runtime
```

Không để `packages/ui` gọi API hoặc biết business module. Không để `packages/api-client` import React component. Không để component gọi endpoint trực tiếp.

## Cấu trúc đề xuất

```text
frontend/
├── apps/
│   ├── web/
│   │   └── src/
│   │       ├── app/
│   │       ├── features/
│   │       ├── layouts/
│   │       └── stores/
│   └── admin/
│       └── src/
│           ├── app/
│           ├── features/
│           ├── layouts/
│           └── stores/
├── packages/
│   ├── api-client/
│   ├── config/
│   ├── icons/
│   ├── types/
│   └── ui/
└── ARCHITECTURE.md
```

Scaffold F1 đã tạo đúng cấu trúc này bằng npm workspaces. Khi tiếp tục phase mới, mở `references/frontend-implementation-status.md` để xem trạng thái và handoff trước khi thêm feature.

Mỗi feature nên có:

```text
features/messages/
├── api/
├── components/
├── hooks/
├── model/
├── stores/
└── index.ts
```

- `api`: function gọi `packages/api-client`, query keys, mapper DTO.
- `hooks`: `useMessages`, `useSendMessage`, `useMessageRealtime`.
- `model`: type domain nhẹ, permission helpers, optimistic update helpers.
- `stores`: draft, selected thread, local UI state nếu cần.
- `components`: chỉ render và nhận callback/hook result.

## API Client

`packages/api-client` cần có:

- `HttpClient` bọc `fetch`, base URL, bearer token, request id, JSON/multipart/blob; base URL mặc định là `https://api.vpsttt.com`.
- `unwrapEnvelope<T>()` trả `data`, ném lỗi typed khi `success=false`.
- `AuthTokenProvider` duy nhất quản lý access/refresh token.
- Module client theo backend: `authClient`, `workspacesClient`, `channelsClient`, `messagesClient`, `filesClient`, `rbacClient`, `adminClient`, `integrationsClient`.
- Query key factory theo feature, ví dụ `messageKeys.list(workspaceId, channelId, before)`.

Không để component tự tạo URL string endpoint.

## State

- TanStack Query: workspaces, members, channels, messages, files, notifications, permissions, admin stats, cronjobs.
- Zustand: selected workspace/channel, composer draft, sidebar collapsed, right panel tab, socket connection state, transient upload queue.
- URL state: route params, search, selected message/thread nếu cần deep-link.

## Realtime

- Tạo `RealtimeGateway` trong `packages/api-client` hoặc feature adapter.
- Join/leave room theo channel khi route đổi.
- Merge event vào TanStack Query cache:
  - `MessageCreated`: prepend/append đúng timeline hiện tại, chống trùng `id`.
  - `MessageUpdated`: replace message.
  - `MessageDeleted`: mark/remove theo UX.
  - `ReactionChanged`: replace reaction summary.
- Browser kết nối WebSocket mặc định bằng query `?access_token=...` vì native WebSocket không set được `Authorization`; subprotocol `["webtui.jwt", accessToken]` chỉ là fallback cấu hình khi backend/proxy hỗ trợ tốt hơn.

## RBAC

- Sau khi chọn workspace, gọi `GET /api/v1/rbac/me?workspace_id=...`.
- Lưu permission set theo workspace trong Query cache.
- UI dùng helper `can(permissionCode)` để show/disable action.
- Không ẩn lỗi backend: nếu user click và backend trả `403`, hiển thị message rõ và refetch permission.

## Testing

- Unit: mapper, query key, permission helper, reducers/store.
- Component: chat composer, message list, sidebar, admin forms.
- Contract: mock API envelope đúng backend.
- E2E sau khi có app: login, tạo workspace/channel, gửi message, upload file, mark read.

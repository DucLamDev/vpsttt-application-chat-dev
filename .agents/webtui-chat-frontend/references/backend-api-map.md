# Backend API Map Cho Frontend

Nguồn đã quét:

- `backend/internal/bootstrap/router.go`
- `backend/internal/modules/**/delivery/http/handler.go`
- `backend/internal/modules/**/application/service.go`
- `backend/internal/platform/websocket/**`
- `backend/api/openapi/openapi.yaml`
- `backend/db/migrations/*rbac*`, `*api_scopes*`

## Quy ước chung

- Base REST mặc định cho frontend: `https://api.vpsttt.com`.
- WebSocket endpoint mặc định cho frontend: `wss://api.vpsttt.com/api/v1/ws`.
- Không dùng `localhost` trong app web/admin khi làm frontend MVP/production; local backend chỉ dùng khi user yêu cầu riêng cho phiên backend-dev.
- REST nghiệp vụ nằm dưới `/api/v1`.
- Auth user dùng `Authorization: Bearer <access_token>`.
- Response JSON:

```ts
type ApiEnvelope<T, M = unknown> = {
  success: boolean;
  data?: T;
  error?: { code: string; message: string; details?: Record<string, unknown> };
  meta?: M;
  request_id?: string;
  timestamp: string;
};
```

- `204` không có body.
- Pagination cursor phổ biến: `limit`, `before`; `meta` có `has_more`, `next_cursor`, `prev_cursor`.
- Normalize `limit`: mặc định `50`, tối đa `100`.
- Khi chạy frontend local nhưng gọi backend deploy, vẫn giữ base API là `https://api.vpsttt.com`; nếu gặp CORS thì xử lý allowlist backend/proxy frontend, không đổi sang backend `localhost`.
- Route Go trong `backend/internal/**/delivery/http/handler.go` là nguồn sự thật cuối cùng. OpenAPI hiện có thể thiếu một vài operation như user update/delete hoặc revoke role.

## Health Và Platform

| Method | Path | Auth | Frontend dùng cho |
| --- | --- | --- | --- |
| GET | `/health` | Không | Liveness nhẹ |
| GET | `/ready` | Không | Readiness/deploy check |
| GET | `/version` | Không | About/version badge |
| GET | `/metrics` | Không, nếu bật | Prometheus/ops, không hiển thị cho user thường |
| GET | `/api/v1` | Không | Kiểm tra API v1 |
| GET | `/api/v1/ws` | JWT header, query `access_token`, hoặc subprotocol | Realtime channel event |

## Auth Và User Session

| Method | Path | Body/query | Data key |
| --- | --- | --- | --- |
| POST | `/api/v1/auth/register` | `email`, `username`, `display_name`, `password`, `device_name?` | auth result |
| POST | `/api/v1/auth/login` | `identifier`, `password`, `device_name?` | auth result |
| POST | `/api/v1/auth/refresh` | `refresh_token` | auth result |
| POST | `/api/v1/auth/logout` | `refresh_token` | `{status}` |
| GET | `/api/v1/auth/me` | JWT | user |
| GET | `/api/v1/auth/sessions` | JWT | `sessions` |
| DELETE | `/api/v1/auth/sessions/{session_id}` | JWT | none |
| DELETE | `/api/v1/auth/sessions` | JWT | none |

Frontend nên có một `authClient` tập trung: attach bearer, unwrap envelope, refresh khi token hết hạn, logout khi refresh fail.

Auth result shape:

```ts
type AuthResult = {
  user: User;
  tokens: {
    access_token: string;
    refresh_token?: string;
    token_type: "Bearer";
    access_token_expires_at: string;
    refresh_token_expires_at?: string;
  };
  session_id: string;
  refresh_until: string;
};
```

Backend hiện cấp access token 15 phút và refresh token 30 ngày trong bootstrap.

## Users

| Method | Path | Body/query | Data key |
| --- | --- | --- | --- |
| GET | `/api/v1/users/me` | JWT | user |
| PATCH | `/api/v1/users/me` | `display_name?`, `avatar_url?`, `phone_number?`, `locale?`, `timezone?` | user |
| GET | `/api/v1/users` | `q?`, `status?`, `limit?`; `q` tìm theo tên, email, username, số điện thoại | `users` + `meta` |
| GET | `/api/v1/users/{user_id}` | path | user |
| PATCH | `/api/v1/users/{user_id}` | profile fields + `phone_number?` + `status?` + `workspace_id` | user |
| DELETE | `/api/v1/users/{user_id}` | query `workspace_id` | none |

Ghi chú hardening: update/delete user backend kiểm permission `user.manage` theo `workspace_id`. Frontend admin vẫn phải gate/disable UI bằng permission; list users vẫn là API auth dùng cho tìm bạn bè và admin.

## Contacts Và Friend Requests

Luồng Zalo-like cho DM 1-1: tìm user, gửi lời mời, người nhận đồng ý, sau đó mới tạo direct conversation.

| Method | Path | Body/query | Data key |
| --- | --- | --- | --- |
| GET | `/api/v1/contacts` | JWT | `contacts` |
| GET | `/api/v1/contact-requests` | `status?=pending/all` | `contact_requests` |
| POST | `/api/v1/contact-requests` | `user_id` | contact request |
| POST | `/api/v1/contact-requests/{request_id}/accept` | path | contact request |
| POST | `/api/v1/contact-requests/{request_id}/reject` | path | contact request |
| DELETE | `/api/v1/contact-requests/{request_id}` | path | none |

Direct conversation backend kiểm `accepted` contact trước khi tạo hội thoại. Nếu hợp lệ, backend tự đảm bảo participants là workspace members với role `workspace_member`.

## RBAC Và Permission

| Method | Path | Body/query | Data key |
| --- | --- | --- | --- |
| GET | `/api/v1/rbac/permissions` | JWT | `permissions` |
| GET | `/api/v1/rbac/roles` | `workspace_id?` | `roles` |
| POST | `/api/v1/rbac/roles` | `workspace_id`, `code`, `name`, `description`, `permission_codes` | role |
| GET | `/api/v1/rbac/me` | `workspace_id` | `permissions` |
| GET | `/api/v1/rbac/check` | `workspace_id`, `permission` | `{allowed}` |
| GET | `/api/v1/rbac/workspaces/{workspace_id}/members/{user_id}/roles` | path | `roles` |
| POST | `/api/v1/rbac/workspaces/{workspace_id}/members/{user_id}/roles` | `role_id` | none |
| DELETE | `/api/v1/rbac/workspaces/{workspace_id}/members/{user_id}/roles/{role_id}` | path | none |

Permission codes quan trọng cho frontend:

- `workspace.manage`, `workspace.invite_user`, `workspace.view_members`
- `user.manage`
- `role.manage`
- `channel.create`, `channel.manage`, `channel.delete`
- `message.send`, `message.manage`
- `file.upload`
- `api_token.manage`
- `bot.manage`, `webhook.manage`
- `cronjob.manage`, `backup.manage`, `audit.view`, `admin.view`

## Workspace, Department, Channel

| Method | Path | Body/query | Data key |
| --- | --- | --- | --- |
| GET | `/api/v1/workspaces` | JWT | `workspaces` |
| POST | `/api/v1/workspaces` | `slug`, `name`, `description?` | workspace |
| GET | `/api/v1/workspaces/{workspace_id}` | path | workspace |
| PATCH | `/api/v1/workspaces/{workspace_id}` | `name?`, `description?` | workspace |
| DELETE | `/api/v1/workspaces/{workspace_id}` | path | none |
| GET | `/api/v1/workspaces/{workspace_id}/members` | path | `members` |
| POST | `/api/v1/workspaces/{workspace_id}/members` | `user_id`, `title?`, `role_code?` | member |
| PATCH | `/api/v1/workspaces/{workspace_id}/members/{user_id}` | `status` | member |
| GET | `/api/v1/workspaces/{workspace_id}/settings` | path | `settings` |
| PUT | `/api/v1/workspaces/{workspace_id}/settings/{key}` | `value`, `value_type`, `description?` | setting |
| GET | `/api/v1/workspaces/{workspace_id}/invites` | path | `invites` |
| POST | `/api/v1/workspaces/{workspace_id}/invites` | `email`, `role_code`, `expires_days?` | invite |
| GET | `/api/v1/workspaces/{workspace_id}/departments` | path | `departments` |
| POST | `/api/v1/workspaces/{workspace_id}/departments` | `parent_id?`, `slug`, `name`, `description?` | department |
| GET | `/api/v1/workspaces/{workspace_id}/departments/{department_id}` | path | department |
| PATCH | `/api/v1/workspaces/{workspace_id}/departments/{department_id}` | `parent_id?`, `name?`, `description?` | department |
| DELETE | `/api/v1/workspaces/{workspace_id}/departments/{department_id}` | path | none |
| GET | `/api/v1/workspaces/{workspace_id}/departments/{department_id}/members` | path | `members` |
| POST | `/api/v1/workspaces/{workspace_id}/departments/{department_id}/members` | `user_id`, `role?` | member |
| DELETE | `/api/v1/workspaces/{workspace_id}/departments/{department_id}/members/{user_id}` | path | none |
| GET | `/api/v1/workspaces/{workspace_id}/channels` | path | `channels` |
| POST | `/api/v1/workspaces/{workspace_id}/channels` | `department_id?`, `slug`, `name`, `description?`, `type` | channel |
| GET | `/api/v1/workspaces/{workspace_id}/channels/{channel_id}` | path | channel |
| PATCH | `/api/v1/workspaces/{workspace_id}/channels/{channel_id}` | `department_id?`, `name?`, `description?` | channel |
| DELETE | `/api/v1/workspaces/{workspace_id}/channels/{channel_id}` | path | none |
| GET | `/api/v1/workspaces/{workspace_id}/channels/{channel_id}/members` | path | `members` |
| POST | `/api/v1/workspaces/{workspace_id}/channels/{channel_id}/members` | `user_id` | member |
| PATCH | `/api/v1/workspaces/{workspace_id}/channels/{channel_id}/members/{user_id}` | `status` | member |
| PUT | `/api/v1/workspaces/{workspace_id}/channels/{channel_id}/read-state` | `last_read_message_id` | member |
| GET | `/api/v1/workspaces/{workspace_id}/direct-conversations` | path | `direct_conversations` |
| POST | `/api/v1/workspaces/{workspace_id}/direct-conversations` | `participant_ids` | direct conversation |

## Messages, Files, Realtime

| Method | Path | Body/query | Data key |
| --- | --- | --- | --- |
| GET | `/api/v1/workspaces/{workspace_id}/messages/search` | `q`, `limit?` | `messages` + `meta` |
| GET | `/api/v1/workspaces/{workspace_id}/channels/{channel_id}/messages` | `before?`, `limit?` | `messages` + `meta` |
| POST | `/api/v1/workspaces/{workspace_id}/channels/{channel_id}/messages` | `parent_id?`, `kind?`, `body`, `metadata?`, `mentioned_user_ids?` | message |
| GET | `/api/v1/workspaces/{workspace_id}/channels/{channel_id}/messages/{message_id}` | path | message |
| PATCH | `/api/v1/workspaces/{workspace_id}/channels/{channel_id}/messages/{message_id}` | `body` | message |
| DELETE | `/api/v1/workspaces/{workspace_id}/channels/{channel_id}/messages/{message_id}` | path | none |
| GET | `/api/v1/workspaces/{workspace_id}/channels/{channel_id}/messages/{message_id}/thread` | `limit?` | `messages` + `meta` |
| GET | `/api/v1/workspaces/{workspace_id}/channels/{channel_id}/pins` | path | `messages` |
| POST | `/api/v1/workspaces/{workspace_id}/channels/{channel_id}/messages/{message_id}/pin` | path | message |
| DELETE | `/api/v1/workspaces/{workspace_id}/channels/{channel_id}/messages/{message_id}/pin` | path | none |
| POST | `/api/v1/workspaces/{workspace_id}/channels/{channel_id}/messages/{message_id}/reactions` | `emoji` | message |
| DELETE | `/api/v1/workspaces/{workspace_id}/channels/{channel_id}/messages/{message_id}/reactions/{emoji}` | encoded emoji | message |
| GET | `/api/v1/workspaces/{workspace_id}/files` | `limit?` | `files` |
| POST | `/api/v1/workspaces/{workspace_id}/files` | multipart `file`, `metadata?` JSON string | file |
| GET | `/api/v1/workspaces/{workspace_id}/files/{file_id}` | path | file |
| GET | `/api/v1/workspaces/{workspace_id}/files/{file_id}/download` | path | binary |
| GET | `/api/v1/workspaces/{workspace_id}/files/{file_id}/versions` | path | `versions` |
| POST | `/api/v1/workspaces/{workspace_id}/files/{file_id}/versions` | multipart `file` | version |
| GET | `/api/v1/workspaces/{workspace_id}/channels/{channel_id}/messages/{message_id}/attachments` | path | `attachments` |
| POST | `/api/v1/workspaces/{workspace_id}/channels/{channel_id}/messages/{message_id}/attachments` | `file_id`, `sort_order?` | attachment |

Message realtime:

- Room format: `workspace:{workspace_id}:channel:{channel_id}`.
- Join command: `{"type":"join","room":"workspace:...:channel:..."}`.
- Leave command: `{"type":"leave","room":"workspace:...:channel:..."}`.
- Backend tự đăng ký socket vào room cá nhân `user:{user_id}` sau khi xác thực.
- Event shape: `{type, room, user_id?, payload, timestamp}`.
- Message event types: `MessageCreated`, `MessageUpdated`, `MessageDeleted`, `ReactionChanged`, `MessagePinned`, `MessageUnpinned`.
- Contact event types trên room cá nhân: `ContactRequestCreated`, `ContactRequestUpdated`, `ContactRequestCancelled`.
- Payload contains `{ "message": MessageDTO }` for message events or `{ "contact_request": ContactRequestDTO }` for contact events.

Browser auth cho WebSocket:

```ts
const ws = new WebSocket(`${wsUrl}?access_token=${encodeURIComponent(accessToken)}`);
// Fallback khi cần debug/dev và muốn tránh token trong URL:
const ws = new WebSocket(wsUrl, ["webtui.jwt", accessToken]);
```

Ưu tiên `wss://` ở production và không log URL có `access_token`.

## Notifications Và Presence

| Method | Path | Body/query | Data key |
| --- | --- | --- | --- |
| GET | `/api/v1/notifications` | `workspace_id?`, `limit?` | `notifications` |
| PUT | `/api/v1/notifications/{notification_id}/read` | path | notification |
| PUT | `/api/v1/notifications/read-all` | `workspace_id?` | none |
| GET | `/api/v1/workspaces/{workspace_id}/presence` | `limit?` | `presence` + `meta` |
| PUT | `/api/v1/workspaces/{workspace_id}/presence/heartbeat` | `device_id`, `socket_id?`, `node_id?`, `status?`, `metadata?` | presence |

## Integrations, Bots, Webhooks

| Method | Path | Auth | Body/query | Data key |
| --- | --- | --- | --- | --- |
| GET | `/api/v1/api-scopes` | JWT | none | `scopes` |
| GET | `/api/v1/workspaces/{workspace_id}/api-tokens` | JWT | path | `api_tokens` |
| POST | `/api/v1/workspaces/{workspace_id}/api-tokens` | JWT | `name`, `scopes`, `expires_days?` | created token |
| DELETE | `/api/v1/workspaces/{workspace_id}/api-tokens/{token_id}` | JWT | path | none |
| POST | `/api/v1/integrations/messages` | API token | `channel_id`, `body`, `metadata?` | message |
| GET | `/api/v1/workspaces/{workspace_id}/bots` | JWT | path | `bots` |
| POST | `/api/v1/workspaces/{workspace_id}/bots` | JWT | `slug`, `name`, `description?`, `avatar_url?`, `settings?` | bot |
| GET | `/api/v1/workspaces/{workspace_id}/bots/{bot_id}/installations` | JWT | path | `installations` |
| POST | `/api/v1/workspaces/{workspace_id}/bots/{bot_id}/installations` | JWT | `channel_id?`, `config?` | installation |
| POST | `/api/v1/workspaces/{workspace_id}/bots/{bot_id}/messages` | JWT | `channel_id`, `body`, `metadata?` | message |
| GET | `/api/v1/workspaces/{workspace_id}/incoming-webhooks` | JWT | path | `incoming_webhooks` |
| POST | `/api/v1/workspaces/{workspace_id}/incoming-webhooks` | JWT | `channel_id?`, `name` | created incoming webhook |
| POST | `/api/v1/hooks/incoming/{webhook_id}` | webhook secret | `secret?`, `channel_id?`, `body`, `metadata?` or header `X-WebTui-Webhook-Secret` | message |
| GET | `/api/v1/workspaces/{workspace_id}/outgoing-webhooks` | JWT | path | `outgoing_webhooks` |
| POST | `/api/v1/workspaces/{workspace_id}/outgoing-webhooks` | JWT | `name`, `target_url`, `event_types?` | created outgoing webhook |
| GET | `/api/v1/workspaces/{workspace_id}/outgoing-webhooks/{webhook_id}/deliveries` | JWT | `limit?` | `deliveries` |

## Admin, Audit, Cronjob, Backup

| Method | Path | Body/query | Permission | Data key |
| --- | --- | --- | --- | --- |
| GET | `/api/v1/workspaces/{workspace_id}/admin/stats` | path | `admin.view` | stats |
| GET | `/api/v1/workspaces/{workspace_id}/admin/health` | path | `admin.view` | `{status, checks}` |
| GET | `/api/v1/workspaces/{workspace_id}/audit-logs` | `actor_user_id?`, `action?`, `entity_type?`, `entity_id?`, `from?`, `to?`, `limit?` | `audit.view` | `audit_logs` |
| GET | `/api/v1/workspaces/{workspace_id}/cronjobs` | `status?`, `limit?` | `cronjob.manage` | `cronjobs` |
| POST | `/api/v1/workspaces/{workspace_id}/cronjobs` | `name`, `description?`, `schedule`, `runner`, `status?`, `payload` | `cronjob.manage` | cronjob |
| PATCH | `/api/v1/workspaces/{workspace_id}/cronjobs/{cronjob_id}` | same as create | `cronjob.manage` | cronjob |
| DELETE | `/api/v1/workspaces/{workspace_id}/cronjobs/{cronjob_id}` | path | `cronjob.manage` | none |
| GET | `/api/v1/workspaces/{workspace_id}/cronjobs/{cronjob_id}/runs` | `limit?` | `cronjob.manage` | `runs` |
| POST | `/api/v1/workspaces/{workspace_id}/cronjobs/{cronjob_id}/run` | path | `cronjob.manage` | run |
| GET | `/api/v1/workspaces/{workspace_id}/backup-jobs` | `limit?` | `backup.manage` | `backup_jobs` |
| POST | `/api/v1/workspaces/{workspace_id}/backup-jobs` | `name`, `target?`, `backup_type?`, `schedule?`, `status?`, `config?` | `backup.manage` | backup job |
| GET | `/api/v1/workspaces/{workspace_id}/backup-jobs/{backup_job_id}/runs` | `limit?` | `backup.manage` | `backup_runs` |
| POST | `/api/v1/workspaces/{workspace_id}/backup-jobs/{backup_job_id}/run` | path | `backup.manage` | backup run |

Cronjob runner values: `http`, `builtin_cleanup`, `worker`, `script`.
Cronjob status values: `active`, `paused`, `disabled`.
Run status values: `running`, `success`, `failed`, `cancelled`.

## Frontend Feature Mapping

- Login/session: Auth API, Users `/me`, session revoke.
- Workspace switcher: `GET /workspaces`, `GET /workspaces/{id}`, `GET /rbac/me`.
- Sidebar hội thoại: `GET /contacts`, `GET /contact-requests`, `GET /direct-conversations`, `GET /notifications`, `GET /presence`.
- Kênh & bot: `GET /channels`, create/manage channel, bot/webhook endpoints.
- Chat timeline: messages list/send/update/delete/reaction/thread/pins plus WebSocket events.
- File panel: files list, attachments list, upload, download blob.
- Admin dashboard: admin stats/health, users, members, RBAC, audit logs.
- Integration settings: API scopes/tokens, bots, incoming/outgoing webhooks/deliveries.
- Operations settings: cronjobs, backup jobs/runs, health, metrics link.

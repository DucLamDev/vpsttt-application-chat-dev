# Káº¿ hoáº¡ch hoÃ n thiá»‡n backend WebTui Chat

TÃ i liá»‡u nÃ y chia nhá» káº¿ hoáº¡ch backend thÃ nh nhiá»u phase Ä‘á»ƒ hoÃ n thiá»‡n há»‡ thá»‘ng trÆ°á»›c khi chuyá»ƒn sang frontend. Pháº¡m vi bÃ¡m theo kiáº¿n trÃºc Ä‘Ã£ thiáº¿t káº¿: Go + Gin, PostgreSQL, Redis, RabbitMQ, WebSocket, MinIO/S3, worker, CI/CD vÃ  Docker Compose.

## NguyÃªn táº¯c triá»ƒn khai

- HoÃ n thiá»‡n backend trÆ°á»›c frontend; frontend chá»‰ báº¯t Ä‘áº§u khi API contract, auth, chat realtime, file upload vÃ  admin API ná»n Ä‘Ã£ á»•n.
- Má»—i phase pháº£i cÃ³ tiÃªu chÃ­ nghiá»‡m thu rÃµ rÃ ng, cÃ³ test tá»‘i thiá»ƒu vÃ  cÃ³ tÃ i liá»‡u cáº­p nháº­t.
- Æ¯u tiÃªn MVP cháº¡y tháº­t: Ä‘Äƒng nháº­p, workspace, channel, message, WebSocket, upload file, notification, bot API, webhook, cronjob, backup.
- KhÃ´ng tÃ¡ch microservice trong giai Ä‘oáº¡n Ä‘áº§u; API server vÃ  worker lÃ  hai process/container Ä‘á»™c láº­p trong cÃ¹ng modular monolith.
- KhÃ´ng Ä‘Æ°a logic nghiá»‡p vá»¥ vÃ o `cmd`, `delivery` hoáº·c adapter ká»¹ thuáº­t.

## Má»‘c MVP backend

Backend Ä‘Æ°á»£c xem lÃ  Ä‘áº¡t MVP khi cÃ³ Ä‘á»§:

- ÄÄƒng nháº­p, refresh token, logout vÃ  phÃ¢n quyá»n workspace/channel.
- Quáº£n lÃ½ user, workspace, department, channel vÃ  direct message.
- Gá»­i, sá»­a, xÃ³a, Ä‘á»c message; reaction, mention, thread vÃ  WebSocket realtime.
- Upload/download file qua Local/MinIO, lÆ°u metadata vÃ  gáº¯n file vÃ o message.
- Notification realtime vÃ  notification job tá»‘i thiá»ƒu.
- Bot API, API token, incoming webhook, outgoing webhook vÃ  webhook log.
- Cronjob cÆ¡ báº£n, audit log, health check vÃ  backup database.
- Docker Compose cháº¡y Ä‘Æ°á»£c local vÃ  production.
- CI/CD cháº¡y lint, test, build image vÃ  deploy qua GitHub Actions.

## Báº£ng káº¿ hoáº¡ch tá»•ng quan

| Phase | TÃªn phase | Má»¥c tiÃªu chÃ­nh | Káº¿t quáº£ bÃ n giao | Äiá»u kiá»‡n chuyá»ƒn phase |
|---|---|---|---|---|
| 0 | Chá»‘t kiáº¿n trÃºc vÃ  contract | KhÃ³a pháº¡m vi backend MVP, chuáº©n hÃ³a tÃ i liá»‡u, schema vÃ  API style | TÃ i liá»‡u kiáº¿n trÃºc, database schema, API convention, roadmap | Schema ná»n vÃ  roadmap Ä‘Æ°á»£c review |
| 1 | Ná»n táº£ng Go + Gin | Khá»Ÿi táº¡o backend cháº¡y Ä‘Æ°á»£c, cÃ³ config, logger, router, graceful shutdown | `go.mod`, `cmd/api`, `cmd/worker`, health endpoint | API server cháº¡y local vÃ  tráº£ `/health` |
| 2 | Platform adapters | Káº¿t ná»‘i PostgreSQL, Redis, RabbitMQ, storage, WebSocket manager | Adapter trong `internal/platform` | Integration smoke test qua Docker Compose |
| 3 | Auth, user, RBAC | ÄÄƒng nháº­p vÃ  phÃ¢n quyá»n Ä‘á»™ng theo role/permission | Auth API, user API, RBAC service, middleware | CÃ³ thá»ƒ login vÃ  kiá»ƒm tra quyá»n route |
| 4 | Workspace, department, channel | Quáº£n lÃ½ tenant, phÃ²ng ban, kÃªnh vÃ  direct message | Workspace/channel/direct APIs | Táº¡o workspace, channel, DM thÃ nh cÃ´ng |
| 5 | Message vÃ  realtime | Chat realtime á»•n Ä‘á»‹nh qua WebSocket | Message API, WebSocket event, thread, reaction, mention | 2 client nháº­n message realtime |
| 6 | File vÃ  storage | Upload/download file, gáº¯n file vÃ o message | File API, storage adapter, file version | Upload file vÃ  gá»­i message cÃ³ attachment |
| 7 | Notification vÃ  worker | Xá»­ lÃ½ queue, notification, outbox event, retry | Worker, notification jobs, outbox publisher | Event tá»« API Ä‘Æ°á»£c worker xá»­ lÃ½ |
| 8 | Bot, API token, webhook | Má»Ÿ tÃ­ch há»£p há»‡ thá»‘ng ngoÃ i | Bot API, token scope, incoming/outgoing webhook | Gá»­i message qua API token/webhook |
| 9 | Cronjob vÃ  module runner | Cháº¡y job Ä‘á»‹nh ká»³ vÃ  job/script cÃ³ kiá»ƒm soÃ¡t | Cronjob manager, job run log, module runner MVP | Job cháº¡y theo lá»‹ch vÃ  ghi log |
| 10 | Admin, audit, health, backup | HoÃ n thiá»‡n API quáº£n trá»‹ vÃ  váº­n hÃ nh | Admin APIs, audit log, health check, backup/restore | Admin cÃ³ API Ä‘á»§ Ä‘á»ƒ quáº£n lÃ½ há»‡ thá»‘ng |
| 11 | Hardening vÃ  performance | TÄƒng Ä‘á»™ tin cáº­y, báº£o máº­t, quan sÃ¡t vÃ  test | Rate limit, metrics, logs, test suite, benchmark | Backend Ä‘á»§ á»•n Ä‘á»ƒ demo ná»™i bá»™ |
| 12 | ÄÃ³ng gÃ³i demo vÃ  release backend | Cháº¡y tháº­t trÃªn server demo, chuáº©n bá»‹ open-source backend | Dockerfile, compose prod, CI/CD, tÃ i liá»‡u deploy | Deploy thÃ nh cÃ´ng lÃªn server demo |

## Tráº¡ng thÃ¡i hiá»‡n táº¡i

| Phase | Tráº¡ng thÃ¡i | Ghi chÃº |
|---|---|---|
| 0 | HoÃ n thÃ nh ná»n | ÄÃ£ cÃ³ roadmap, database schema, API convention, event convention, security baseline vÃ  OpenAPI ná»n |
| 1 | HoÃ n thÃ nh ná»n | ÄÃ£ cÃ³ `go.mod`, `cmd/api`, `cmd/worker`, config, logger, router, middleware response/recovery/request id/access log vÃ  health endpoints |
| 2 | HoÃ n thÃ nh ná»n | ÄÃ£ cÃ³ PostgreSQL adapter, migration runner, Redis/RabbitMQ adapter báº­t theo config, storage local, WebSocket manager, `/ready` kiá»ƒm tra dependency vÃ  nhÃ³m route `/api/v1` |
| 3 | HoÃ n thÃ nh | ÄÃ£ cÃ³ auth API, JWT middleware, refresh token hash/rotate, user CRUD/profile/status, session revoke, RBAC permission/role/role assignment, seed permission/role vÃ  audit auth/role cÆ¡ báº£n |
| 4 | HoÃ n thÃ nh | ÄÃ£ cÃ³ workspace CRUD má»m, member, invite, settings, department CRUD/member, channel CRUD/member/archive, direct conversation chá»‘ng trÃ¹ng, channel read state, xá»­ lÃ½ lá»—i cáº¡nh member/role vÃ  test application cho DM |
| 5 | HoÃ n thÃ nh | ÄÃ£ cÃ³ message command/query, timeline cursor `before`, thread báº±ng `thread_root_id`, reaction, mention, search báº±ng PostgreSQL full text search, Ä‘á»“ng bá»™ `search_documents`, outbox event `MessageCreated/Updated/Deleted/ReactionChanged` vÃ  test application |
| 6 | HoÃ n thÃ nh | ÄÃ£ cÃ³ file upload/download, validate MIME/dung lÆ°á»£ng, checksum SHA-256, storage adapter local vÃ  MinIO/S3, metadata `files`, version trong `file_versions`, attachment vá»›i `message_attachments`, OpenAPI/docs/local-run vÃ  test application |
| 7 | HoÃ n thÃ nh | ÄÃ£ cÃ³ outbox publisher, RabbitMQ event exchange, worker xá»­ lÃ½ outbox/notification job/presence cleanup, notification mention idempotent, API notification, API presence, OpenAPI/docs/local-run vÃ  test application |
| 8 | HoÃ n thÃ nh | ÄÃ£ cÃ³ API token hash/scope/revoke vá»›i quyá»n `api_token.manage`, endpoint gá»­i message báº±ng API token, bot CRUD/install/send message, incoming webhook dispatch, outgoing webhook delivery log/retry/signature, worker gá»­i delivery, OpenAPI/docs/local-run vÃ  test application |
| 9 | HoÃ n thÃ nh | ÄÃ£ cÃ³ cronjob CRUD, schedule parser, lock trÃ¡nh cháº¡y trÃ¹ng, run log, manual run, worker claim job Ä‘áº¿n háº¡n, HTTP runner, builtin cleanup allowlist, script runner allowlist, OpenAPI/docs/local-run vÃ  test application |
| 10 | HoÃ n thÃ nh | ÄÃ£ cÃ³ admin dashboard stats, admin deep health, audit log filter vá»›i before/after data, backup job/run database báº±ng pg_dump, worker backup theo lá»‹ch, script restore dev/staging, OpenAPI/docs/local-run vÃ  test application |
| 11 | HoÃ n thÃ nh | ÄÃ£ cÃ³ security headers, trusted proxies, CORS allowlist, rate limit in-memory, `/metrics` Prometheus vá»›i HTTP/dependency/WebSocket metric, cáº¥u hÃ¬nh env, docs hardening/observability vÃ  test middleware |
| 12 | HoÃ n thÃ nh ná»n | ÄÃ£ cÃ³ Dockerfile multi-stage API/worker/migrate, Compose production cho VPS, Nginx domain `chat.vpsttt.com`, script Let's Encrypt, CloudAMQP config, máº«u `.env` production, GitHub Actions deploy vÃ  tÃ i liá»‡u VPS |

## Báº£ng káº¿ hoáº¡ch chi tiáº¿t

| Phase | Háº¡ng má»¥c | CÃ´ng viá»‡c chi tiáº¿t | Module/thÆ° má»¥c liÃªn quan | TiÃªu chÃ­ nghiá»‡m thu | Æ¯u tiÃªn |
|---|---|---|---|---|---|
| 0 | Kiáº¿n trÃºc backend | RÃ  soÃ¡t `CleanArchitecture.md`, database schema, CI/CD, Docker Compose, quyáº¿t Ä‘á»‹nh MVP backend | `docs/architecture`, `docs/database`, `deploy` | TÃ i liá»‡u khÃ´ng mÃ¢u thuáº«n, scope MVP rÃµ | P0 |
| 0 | API convention | Quy Ä‘á»‹nh response format, error code, pagination, filter, sort, idempotency key, request id | `backend/docs`, `api/openapi` | CÃ³ tÃ i liá»‡u API convention | P0 |
| 0 | Event convention | Quy Ä‘á»‹nh tÃªn event, payload, version, retry, dead letter, outbox | `docs/architecture/realtime-queue.md` | CÃ³ máº«u event `MessageCreated`, `NotificationRequested` | P0 |
| 0 | Security baseline | Quy Ä‘á»‹nh password hash, JWT, refresh token, API token hash, webhook signature | `docs/architecture`, `internal/shared/auth` | CÃ³ checklist báº£o máº­t backend | P0 |
| 1 | Go module | Khá»Ÿi táº¡o `go.mod`, chá»n module path, thÃªm Gin, config, logger, validator, migration lib | `backend/go.mod` | `go test ./...` cháº¡y Ä‘Æ°á»£c | P0 |
| 1 | Entrypoint API | Táº¡o `cmd/api/main.go`, bootstrap app, router, middleware base, graceful shutdown | `backend/cmd/api`, `internal/bootstrap` | Cháº¡y API server local | P0 |
| 1 | Entrypoint worker | Táº¡o `cmd/worker/main.go`, bootstrap worker, signal handling | `backend/cmd/worker`, `internal/bootstrap` | Worker start/stop sáº¡ch | P0 |
| 1 | Config | Äá»c env, validate config, tÃ¡ch config API/worker/database/redis/rabbitmq/storage | `internal/config` | Thiáº¿u env quan trá»ng thÃ¬ fail rÃµ | P0 |
| 1 | Shared response | Chuáº©n hÃ³a response success/error, request id, error mapping | `internal/shared/response`, `errors` | Handler tráº£ format thá»‘ng nháº¥t | P0 |
| 1 | Health base | `/health`, `/ready`, `/version` | `health`, `bootstrap` | Docker healthcheck dÃ¹ng Ä‘Æ°á»£c | P0 |
| 2 | PostgreSQL adapter | Connection pool, transaction manager, migration runner, repository helper | `internal/platform/database` | Káº¿t ná»‘i DB qua Compose | P0 |
| 2 | Redis adapter | Redis client, cache helper, lock helper, rate limit storage | `internal/platform/redis` | Ping Redis vÃ  set/get smoke test | P1 |
| 2 | RabbitMQ adapter | Connection, exchange, queue, publisher, consumer, retry, dead letter | `internal/platform/rabbitmq` | Publish/consume event test | P0 |
| 2 | Storage adapter | Interface storage, Local, MinIO, presigned URL, object metadata | `internal/platform/storage` | Upload/download qua MinIO local | P0 |
| 2 | WebSocket manager | Hub, client, room, auth handshake, broadcast, presence hook | `internal/platform/websocket` | Káº¿t ná»‘i WebSocket local | P0 |
| 2 | Logger/monitoring base | Structured log, request log, panic recover, metrics interface | `internal/platform/logger`, `monitoring` | Log cÃ³ request id vÃ  user id náº¿u cÃ³ | P1 |
| 3 | Auth domain | Entity/session/token, password hash, refresh token hash | `modules/auth/domain` | Unit test auth rule | P0 |
| 3 | Auth API | Register/login/logout/refresh/me, JWT middleware | `modules/auth/delivery/http` | Login nháº­n access/refresh token | P0 |
| 3 | Users module | CRUD user, profile, avatar id, status, last seen | `modules/users` | Admin/user Ä‘á»c há»“ sÆ¡ Ä‘Æ°á»£c | P0 |
| 3 | RBAC | Permission, role, role assignment, policy checker | `modules/auth`, `modules/admin` | Route kiá»ƒm tra permission Ä‘Ãºng | P0 |
| 3 | Session management | Danh sÃ¡ch session, revoke device, revoke all | `user_sessions` | Logout vÃ  revoke token hoáº¡t Ä‘á»™ng | P1 |
| 3 | Audit auth | Ghi audit login/logout/role change | `modules/audit` | Audit cÃ³ before/after data khi Ä‘á»•i quyá»n | P1 |
| 4 | Workspace | Táº¡o/sá»­a/xÃ³a má»m workspace, member, invite, settings | `modules/workspace` | Táº¡o workspace vÃ  invite member | P0 |
| 4 | Department | CRUD department, department member | `modules/department` | GÃ¡n user vÃ o phÃ²ng ban | P1 |
| 4 | Channel | Public/private channel, archive, member, permission | `modules/channel` | Táº¡o channel vÃ  join/leave | P0 |
| 4 | Direct message | Táº¡o DM 1-1, group DM, participant key, member list | `direct_conversations`, `modules/channel` | Táº¡o DM khÃ´ng bá»‹ trÃ¹ng participant | P0 |
| 4 | Channel read state | Cáº­p nháº­t `last_read_at`, `last_read_message_id` | `channel_members` | Unread count tÃ­nh Ä‘Æ°á»£c | P0 |
| 5 | Message command | Send/edit/delete message, validation, permission, transaction | `modules/messages` | Gá»­i message text vÃ o channel | P0 |
| 5 | Message query | List timeline, cursor pagination, thread replies | `modules/messages` | Timeline nhanh theo index | P0 |
| 5 | Reaction/mention | Add/remove reaction, parse mention, ghi event Ä‘á»ƒ phase notification xá»­ lÃ½ | `message_reactions`, `message_mentions` | Mention Ä‘Æ°á»£c lÆ°u vÃ  event Ä‘Æ°á»£c ghi vÃ o outbox | P0 |
| 5 | Thread | `parent_id`, `thread_root_id`, list thread khÃ´ng recursive query | `messages` | Reply nhiá»u cáº¥p váº«n truy váº¥n theo root | P1 |
| 5 | WebSocket event | MessageCreated/Updated/Deleted, ReactionChanged qua outbox ná»n; Typing, Presence ná»‘i á»Ÿ phase realtime sau | `platform/websocket`, `modules/messages` | Event message Ä‘Æ°á»£c ghi bá»n vá»¯ng Ä‘á»ƒ worker broadcast | P0 |
| 5 | Search message | Full text search message báº±ng `search_vector` | `messages`, `search_documents` | TÃ¬m message khÃ´ng dÃ¹ng LIKE | P1 |
| 6 | File upload | Upload multipart, save metadata, checksum, MIME validation | `modules/files`, `platform/storage` | Upload file vÃ o local storage | P0 |
| 6 | File download | Stream file, permission check, private object | `modules/files` | Chá»‰ member cÃ³ quyá»n táº£i file | P0 |
| 6 | Attachment | Gáº¯n file vÃ o message, list attachment | `message_attachments`, `modules/files` | Gá»­i message cÃ³ file | P0 |
| 6 | File version | Táº¡o version má»›i cho avatar/logo/document | `file_versions`, `modules/files` | File cÃ³ version_number tÄƒng Ä‘Ãºng | P1 |
| 6 | File worker | Preview/image metadata/cleanup failed upload | `modules/file/worker` | Worker xá»­ lÃ½ file event | P2 |
| 7 | Outbox publisher | Láº¥y `outbox_events`, publish RabbitMQ, retry/dead | `outbox_events`, `platform/rabbitmq` | Event DB Ä‘Æ°á»£c publish an toÃ n | P0 |
| 7 | Notification service | Táº¡o notification tá»« mention/message/invite/system | `modules/notification` | Notification unread hoáº¡t Ä‘á»™ng | P0 |
| 7 | Notification jobs | Táº¡o job desktop/push/email/webhook/SMS, retry | `notification_jobs` | Job pending Ä‘Æ°á»£c worker xá»­ lÃ½ | P0 |
| 7 | Presence | Update heartbeat, online/away/offline, multi-node socket | `user_presence`, `websocket` | Presence khÃ´ng phá»¥ thuá»™c memory Ä‘Æ¡n node | P1 |
| 7 | Worker framework | Consumer registry, graceful shutdown, concurrency, idempotency | `cmd/worker`, `bootstrap/worker.go` | Worker cháº¡y nhiá»u consumer | P0 |
| 8 | API token | Token hash, scope, revoke, last used, permission middleware | `modules/api_token` | API token gá»i endpoint Ä‘Æ°á»£c phÃ©p | P0 |
| 8 | Incoming webhook | Endpoint nháº­n webhook, verify secret, map thÃ nh message/event | `modules/webhook` | Webhook gá»­i tin vÃ o channel | P0 |
| 8 | Outgoing webhook | Subscribe event, delivery log, signature, retry/dead | `webhook_deliveries` | Event message gá»i target URL | P0 |
| 8 | Bot module | Bot CRUD, bot installation, bot message sender | `modules/bot` | Bot gá»­i message vÃ o channel | P0 |
| 8 | Server alert API | API gá»­i alert vÃ o channel báº±ng token/webhook | `modules/webhook`, `message` | Gá»­i server alert thÃ nh message | P1 |
| 9 | Cronjob manager | CRUD cron job, schedule parser, next run, lock trÃ¡nh cháº¡y trÃ¹ng | `modules/cronjob`, `scheduler` | Job cháº¡y Ä‘Ãºng lá»‹ch | P0 |
| 9 | Cron job runs | Log tá»«ng láº§n cháº¡y, status, error, duration | `cron_job_runs` | Admin xem lá»‹ch sá»­ job | P0 |
| 9 | Module runner MVP | Cháº¡y HTTP API, bash/script Ä‘Æ°á»£c allowlist, log output | `modules/cronjob`, `platform/scheduler` | Cháº¡y job máº«u ticket/server alert | P1 |
| 9 | Cleanup jobs | Cleanup session háº¿t háº¡n, outbox dead, upload lá»—i, old presence | `worker` | Job cleanup khÃ´ng xÃ³a nháº§m dá»¯ liá»‡u sá»‘ng | P1 |
| 10 | Admin API | Dashboard stats, user/workspace/channel/bot/webhook management | `modules/admin` | Admin panel cÃ³ API ná»n | P0 |
| 10 | Audit API | List/filter audit log, view before/after data | `modules/audit` | Filter theo actor/entity/action | P0 |
| 10 | Health deep check | Check DB, Redis, RabbitMQ, MinIO, queue depth | `modules/health` | `/ready` pháº£n Ã¡nh phá»¥ thuá»™c tháº­t | P0 |
| 10 | Backup database | Job backup PostgreSQL, lÆ°u local/MinIO/S3, metadata run | `modules/backup`, `deploy/scripts` | Táº¡o backup vÃ  ghi `backup_runs` | P0 |
| 10 | Restore test | Script restore dev/staging, tÃ i liá»‡u thao tÃ¡c | `deploy/scripts`, `docs` | Restore backup thá»­ thÃ nh cÃ´ng | P1 |
| 11 | Test suite | Unit domain/application, integration repository, API contract test | `backend/test`, tá»«ng module | CI cháº¡y test á»•n Ä‘á»‹nh | P0 |
| 11 | Security hardening | Rate limit, CORS, secure headers, JWT rotation, webhook signature | `middleware`, `shared/auth` | Endpoint nháº¡y cáº£m cÃ³ báº£o vá»‡ | P0 |
| 11 | Performance | Index review, pagination, WebSocket load test, queue throughput | `test`, `docs/performance` | CÃ³ baseline latency/throughput | P1 |
| 11 | Observability | Prometheus metrics, structured log, tracing hook, dashboard máº«u | `platform/monitoring`, `deploy` | CÃ³ metric API/queue/ws | P1 |
| 11 | Error handling | Chuáº©n hÃ³a domain error, retryable/non-retryable, alert khi dead queue tÄƒng | `shared/errors`, `rabbitmq` | Lá»—i production dá»… Ä‘iá»u tra | P0 |
| 12 | Dockerfile | Multi-stage Dockerfile cho API vÃ  worker | `backend/Dockerfile` | Build image API/worker thÃ nh cÃ´ng | P0 |
| 12 | Compose production | HoÃ n thiá»‡n compose prod, env, healthcheck, volumes, backup | `deploy/docker` | Server cháº¡y báº±ng compose | P0 |
| 12 | GitHub Actions | CI, Docker build, deploy staging/production, environment approval | `.github/workflows` | Deploy tá»« GitHub Actions | P0 |
| 12 | Demo ná»™i bá»™ | Deploy `chat.vpsttt.com`, táº¡o workspace demo, seed user/kÃªnh | `deploy`, `db/seed` | Demo ná»™i bá»™ dÃ¹ng Ä‘Æ°á»£c | P0 |
| 12 | TÃ i liá»‡u open-source backend | README tiáº¿ng Viá»‡t, Ubuntu/AlmaLinux guide, API/webhook/module docs | `README.md`, `docs` | NgÆ°á»i khÃ¡c tá»± deploy Ä‘Æ°á»£c | P1 |

## Thá»© tá»± module nÃªn lÃ m

| Thá»© tá»± | Module | LÃ½ do Æ°u tiÃªn |
|---|---|---|
| 1 | `health`, `config`, `shared`, `bootstrap` | LÃ  ná»n Ä‘á»ƒ má»i module khÃ¡c cháº¡y Ä‘Æ°á»£c |
| 2 | `auth`, `users` | Cáº§n xÃ¡c thá»±c trÆ°á»›c khi cÃ³ workspace/channel |
| 3 | `workspace`, `department`, `admin` ná»n | Cáº§n tenant vÃ  quyá»n quáº£n trá»‹ |
| 4 | `channel` vÃ  direct message | Cáº§n kÃªnh trÆ°á»›c khi gá»­i message |
| 5 | `message` vÃ  WebSocket | LÃµi sáº£n pháº©m chat |
| 6 | `file` | MVP cáº§n upload áº£nh/file |
| 7 | `notification`, `audit` | Bá»• sung tráº£i nghiá»‡m realtime vÃ  truy váº¿t |
| 8 | `api_token`, `webhook`, `bot` | TÃ­ch há»£p há»‡ thá»‘ng ngoÃ i |
| 9 | `cronjob`, `backup` | Váº­n hÃ nh tá»± Ä‘á»™ng |
| 10 | `health` nÃ¢ng cao vÃ  monitoring | Chuáº©n bá»‹ deploy tháº­t |

## Milestone Ä‘á» xuáº¥t

| Milestone | Ná»™i dung | Backend cÃ³ thá»ƒ demo |
|---|---|---|
| M1 | API server, DB, Redis, RabbitMQ, MinIO, health, migration | Cháº¡y Ä‘Æ°á»£c háº¡ táº§ng backend local |
| M2 | Auth, user, workspace, RBAC | ÄÄƒng nháº­p vÃ  táº¡o workspace |
| M3 | Channel, DM, message, WebSocket | Chat realtime 1-1/nhÃ³m/kÃªnh |
| M4 | File, notification, worker, outbox | Gá»­i file vÃ  nháº­n notification |
| M5 | Bot, token, webhook, cronjob | TÃ­ch há»£p server alert/ticket máº«u |
| M6 | Admin, audit, backup, health deep check | Quáº£n trá»‹ vÃ  váº­n hÃ nh backend |
| M7 | Hardening, CI/CD, Docker Compose production | Deploy server demo |

## Definition of Done cho má»—i phase

- Code theo Ä‘Ãºng Clean Architecture cá»§a module.
- CÃ³ migration hoáº·c seed náº¿u thay Ä‘á»•i database.
- CÃ³ unit test cho domain/application quan trá»ng.
- CÃ³ integration test cho repository hoáº·c adapter quan trá»ng.
- CÃ³ API docs hoáº·c OpenAPI stub cho endpoint má»›i.
- CÃ³ log, error mapping vÃ  permission check.
- Ná»™i dung log trong code pháº£i viáº¿t báº±ng tiáº¿ng Viá»‡t cÃ³ dáº¥u.
- CÃ³ cáº­p nháº­t tÃ i liá»‡u náº¿u thÃªm quy Æ°á»›c hoáº·c luá»“ng má»›i.
- CI khÃ´ng Ä‘á» vÃ¬ thay Ä‘á»•i cá»§a phase Ä‘Ã³.

## Nhá»¯ng viá»‡c chÆ°a lÃ m trong backend trÆ°á»›c khi qua frontend

- ChÆ°a báº¯t Ä‘áº§u UI web/admin.
- Chá»‰ táº¡o OpenAPI, mock response hoáº·c Postman collection Ä‘á»ƒ frontend chuáº©n bá»‹ sau.
- Chá»‰ lÃ m seed/demo data tá»‘i thiá»ƒu Ä‘á»ƒ test backend.
- Chá»‰ táº¡o endpoint admin cáº§n thiáº¿t; giao diá»‡n admin panel sáº½ lÃ m sau khi backend á»•n.

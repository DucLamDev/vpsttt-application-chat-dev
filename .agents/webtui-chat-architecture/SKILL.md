---
name: webtui-chat-architecture
description: Hướng dẫn agent thiết kế, sinh code, rà soát, mở rộng và cập nhật tri thức dự án WebTui Chat theo Clean Architecture, modular monolith Go + Gin, WebSocket realtime, RabbitMQ worker, PostgreSQL, Redis, MinIO/S3 và tài liệu tiếng Việt có dấu. Dùng khi làm việc với backend, frontend, deploy, module mới, kiến trúc dự án, OpenAPI, tài liệu hoặc khi có chức năng mới cần cập nhật agent skill/references.
---

# WebTui Chat Architecture

Luôn bám kiến trúc trong `CleanArchitecture.md` và các tài liệu ở `docs/architecture/`.

## Quy trình làm việc

1. Đọc tài liệu liên quan trước khi sửa kiến trúc hoặc sinh module:
   - `CleanArchitecture.md`
   - `docs/architecture/source-layout.md`
   - `docs/architecture/backend-clean-architecture.md`
   - `docs/architecture/module-template.md`
   - `docs/architecture/realtime-queue.md` nếu có WebSocket, RabbitMQ hoặc worker.
   - `docs/architecture/operations.md` nếu có deploy, CI/CD, backup hoặc monitoring.
   - `docs/architecture/cicd-github-actions-docker-compose.md` nếu có GitHub Actions hoặc Docker Compose.
   - `docs/deploy/vps-production.md` nếu có deploy VPS, domain production, GitHub Secrets, TLS hoặc CloudAMQP.
   - `docs/deploy/cicd.md` nếu người dùng cần hướng dẫn từng bước từ SSH key, GitHub Actions, VPS, `.env`, PostgreSQL đến kiểm thử deploy.
   - `docs/database/postgresql-design.md` nếu có schema, migration hoặc repository PostgreSQL.
   - `backend/api/openapi/openapi.yaml` nếu có endpoint mới hoặc đang chuẩn bị frontend.
   - `backend/docs/files.md` nếu có upload, download, attachment, Local/MinIO/S3.
   - `backend/docs/notifications-worker-presence.md` nếu có outbox, notification, worker hoặc presence.
   - `backend/docs/integrations-phase-8.md` nếu có API token, bot, incoming webhook hoặc outgoing webhook.
   - `backend/docs/cronjobs-phase-9.md` nếu có cronjob, scheduler, module runner hoặc cleanup job.
   - `backend/docs/admin-audit-backup-phase-10.md` nếu có admin API, audit log, health deep check, backup hoặc restore.
   - `backend/docs/hardening-observability-phase-11.md` nếu có CORS, rate limit, security headers, metrics, monitoring hoặc hardening.
   - `docs/planning/backend-roadmap.md` nếu cần biết phase nào đã hoàn thành.
2. Giữ backend theo modular monolith, chưa tách microservice nếu người dùng không yêu cầu rõ.
3. Với module backend, tạo đủ ranh giới `domain`, `application`, `infrastructure`, `delivery` và `worker` khi phù hợp.
4. Không để `domain` phụ thuộc Gin, SQL driver, Redis, RabbitMQ, MinIO/S3 hoặc SDK hệ thống ngoài.
5. Handler và worker chỉ gọi application service/use case, không đi thẳng xuống repository.
6. Tài liệu mới trong repo phải viết bằng tiếng Việt có dấu.
7. Mọi nội dung log trong code phải viết bằng tiếng Việt có dấu; nghiêm cấm dùng tiếng Việt không dấu trong log.
8. Sau mỗi lần thêm hoặc đổi chức năng quan trọng, phải cập nhật `.agents/webtui-chat-architecture/SKILL.md` hoặc `references/architecture.md` để agent sau đọc được ngữ cảnh mới; nếu thay đổi cách skill được gọi hoặc mô tả hiển thị, cập nhật thêm `agents/openai.yaml`.

## Khi tạo module backend

- Bắt đầu từ `domain` và `application`.
- Định nghĩa repository hoặc publisher bằng interface.
- Hiện thực PostgreSQL, Redis, RabbitMQ hoặc storage trong `infrastructure`.
- Đặt HTTP/WebSocket handler trong `delivery`.
- Đặt consumer hoặc job trong `worker`.
- Cập nhật tài liệu nếu module tạo ra quy ước mới.

## Khi làm realtime hoặc queue

- WebSocket manager là platform dùng chung, không để từng module tự quản lý connection.
- Event quan trọng phải idempotent và có retry/dead letter.
- API server trả response nhanh, tác vụ nặng chuyển sang worker.

## Tài liệu tham khảo ngắn

Đọc `references/architecture.md` khi cần bản tóm tắt nhanh các ranh giới kiến trúc, trạng thái phase backend và API backend đã có để chuẩn bị làm frontend.

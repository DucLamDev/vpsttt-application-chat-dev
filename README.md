# WebTui Chat Backend

Đây là repository thiết kế kiến trúc cho WebTui Chat theo hướng Go + Gin, Clean Architecture, WebSocket realtime, RabbitMQ cho bất đồng bộ, PostgreSQL/Redis/MinIO cho dữ liệu và GitHub Actions cho CI/CD.

## Tài liệu chính

- [CleanArchitecture.md](CleanArchitecture.md): bản thiết kế tổng quan.
- [docs/README.md](docs/README.md): mục lục tài liệu dự án.
- [docs/architecture/source-layout.md](docs/architecture/source-layout.md): cấu trúc thư mục nguồn.
- [docs/architecture/backend-clean-architecture.md](docs/architecture/backend-clean-architecture.md): quy tắc Clean Architecture cho backend.
- [docs/architecture/module-template.md](docs/architecture/module-template.md): chuẩn tạo module mới.
- [docs/architecture/realtime-queue.md](docs/architecture/realtime-queue.md): WebSocket, RabbitMQ và worker.
- [docs/architecture/operations.md](docs/architecture/operations.md): vận hành, deploy, backup và monitoring.
- [docs/architecture/cicd-github-actions-docker-compose.md](docs/architecture/cicd-github-actions-docker-compose.md): luồng CI/CD với GitHub Actions và Docker Compose.
- [docs/deploy/vps-production.md](docs/deploy/vps-production.md): hướng dẫn deploy production lên VPS với `api.vpsttt.com`.
- [docs/database/postgresql-design.md](docs/database/postgresql-design.md): thiết kế database PostgreSQL.
- [docs/planning/backend-roadmap.md](docs/planning/backend-roadmap.md): kế hoạch chi tiết để hoàn thiện backend trước frontend.
- [backend/docs/api-convention.md](backend/docs/api-convention.md): quy ước API backend.
- [backend/docs/event-convention.md](backend/docs/event-convention.md): quy ước event và queue.
- [backend/docs/security-baseline.md](backend/docs/security-baseline.md): checklist bảo mật backend.
- [backend/docs/auth-rbac.md](backend/docs/auth-rbac.md): contract auth, user và RBAC phase 3.
- [backend/docs/workspace-channel.md](backend/docs/workspace-channel.md): contract workspace, phòng ban, kênh và direct message phase 4.
- [backend/docs/local-run.md](backend/docs/local-run.md): hướng dẫn chạy backend local với database.
- [backend/db/migrations/000001_initial_schema.up.sql](backend/db/migrations/000001_initial_schema.up.sql): migration schema nền.

## Quy ước tài liệu

Mọi tài liệu trong repository cần viết bằng tiếng Việt có dấu, ưu tiên diễn đạt rõ trách nhiệm, luồng dữ liệu và quy tắc phụ thuộc thay vì mô tả chung chung.

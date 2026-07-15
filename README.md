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
- [docs/deploy/vps-production.md](docs/deploy/vps-production.md): hướng dẫn deploy production lên VPS với `chat.vpsttt.com`.
- [docs/database/postgresql-design.md](docs/database/postgresql-design.md): thiết kế database PostgreSQL.
- [docs/planning/backend-roadmap.md](docs/planning/backend-roadmap.md): kế hoạch chi tiết để hoàn thiện backend trước frontend.
- [backend/docs/api-convention.md](backend/docs/api-convention.md): quy ước API backend.
- [backend/docs/event-convention.md](backend/docs/event-convention.md): quy ước event và queue.
- [backend/docs/security-baseline.md](backend/docs/security-baseline.md): checklist bảo mật backend.
- [backend/docs/auth-rbac.md](backend/docs/auth-rbac.md): contract auth, user và RBAC phase 3.
- [backend/docs/workspace-channel.md](backend/docs/workspace-channel.md): contract workspace, phòng ban, kênh và direct message phase 4.
- [backend/docs/order-bot-phase1.md](backend/docs/order-bot-phase1.md): tích hợp Order Bot VPSTTT Phase 1.
- [backend/docs/local-run.md](backend/docs/local-run.md): hướng dẫn chạy backend local với database.
- [backend/db/migrations/000001_initial_schema.up.sql](backend/db/migrations/000001_initial_schema.up.sql): migration schema nền.

## Quy ước tài liệu

Mọi tài liệu trong repository cần viết bằng tiếng Việt có dấu, ưu tiên diễn đạt rõ trách nhiệm, luồng dữ liệu và quy tắc phụ thuộc thay vì mô tả chung chung.

## Cấu hình đăng nhập Google

Tạo OAuth 2.0 Client ID loại **Web application** trong Google Cloud Console và thêm các JavaScript origin được phép, ví dụ `http://localhost:3000` và `https://chat.vpsttt.com`. Sau đó đặt cùng Client ID vào:

```env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

Backend xác minh Google ID token trước khi tạo hoặc liên kết tài khoản. Khi build image web bằng GitHub Actions, khai báo repository variable `GOOGLE_CLIENT_ID` để giá trị public này được nhúng vào frontend.

## Tự động vào workspace sau đăng ký

Tài khoản mới được cấp role hệ thống `workspace_member` và tham gia các kênh public thông thường ngay sau khi đăng ký. Với production có nhiều workspace active, phải cấu hình rõ workspace nhận người dùng mới:

```env
REGISTRATION_DEFAULT_WORKSPACE_ID=3f1e32b9-0a2f-4ca1-b0dc-04221a551c1c
```

Nếu hệ thống chỉ có đúng một workspace active, backend tự nhận diện workspace đó. Luồng này không tự cấp `workspace_admin`, `workspace_owner` hoặc quyền truy cập phiên bot riêng tư. Tài khoản đã bị quản trị viên vô hiệu hóa membership cũng không được tự kích hoạt lại khi đăng nhập.

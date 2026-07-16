# Cấu trúc thư mục nguồn

Repository dùng cấu trúc gần monorepo để backend, frontend, deploy và tài liệu đi cùng một vòng đời phát hành. Nếu sau này tách repository, các ranh giới dưới đây vẫn giữ nguyên.

## Tổng quan

```text
.
├── backend/
├── frontend/
├── deploy/
├── docs/
├── .agents/
├── .github/
├── CleanArchitecture.md
└── Task_list.md
```

## Backend

Backend đặt trong `backend/`, dùng Go + Gin và chỉ export entrypoint qua `cmd/`.

```text
backend/
├── api/
│   └── openapi/
├── cmd/
│   ├── api/
│   └── worker/
├── configs/
├── deployments/
├── db/
│   ├── migrations/
│   ├── seed/
│   └── schema/
├── docs/
├── internal/
│   ├── bootstrap/
│   ├── config/
│   ├── platform/
│   ├── shared/
│   └── modules/
├── pkg/
├── scripts/
├── test/
├── Dockerfile
└── go.mod
```

Quy ước chính:

- `cmd/api` khởi động HTTP/WebSocket API server.
- `cmd/worker` khởi động queue consumer, cronjob và background job.
- `internal/bootstrap` nối dependency, provider, router, module và worker.
- `internal/config` đọc biến môi trường và cấu hình runtime.
- `internal/platform` chứa adapter kỹ thuật dùng chung như PostgreSQL, Redis, RabbitMQ, WebSocket, storage, logger, scheduler và monitoring.
- `internal/shared` chứa thành phần dùng chung nhưng không chứa nghiệp vụ module.
- `internal/modules` chứa từng module nghiệp vụ theo Clean Architecture.
- `pkg` chỉ dùng khi có thư viện Go cần public ra ngoài `internal`.

## Module backend

Mỗi module trong `backend/internal/modules/<module>/` có cùng cấu trúc:

```text
<module>/
├── domain/
├── application/
├── infrastructure/
│   ├── postgres/
│   ├── redis/
│   ├── rabbitmq/
│   └── storage/
├── delivery/
│   ├── http/
│   └── websocket/
└── worker/
```

Danh sách module mục tiêu:

- `auth`
- `users`
- `workspace`
- `department`
- `channel`
- `message`
- `notification`
- `webhook`
- `bot`
- `file`
- `api_token`
- `cronjob`
- `audit`
- `admin`
- `health`
- `backup`

## Frontend

Frontend đặt trong `frontend/` theo mô hình workspace.

```text
frontend/
├── apps/
│   ├── web/
│   └── admin/
├── packages/
│   ├── api-client/
│   ├── config/
│   ├── icons/
│   ├── types/
│   └── ui/
└── tests/
```

Quy ước chính:

- `apps/web` tập trung trải nghiệm chat của người dùng.
- `apps/admin` tập trung quản trị user, workspace, bot, webhook và system health.
- `packages/api-client` chứa REST/WebSocket client typed.
- `packages/ui` chứa component dùng chung, ưu tiên shadcn/ui.
- `packages/types` chứa DTO và type dùng chung với API contract.

## Deploy

`deploy/` chứa cấu hình vận hành độc lập với source app.

```text
deploy/
├── docker/
├── nginx/templates/
├── postgres/
├── redis/
├── rabbitmq/
├── minio/
├── prometheus/
├── grafana/
├── loki/
├── scripts/
└── k8s/
```

Secret thật luôn nằm ở `.env` trên server hoặc GitHub Secrets, không commit vào repository.


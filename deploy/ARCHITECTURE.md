# Kiến trúc triển khai

Thư mục `deploy/` chứa cấu hình vận hành cho môi trường dev, staging và production.

## Thành phần

- `docker`: Dockerfile, compose fragment hoặc image config.
- `nginx/templates`: cấu hình reverse proxy, SSL, routing API và WebSocket.
- `.env.example`: mẫu biến môi trường production, không chứa secret thật.
- `postgres`: cấu hình PostgreSQL, backup và restore.
- `redis`: cấu hình Redis.
- `rabbitmq`: production dùng CloudAMQP qua `RABBITMQ_URL=amqps://...`.
- `minio`: production dùng MinIO/S3 ngoài VPS qua `S3_ENDPOINT`.
- `prometheus`: cấu hình metric scraping.
- `grafana`: dashboard.
- `loki`: log aggregation.
- `scripts`: script deploy, TLS, backup, restore và health check.
- `k8s`: manifest Kubernetes khi cần.

## Quy tắc

- Secret thật không được commit.
- Cấu hình production phải có backup và monitoring.
- Deploy phải có health check sau khi restart.
- Migration phải có đường rollback hoặc kế hoạch khôi phục dữ liệu.

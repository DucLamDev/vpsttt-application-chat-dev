# Kiến trúc triển khai

Thư mục `deploy/` chứa cấu hình vận hành cho môi trường dev, staging và production.

## Thành phần

- `docker`: Dockerfile, compose fragment hoặc image config.
- `caddy`: reverse proxy mặc định cho custom domain và on-demand TLS.
- `nginx/templates`: reverse proxy/certbot tĩnh cho deployment legacy.
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
- Custom domain chỉ được Caddy cấp TLS khi internal ask endpoint xác nhận domain
  active trong `zone_domains`.
- API phải resolve zone từ Host và đối chiếu với zone trong token trước khi truy
  cập resource.

## TLS proxy mode

Production custom-domain dùng:

```env
TLS_PROXY_MODE=caddy
LETSENCRYPT_EMAIL=admin@example.com
CADDY_ASK_SECRET=<random-secret>
```

`deploy/caddy/Caddyfile` nhận mọi HTTPS hostname nhưng Caddy chỉ xin certificate
sau khi `/internal/tenancy/caddy-ask` trả 204. API endpoint này fail-closed nếu
secret sai, domain không hợp lệ, chưa verify hoặc đã suspend.

Mode `TLS_PROXY_MODE=nginx` chỉ dành cho cấu hình certificate tĩnh hiện có.

## OIDC SSO theo zone

Runtime OIDC cần:

```env
OIDC_STATE_SECRET=<random-secret-at-least-32-characters>
OIDC_CLIENT_SECRETS=company-sso=<client-secret>;partner-sso=<client-secret>
```

Mỗi provider chỉ lưu alias như `env://company-sso`. Capability `sso` chỉ bật cho
zone active có provider configured và alias resolve được. Redirect URI tại IdP
là `https://<zone-domain>/api/v1/auth/oidc/callback`.

## Shared và dedicated

- `shared`: mọi customer dùng cùng app/database, tách logic bằng `zone_id`,
  storage bucket và Redis prefix.
- `dedicated_compose` và `dedicated_k8s`: mới là metadata contract ở Phase 4;
  cần provisioning worker ở phase hạ tầng tiếp theo trước khi dùng production.

Backend đăng ký cả `/ws` và `/api/v1/ws`. Caddy/Nginx vẫn rewrite `/ws` để
tương thích, nhưng deploy trực tiếp API không còn phụ thuộc reverse-proxy rewrite.
Ở local development, discovery ưu tiên zone `vpsttt_internal` duy nhất nếu không
cấu hình `REGISTRATION_DEFAULT_WORKSPACE_ID`.

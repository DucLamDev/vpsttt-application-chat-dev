# Kiến trúc triển khai

Thư mục `deploy/` chứa cấu hình vận hành cho môi trường dev, staging và production.

Kiến trúc mặc định là `self_hosted`: mỗi customer vận hành một stack vật lý
riêng trong `deploy/self-hosted`. Các cấu hình dynamic domain/shared zone bên
dưới chỉ còn phục vụ migration của deployment SaaS cũ.

## Thành phần

- `self-hosted`: stack chuẩn cho customer, gồm Compose, Caddy TLS tĩnh, coturn,
  installer và công cụ backup/restore/update.
- `docker`: Dockerfile, compose fragment hoặc image config dùng chung.
- `caddy`: reverse proxy on-demand TLS của deployment SaaS cũ.
- `nginx/templates`: reverse proxy/certbot tĩnh của deployment SaaS cũ.
- `.env.example`: mẫu biến môi trường của deployment SaaS cũ; bản customer dùng
  `self-hosted/.env.example`.
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

## Tương thích SaaS cũ

Các mục từ phần này đến trước phần `Shared và dedicated` chỉ mô tả deployment SaaS
cũ. Chúng không được đăng ký khi backend chạy mặc định với
`DEPLOYMENT_MODE=self_hosted`.

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

## Routing cùng domain

Mỗi domain active là một zone logic độc lập nhưng dùng cùng edge. Browser luôn gọi cùng
origin để không phải tạo subdomain API riêng:

| URL | Upstream |
| --- | --- |
| `https://customer.example/` | Web |
| `https://customer.example/api` và `/api/*` | API |
| `https://customer.example/.well-known/vpsttt-chat` | Discovery |
| `wss://customer.example/ws` | Realtime API |
| `https://customer.example/admin` | Admin |

Khi tạo domain claim, API trả hai nhóm bản ghi:

1. A/AAAA `customer.example` trỏ tới `CUSTOM_DOMAIN_DNS_TARGET`.
2. TXT `_vpsttt-chat.customer.example` chứa challenge xác minh ownership.

Chỉ sau khi TXT hợp lệ, zone/domain mới active. Caddy hỏi API trước khi xin certificate,
do đó hostname chưa active không thể làm phát sinh certificate. Nginx giữ vai trò proxy
dự phòng cho các hostname có certificate tĩnh và dùng cùng quy tắc route `/api`.

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

- `self_hosted`/`dedicated_compose`: mode mặc định và đã có stack production.
  Mỗi instance có database, cache, queue, storage, TLS và TURN riêng.
- `shared`: mode tương thích deployment SaaS cũ, không dùng để onboard customer
  mới.
- `dedicated_k8s`: contract mở rộng cho operator cần Kubernetes; không phải
  dependency của bản cài Compose.

Backend đăng ký cả `/ws` và `/api/v1/ws`. Caddy/Nginx vẫn rewrite `/ws` để
tương thích, nhưng deploy trực tiếp API không còn phụ thuộc reverse-proxy rewrite.
Ở local development, discovery ưu tiên zone `vpsttt_internal` duy nhất nếu không
cấu hình `REGISTRATION_DEFAULT_WORKSPACE_ID`.

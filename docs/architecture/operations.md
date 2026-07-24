# Váº­n hÃ nh vÃ  triá»ƒn khai

Má»¥c tiÃªu váº­n hÃ nh lÃ  cÃ³ thá»ƒ build, test, deploy, rollback vÃ  quan sÃ¡t há»‡ thá»‘ng má»™t cÃ¡ch láº·p láº¡i Ä‘Æ°á»£c.

## MÃ´i trÆ°á»ng

- `dev`: cháº¡y local báº±ng Docker Compose hoáº·c service cá»¥c bá»™.
- `staging`: giá»‘ng production nhÆ°ng dá»¯ liá»‡u khÃ´ng pháº£i dá»¯ liá»‡u tháº­t.
- `production`: báº­t backup, monitoring, alert vÃ  cáº¥u hÃ¬nh báº£o máº­t Ä‘áº§y Ä‘á»§.

## CI/CD

Pipeline GitHub Actions má»¥c tiÃªu:

```text
Developer push
-> lint
-> test
-> security scan
-> Docker build
-> push image
-> deploy
-> migration
-> restart service
-> health check
-> notification
```

Workflow nÃªn tÃ¡ch theo trÃ¡ch nhiá»‡m:

- `backend.yml`: lint, test vÃ  build backend.
- `frontend.yml`: lint, typecheck, test vÃ  build frontend.
- `docker.yml`: build vÃ  push image.
- `deploy.yml`: triá»ƒn khai staging/production.
- `release.yml`: táº¡o release tag vÃ  changelog náº¿u cáº§n.

Thiáº¿t káº¿ chi tiáº¿t náº±m á»Ÿ [CI/CD vá»›i GitHub Actions vÃ  Docker Compose](cicd-github-actions-docker-compose.md).

## Docker vÃ  háº¡ táº§ng

`deploy/` chá»©a cáº¥u hÃ¬nh cho:

- API server.
- Worker.
- Nginx.
- PostgreSQL.
- Redis.
- RabbitMQ.
- MinIO.
- Prometheus.
- Grafana.
- Loki.
- AlertManager.

File Compose hiá»‡n táº¡i:

- `deploy/docker/compose.dev.yml`: cháº¡y háº¡ táº§ng local vÃ  cÃ³ profile `app` cho API/worker.
- `deploy/docker/compose.prod.yml`: cháº¡y production báº±ng image Ä‘Ã£ publish, dÃ¹ng PostgreSQL/Redis ná»™i bá»™ VPS, RabbitMQ CloudAMQP vÃ  MinIO/S3 ngoÃ i VPS.
- `deploy/scripts/deploy-compose.sh`: script pull image, cháº¡y migration vÃ  restart service.
- `deploy/scripts/init-letsencrypt.sh`: script khá»Ÿi táº¡o HTTPS cho `chat.vpsttt.com` vÃ  `chat.vpsttt.com`.
- `deploy/.env.example`: máº«u biáº¿n mÃ´i trÆ°á»ng production, khÃ´ng chá»©a secret tháº­t.

## Database

- Migration pháº£i cháº¡y tá»± Ä‘á»™ng trong pipeline deploy hoáº·c báº±ng job riÃªng cÃ³ kiá»ƒm soÃ¡t.
- KhÃ´ng sá»­a migration Ä‘Ã£ cháº¡y trÃªn production.
- Dá»¯ liá»‡u seed chá»‰ dÃ¹ng cho dev/staging, khÃ´ng cháº¡y tá»± Ä‘á»™ng trÃªn production.
- Query Ä‘á»c náº·ng nÃªn Ä‘Æ°á»£c tá»‘i Æ°u trÆ°á»›c khi Ä‘Æ°a sang read replica.

## Backup vÃ  restore

- Backup PostgreSQL theo lá»‹ch.
- Backup file storage theo lá»‹ch.
- LÆ°u backup á»Ÿ Ã­t nháº¥t má»™t nÆ¡i ngoÃ i server chÃ­nh.
- Kiá»ƒm thá»­ restore Ä‘á»‹nh ká»³, vÃ¬ backup chÆ°a Ä‘Æ°á»£c kiá»ƒm thá»­ chÆ°a thá»ƒ xem lÃ  an toÃ n.

## Monitoring

- Prometheus thu metric.
- Grafana hiá»ƒn thá»‹ dashboard.
- Loki lÆ°u log táº­p trung.
- AlertManager gá»­i cáº£nh bÃ¡o.

Metric tá»‘i thiá»ƒu:

- Latency vÃ  error rate cá»§a API.
- Sá»‘ connection WebSocket.
- Sá»‘ message gá»­i/phÃºt.
- Queue depth vÃ  consumer lag.
- Tá»· lá»‡ retry/dead letter.
- CPU, RAM, disk vÃ  network.
- TÃ¬nh tráº¡ng PostgreSQL, Redis, RabbitMQ vÃ  MinIO.

## Báº£o máº­t

- KhÃ´ng commit secret.
- Báº­t TLS á»Ÿ Nginx.
- Báº­t rate limit cho auth, upload, webhook vÃ  API nháº¡y cáº£m.
- Log request cáº§n trÃ¡nh token, password vÃ  secret.
- Webhook cáº§n kÃ½ request hoáº·c dÃ¹ng token riÃªng.
- Admin API cáº§n phÃ¢n quyá»n rÃµ rÃ ng vÃ  audit log.

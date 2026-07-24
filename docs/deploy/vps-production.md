# Deploy production lÃªn VPS

TÃ i liá»‡u nÃ y mÃ´ táº£ luá»“ng deploy backend WebTui Chat lÃªn VPS báº±ng Docker Compose vÃ  GitHub Actions.

Náº¿u cáº§n checklist tá»«ng bÆ°á»›c tá»« táº¡o SSH key, cáº¥u hÃ¬nh GitHub Actions, cÃ i Docker trÃªn VPS, táº¡o `.env`, cháº¡y deploy vÃ  test, Ä‘á»c thÃªm [CI/CD tá»«ng bÆ°á»›c vá»›i GitHub Actions vÃ  Docker Compose](cicd.md).

## ThÃ´ng tin triá»ƒn khai

- API backend: `https://chat.vpsttt.com`
- Frontend: `https://chat.vpsttt.com`
- VPS public IP: lÆ°u trong `vps-info.md`
- User SSH: lÆ°u trong `vps-info.md`
- Runtime backend: API + worker + PostgreSQL + Redis + Nginx
- Queue production: CloudAMQP qua `amqps`
- File storage production: MinIO/S3 ngoÃ i VPS

KhÃ´ng commit máº­t kháº©u VPS, máº­t kháº©u RabbitMQ, secret JWT, secret PostgreSQL hoáº·c secret MinIO vÃ o repo.

## Cáº¥u hÃ¬nh RabbitMQ CloudAMQP

CloudAMQP trÃªn áº£nh dÃ¹ng:

- Host cÃ¢n báº±ng táº£i: `fuji.lmq.cloudamqp.com`
- Vhost: `btrvptkc`
- User: `btrvptkc`
- Port TLS: `5671`
- Scheme: `amqps`

Trong `.env` production trÃªn VPS, cáº¥u hÃ¬nh:

```env
RABBITMQ_ENABLED=true
RABBITMQ_URL=amqps://btrvptkc:THAY_BANG_MAT_KHAU_CLOUDAMQP@fuji.lmq.cloudamqp.com/btrvptkc
```

KhÃ´ng dÃ¹ng container RabbitMQ trong `compose.prod.yml` vÃ¬ production Ä‘ang dÃ¹ng RabbitMQ managed.

## Chuáº©n bá»‹ VPS láº§n Ä‘áº§u

ÄÄƒng nháº­p VPS báº±ng user trong `vps-info.md`, sau Ä‘Ã³ cÃ i Docker Engine vÃ  Docker Compose plugin.

Táº¡o thÆ° má»¥c deploy:

```bash
sudo mkdir -p /opt/webtui-chat
sudo chown -R "$USER":"$USER" /opt/webtui-chat
cd /opt/webtui-chat
```

Copy thÆ° má»¥c `deploy` tá»« repo lÃªn VPS hoáº·c cháº¡y workflow deploy má»™t láº§n Ä‘á»ƒ workflow Ä‘á»“ng bá»™ thÆ° má»¥c nÃ y.

Táº¡o file mÃ´i trÆ°á»ng production:

```bash
cp deploy/.env.example .env
nano .env
```

Cáº§n thay toÃ n bá»™ giÃ¡ trá»‹ báº¯t Ä‘áº§u báº±ng `THAY_BANG_...`, Ä‘áº·c biá»‡t:

- `POSTGRES_PASSWORD`
- `DATABASE_URL`
- `RABBITMQ_URL`
- `S3_SECRET_ACCESS_KEY`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `WEBHOOK_SIGNING_SECRET`
- `WEBTUI_API_IMAGE`
- `WEBTUI_WORKER_IMAGE`

Äá»ƒ tÃ i khoáº£n má»›i sá»­ dá»¥ng chat ngay sau khi Ä‘Äƒng kÃ½, cáº¥u hÃ¬nh workspace máº·c Ä‘á»‹nh trong `.env` production:

```env
REGISTRATION_DEFAULT_WORKSPACE_ID=UUID_WORKSPACE_PRODUCTION
```

Backend chá»‰ gÃ¡n role há»‡ thá»‘ng `workspace_member` vÃ  cÃ¡c kÃªnh public thÃ´ng thÆ°á»ng; khÃ´ng tá»± cáº¥p `workspace_admin`, `workspace_owner` hoáº·c kÃªnh phiÃªn bot riÃªng tÆ°. Náº¿u chá»‰ cÃ³ Ä‘Ãºng má»™t workspace active thÃ¬ backend cÃ³ thá»ƒ tá»± nháº­n diá»‡n, nhÆ°ng production nÃªn khai bÃ¡o UUID rÃµ rÃ ng Ä‘á»ƒ trÃ¡nh chá»n nháº§m khi táº¡o thÃªm workspace.

## Khá»Ÿi táº¡o HTTPS

Sau khi DNS `chat.vpsttt.com` vÃ  `chat.vpsttt.com` Ä‘Ã£ trá» vá» IP VPS, cÃ³ thá»ƒ Ä‘á»ƒ `AUTO_INIT_TLS=true` trong `.env`; deploy script sáº½ tá»± khá»Ÿi táº¡o TLS láº§n Ä‘áº§u. Náº¿u muá»‘n cháº¡y thá»§ cÃ´ng:

```bash
cd /opt/webtui-chat
sh deploy/scripts/init-letsencrypt.sh
```

Script Ä‘á»c `API_DOMAIN`, `FRONTEND_DOMAIN` vÃ  `LETSENCRYPT_EMAIL` tá»« `.env`, táº¡o chá»©ng chá»‰ táº¡m, xin chá»©ng chá»‰ Let's Encrypt tháº­t rá»“i reload Nginx.

Gia háº¡n thá»§ cÃ´ng khi cáº§n:

```bash
cd /opt/webtui-chat
sh deploy/scripts/renew-letsencrypt.sh
```

NÃªn thÃªm cron trÃªn VPS Ä‘á»ƒ gia háº¡n Ä‘á»‹nh ká»³:

```cron
0 3 * * * cd /opt/webtui-chat && sh deploy/scripts/renew-letsencrypt.sh >> /var/log/webtui-certbot.log 2>&1
```

## GitHub Secrets

Trong GitHub Environment `production`, táº¡o secrets:

```text
DEPLOY_HOST=IP_VPS_TRONG_VPS_INFO
DEPLOY_USER=root
DEPLOY_PASSWORD=MAT_KHAU_TRONG_VPS_INFO
DEPLOY_SSH_KEY=
GHCR_USERNAME=GITHUB_USERNAME
GHCR_TOKEN=TOKEN_CO_QUYEN_READ_PACKAGES
```

Khuyáº¿n nghá»‹ sau giai Ä‘oáº¡n Ä‘áº§u: táº¡o SSH key riÃªng cho deploy, Ä‘Æ°a private key vÃ o `DEPLOY_SSH_KEY`, rá»“i bá» `DEPLOY_PASSWORD`.

Repository variables nÃªn cÃ³:

```text
DEPLOY_PATH=/opt/webtui-chat
API_HEALTH_URL=https://chat.vpsttt.com/ready
```

## Luá»“ng CI/CD

1. Push code lÃªn `main`.
2. Workflow `Docker` build vÃ  push image:
   - `ghcr.io/<owner>/<repo>/api:<tag>`
   - `ghcr.io/<owner>/<repo>/worker:<tag>`
   - `ghcr.io/<owner>/<repo>/web:<tag>`
3. Má»Ÿ workflow `Deploy`.
4. Chá»n `environment=production`.
5. Äá»ƒ trá»‘ng `image_tag` Ä‘á»ƒ dÃ¹ng SHA commit hiá»‡n táº¡i, hoáº·c nháº­p `latest`/SHA image Ä‘Ã£ tá»“n táº¡i trÃªn GHCR.
6. Workflow SSH vÃ o VPS, Ä‘á»“ng bá»™ thÆ° má»¥c `deploy`, login GHCR, cháº¡y migration vÃ  `docker compose up -d`.
7. Workflow gá»i health check `https://chat.vpsttt.com/ready`.

LÆ°u Ã½: deploy tá»± Ä‘á»™ng sau workflow `Docker` sáº½ dÃ¹ng tag full SHA cá»§a commit vá»«a build. Náº¿u cháº¡y deploy thá»§ cÃ´ng vÃ  gáº·p `manifest unknown`, image tag Ä‘ang chá»n chÆ°a tá»“n táº¡i; hÃ£y cháº¡y workflow `Docker` trÆ°á»›c rá»“i deploy láº¡i vá»›i tag SHA Ä‘Ã³, hoáº·c chá»‰ dÃ¹ng `latest` sau khi Docker workflow trÃªn `main`/`master` Ä‘Ã£ hoÃ n táº¥t.

## Kiá»ƒm tra sau deploy

```bash
curl -fsS https://chat.vpsttt.com/health
curl -fsS https://chat.vpsttt.com/ready
curl -fsS https://chat.vpsttt.com/version
curl -fsS https://chat.vpsttt.com/metrics
```

Kiá»ƒm tra container:

```bash
cd /opt/webtui-chat
docker compose -f deploy/docker/compose.prod.yml ps
docker compose -f deploy/docker/compose.prod.yml logs --tail=100 api
docker compose -f deploy/docker/compose.prod.yml logs --tail=100 worker
```

## Seed demo ná»™i bá»™

Sau khi API production cháº¡y á»•n, táº¡o user quáº£n trá»‹ vÃ  workspace demo qua API Ä‘á»ƒ Ä‘i Ä‘Ãºng luá»“ng audit/RBAC.

CÃ³ thá»ƒ dÃ¹ng cÃ¡c block trong `backend/docs/local-run.md`, chá»‰ cáº§n Ä‘á»•i base URL:

```powershell
$baseUrl = "https://chat.vpsttt.com"
```

Luá»“ng seed tá»‘i thiá»ƒu:

1. Register user quáº£n trá»‹ Ä‘áº§u tiÃªn.
2. Táº¡o workspace `vpsttt`.
3. Táº¡o channel `thong-bao`, `ky-thuat`, `sale`.
4. Táº¡o bot/server alert náº¿u cáº§n demo tÃ­ch há»£p.
5. Gá»­i má»™t message máº«u Ä‘á»ƒ kiá»ƒm tra WebSocket, notification vÃ  search.

## Rollback

Äá»•i tag image trong `.env` hoáº·c cháº¡y láº¡i workflow `Deploy` vá»›i `image_tag` cÅ©.

Náº¿u migration Ä‘Ã£ thay Ä‘á»•i dá»¯ liá»‡u theo hÆ°á»›ng destructive, cáº§n restore backup hoáº·c cÃ³ káº¿ hoáº¡ch rollback riÃªng.

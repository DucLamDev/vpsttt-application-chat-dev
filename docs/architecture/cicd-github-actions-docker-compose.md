# CI/CD vá»›i GitHub Actions vÃ  Docker Compose

TÃ i liá»‡u nÃ y mÃ´ táº£ luá»“ng CI/CD má»¥c tiÃªu cho WebTui Chat khi triá»ƒn khai lÃªn VPS hoáº·c mÃ¡y chá»§ tá»± quáº£n báº±ng Docker Compose.

## CÆ¡ sá»Ÿ thiáº¿t káº¿

- GitHub Actions lÆ°u workflow trong `.github/workflows`.
- Má»—i workflow gá»“m trigger, job vÃ  step rÃµ rÃ ng.
- Secret triá»ƒn khai lÆ°u trong GitHub Secrets hoáº·c Environment Secrets, khÃ´ng commit vÃ o repo.
- Docker image Ä‘Æ°á»£c build vÃ  push lÃªn GitHub Container Registry.
- Server production dÃ¹ng Docker Compose Ä‘á»ƒ pull image, cháº¡y migration, restart service vÃ  health check.
- Docker Compose dÃ¹ng `healthcheck` vÃ  `depends_on.condition: service_healthy` Ä‘á»ƒ API/worker chá»‰ cháº¡y sau khi PostgreSQL vÃ  Redis ná»™i bá»™ sáºµn sÃ ng; RabbitMQ vÃ  MinIO production dÃ¹ng dá»‹ch vá»¥ managed qua URL cáº¥u hÃ¬nh.

## Workflow Ä‘á» xuáº¥t

```text
Pull request
-> ci.yml
   -> kiá»ƒm tra tÃ i liá»‡u
   -> test backend náº¿u cÃ³ go.mod
   -> test frontend náº¿u cÃ³ package.json

Push main
-> ci.yml
-> docker.yml
   -> build image api
   -> build image worker
   -> push GHCR

Manual deploy hoáº·c tag release
-> deploy.yml
   -> SSH vÃ o server
   -> docker login ghcr.io
   -> sync deploy config
   -> docker compose pull
   -> migration
   -> docker compose up -d
   -> health check
```

## File workflow

- `.github/workflows/ci.yml`: kiá»ƒm tra ná»n táº£ng.
- `.github/workflows/docker.yml`: build vÃ  push Docker image.
- `.github/workflows/deploy.yml`: triá»ƒn khai báº±ng Docker Compose.

## Secret vÃ  variable cáº§n cÃ³

Repository secrets hoáº·c environment secrets:

- `DEPLOY_HOST`: IP hoáº·c domain server.
- `DEPLOY_USER`: user SSH.
- `DEPLOY_PASSWORD`: máº­t kháº©u SSH táº¡m thá»i náº¿u chÆ°a cÃ³ key.
- `DEPLOY_SSH_KEY`: private key SSH, khuyáº¿n nghá»‹ dÃ¹ng cho production lÃ¢u dÃ i.
- `GHCR_USERNAME`: username dÃ¹ng Ä‘á»ƒ login GHCR trÃªn server.
- `GHCR_TOKEN`: token cÃ³ quyá»n pull package náº¿u image private.

Repository variables hoáº·c environment variables:

- `DEPLOY_PATH`: thÆ° má»¥c triá»ƒn khai trÃªn server, vÃ­ dá»¥ `/opt/webtui-chat`.
- `API_HEALTH_URL`: URL health check public, vÃ­ dá»¥ `https://chat.vpsttt.com/ready`.

File `.env` production náº±m trÃªn server táº¡i `${DEPLOY_PATH}/.env`; pipeline khÃ´ng ghi Ä‘Ã¨ secret runtime nÃ y.

## Docker Compose

- `deploy/docker/compose.dev.yml`: cháº¡y háº¡ táº§ng local. API/worker náº±m trong profile `app` Ä‘á»ƒ khÃ´ng báº¯t buá»™c cÃ³ code backend ngay tá»« Ä‘áº§u.
- `deploy/docker/compose.prod.yml`: cháº¡y production báº±ng image Ä‘Ã£ publish, PostgreSQL/Redis ná»™i bá»™, RabbitMQ CloudAMQP vÃ  MinIO/S3 ngoÃ i VPS.
- `deploy/scripts/deploy-compose.sh`: lá»‡nh chuáº©n Ä‘á»ƒ pull image, migrate vÃ  restart.
- `deploy/scripts/init-letsencrypt.sh`: khá»Ÿi táº¡o chá»©ng chá»‰ HTTPS cho `chat.vpsttt.com` vÃ  `chat.vpsttt.com`.
- `deploy/.env.example`: máº«u `.env` production khÃ´ng chá»©a secret tháº­t.

YÃªu cáº§u Docker Compose v2.24 trá»Ÿ lÃªn vÃ¬ file Compose dÃ¹ng `env_file.required` Ä‘á»ƒ phÃ¢n biá»‡t file mÃ´i trÆ°á»ng báº¯t buá»™c vÃ  khÃ´ng báº¯t buá»™c.

Cháº¡y háº¡ táº§ng local:

```sh
docker compose -f deploy/docker/compose.dev.yml up -d postgres redis rabbitmq minio minio-init
```

Khi backend Ä‘Ã£ cÃ³ Dockerfile tháº­t:

```sh
docker compose -f deploy/docker/compose.dev.yml --profile app up -d
```

## ChÃ­nh sÃ¡ch mÃ´i trÆ°á»ng

- Pull request chá»‰ cháº¡y CI.
- Push `main` build image `edge` hoáº·c tag theo SHA.
- Release tag `v*` build image version cá»‘ Ä‘á»‹nh.
- Deploy production nÃªn cháº¡y qua GitHub Environment `production` vÃ  báº­t required reviewers.

## Health check

Health check tá»‘i thiá»ƒu:

- PostgreSQL: `pg_isready`.
- Redis: `redis-cli ping`.
- RabbitMQ: `rabbitmq-diagnostics ping`.
- MinIO: `/minio/health/live`.
- API: `/health`.

Náº¿u health check tháº¥t báº¡i, deploy pháº£i dá»«ng trÆ°á»›c khi cleanup image cÅ© Ä‘á»ƒ cÃ²n Ä‘Æ°á»ng rollback.

## Rollback

Rollback production báº±ng cÃ¡ch Ä‘áº·t láº¡i `WEBTUI_API_IMAGE` vÃ  `WEBTUI_WORKER_IMAGE` trong `.env` server vá» tag cÅ©, sau Ä‘Ã³ cháº¡y:

```sh
docker compose -f deploy/docker/compose.prod.yml pull api worker
docker compose -f deploy/docker/compose.prod.yml up -d api worker
```

Migration destructive cáº§n káº¿ hoáº¡ch riÃªng, khÃ´ng rollback tá»± Ä‘á»™ng náº¿u Ä‘Ã£ thay Ä‘á»•i dá»¯ liá»‡u khÃ´ng thá»ƒ Ä‘áº£o ngÆ°á»£c.

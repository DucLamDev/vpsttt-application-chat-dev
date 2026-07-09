# CI/CD từng bước với GitHub Actions và Docker Compose

Tài liệu này hướng dẫn setup CI/CD production cho WebTui Chat với domain:

- API backend: `https://api.vpsttt.com`
- Frontend: `https://chat.vpsttt.com`
- VPS: dùng thông tin trong `vps-info.md`

Không commit mật khẩu VPS, private key SSH, token GitHub, mật khẩu PostgreSQL, mật khẩu CloudAMQP, secret MinIO hoặc JWT secret.

## Bước 1: Tạo SSH key deploy

Khuyến nghị dùng SSH key riêng cho GitHub Actions thay vì dùng mật khẩu VPS lâu dài.

Trên máy cá nhân Windows PowerShell:

```powershell
ssh-keygen -t ed25519 -C "github-actions-webtui-chat" -f "$env:USERPROFILE\.ssh\webtui_chat_deploy"
```

Sau lệnh này sẽ có 2 file:

```text
C:\Users\<ten_user>\.ssh\webtui_chat_deploy
C:\Users\<ten_user>\.ssh\webtui_chat_deploy.pub
```

- File không có `.pub` là private key, chỉ đưa vào GitHub Secret `DEPLOY_SSH_KEY`.
- File `.pub` là public key, đưa lên VPS trong `~/.ssh/authorized_keys`.

Xem public key:

```powershell
Get-Content "$env:USERPROFILE\.ssh\webtui_chat_deploy.pub"
```

SSH vào VPS bằng mật khẩu ban đầu:

```powershell
ssh root@160.191.55.144
```

Trên VPS, thêm public key:

```bash
mkdir -p ~/.ssh
chmod 700 ~/.ssh
nano ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

Dán nội dung public key vào `authorized_keys`, lưu lại.

Kiểm tra đăng nhập bằng key từ máy cá nhân:

```powershell
ssh -i "$env:USERPROFILE\.ssh\webtui_chat_deploy" root@160.191.55.144
```

Máy local đã có thể cấu hình alias SSH:

```sshconfig
Host webtui-vps
    HostName 160.191.55.144
    User root
    IdentityFile C:\Users\duclam\.ssh\webtui_chat_deploy
    IdentitiesOnly yes
```

Sau đó chỉ cần:

```powershell
ssh webtui-vps
```

Lấy private key để đưa vào GitHub Secret:

```powershell
Get-Content "$env:USERPROFILE\.ssh\webtui_chat_deploy" -Raw
```

Copy toàn bộ nội dung, gồm cả:

```text
-----BEGIN OPENSSH PRIVATE KEY-----
...
-----END OPENSSH PRIVATE KEY-----
```

## Bước 2: Setup GitHub Actions

Repo đã có sẵn workflow:

```text
.github/workflows/ci.yml
.github/workflows/docker.yml
.github/workflows/deploy.yml
```

Vào GitHub:

```text
Settings -> Environments -> New environment -> production
```

Trong environment `production`, thêm Secrets:

```text
DEPLOY_HOST=160.191.55.144
DEPLOY_USER=root
DEPLOY_SSH_KEY=<private key vừa tạo>
DEPLOY_PASSWORD=
GHCR_USERNAME=<github_username>
GHCR_TOKEN=<github_pat_co_quyen_read_packages>
```

Nếu chưa dùng SSH key, có thể tạm dùng:

```text
DEPLOY_PASSWORD=<mat_khau_vps>
DEPLOY_SSH_KEY=
```

Khuyến nghị chỉ dùng password trong giai đoạn đầu, sau đó chuyển sang SSH key.

Thêm Variables:

```text
DEPLOY_PATH=/opt/webtui-chat
API_HEALTH_URL=https://api.vpsttt.com/ready
```

`GHCR_TOKEN` cần quyền đọc package nếu image GHCR để private. Nếu package public thì có thể không cần login GHCR trên VPS.

## Bước 3: Setup VPS

Đăng nhập VPS:

```powershell
ssh -i "$env:USERPROFILE\.ssh\webtui_chat_deploy" root@160.191.55.144
```

Cài Docker Engine và Docker Compose plugin trên Ubuntu:

```bash
apt-get update
apt-get install -y ca-certificates curl
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

Vì deploy dùng account `root`, không cần thêm user vào group `docker`.

Kiểm tra:

```bash
docker --version
docker compose version
```

Mở firewall nếu VPS dùng UFW:

```bash
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
ufw status
```

Tạo thư mục deploy:

```bash
mkdir -p /opt/webtui-chat
cd /opt/webtui-chat
```

## Bước 4: Tạo file `.env` production trên VPS

Workflow deploy yêu cầu file:

```text
/opt/webtui-chat/.env
```

File mẫu trong repo:

```text
deploy/.env.example
```

Cách tạo lần đầu:

```bash
cd /opt/webtui-chat
mkdir -p deploy
```

Copy thư mục `deploy` từ máy cá nhân lên VPS:

```powershell
scp -i "$env:USERPROFILE\.ssh\webtui_chat_deploy" -r deploy root@160.191.55.144:/opt/webtui-chat/
```

Trên VPS:

```bash
cd /opt/webtui-chat
cp deploy/.env.example .env
nano .env
```

Các giá trị bắt buộc phải đổi:

```env
POSTGRES_PASSWORD=THAY_BANG_MAT_KHAU_POSTGRES_MANH
DATABASE_URL=postgres://webtui:THAY_BANG_MAT_KHAU_POSTGRES_MANH@postgres:5432/vpstttdb_chat?sslmode=disable
RABBITMQ_URL=amqps://btrvptkc:THAY_BANG_MAT_KHAU_CLOUDAMQP@fuji.lmq.cloudamqp.com/btrvptkc
S3_SECRET_ACCESS_KEY=THAY_BANG_SECRET_KEY_MINIO
JWT_ACCESS_SECRET=THAY_BANG_CHUOI_RANDOM_IT_NHAT_32_KY_TU
JWT_REFRESH_SECRET=THAY_BANG_CHUOI_RANDOM_IT_NHAT_32_KY_TU_KHAC
WEBHOOK_SIGNING_SECRET=THAY_BANG_CHUOI_RANDOM_IT_NHAT_32_KY_TU_KHAC_NUA
```

Giữ các giá trị production này:

```env
APP_ENV=production
APP_URL=https://api.vpsttt.com
CORS_ALLOWED_ORIGINS=https://chat.vpsttt.com,http://localhost:3000,http://localhost:3001
API_DOMAIN=api.vpsttt.com
FRONTEND_DOMAIN=chat.vpsttt.com
RABBITMQ_ENABLED=true
REDIS_ENABLED=true
DATABASE_ENABLED=true
STORAGE_PROVIDER=minio
AUTO_INIT_TLS=true
```

## Bước 5: PostgreSQL trên VPS

Production đang dùng PostgreSQL container trong `deploy/docker/compose.prod.yml`.

Bạn không cần tự chạy `createdb` thủ công. Khi container `postgres` chạy lần đầu, Docker image PostgreSQL tự tạo database theo biến:

```env
POSTGRES_DB=vpstttdb_chat
POSTGRES_USER=webtui
POSTGRES_PASSWORD=...
```

Backend dùng:

```env
DATABASE_URL=postgres://webtui:MAT_KHAU@postgres:5432/vpstttdb_chat?sslmode=disable
```

Sau deploy, kiểm tra database:

```bash
cd /opt/webtui-chat
docker compose -f deploy/docker/compose.prod.yml exec postgres psql -U webtui -d vpstttdb_chat -c "\dt"
```

Migration được chạy tự động bởi workflow deploy qua service `migrate`:

```bash
docker compose -f deploy/docker/compose.prod.yml --profile migration run --rm migrate
```

Lưu ý: nếu volume `postgres_data` đã được tạo từ mật khẩu cũ, việc đổi `POSTGRES_PASSWORD` trong `.env` không đổi mật khẩu database đã tồn tại. Khi đó cần đổi password bằng SQL hoặc tạo lại volume trong môi trường chưa có dữ liệu thật.

## Bước 6: Build image bằng GitHub Actions

Push code lên `main`:

```bash
git add .
git commit -m "setup production cicd"
git push origin main
```

GitHub sẽ chạy:

```text
CI -> Docker
```

Workflow `Docker` build:

```text
ghcr.io/<owner>/<repo>/api:<tag>
ghcr.io/<owner>/<repo>/worker:<tag>
```

Với repo này, image thường có dạng:

```text
ghcr.io/duclamdev/application-chat/api:latest
ghcr.io/duclamdev/application-chat/worker:latest
```

## Bước 7: Deploy production

Vào GitHub:

```text
Actions -> Deploy -> Run workflow
```

Chọn:

```text
environment=production
image_tag=latest
```

Workflow sẽ:

1. SSH vào VPS.
2. Tạo `/opt/webtui-chat`.
3. Đồng bộ thư mục `deploy`.
4. Login GHCR nếu có `GHCR_TOKEN`.
5. Export `WEBTUI_API_IMAGE` và `WEBTUI_WORKER_IMAGE`.
6. Chạy `deploy/scripts/deploy-compose.sh`.
7. Chạy migration.
8. Chạy `docker compose up -d`.
9. Kiểm tra `https://api.vpsttt.com/ready`.

## Bước 8: Test sau deploy

Trên máy cá nhân:

```powershell
Invoke-RestMethod https://api.vpsttt.com/health
Invoke-RestMethod https://api.vpsttt.com/ready
Invoke-RestMethod https://api.vpsttt.com/version
Invoke-RestMethod https://api.vpsttt.com/metrics
```

Trên VPS:

```bash
cd /opt/webtui-chat
docker compose -f deploy/docker/compose.prod.yml ps
docker compose -f deploy/docker/compose.prod.yml logs --tail=100 api
docker compose -f deploy/docker/compose.prod.yml logs --tail=100 worker
```

Kiểm tra RabbitMQ CloudAMQP:

```bash
docker compose -f deploy/docker/compose.prod.yml logs --tail=100 api | grep RabbitMQ
docker compose -f deploy/docker/compose.prod.yml logs --tail=100 worker | grep RabbitMQ
```

Kiểm tra PostgreSQL:

```bash
docker compose -f deploy/docker/compose.prod.yml exec postgres psql -U webtui -d vpstttdb_chat -c "select now();"
```

## Bước 9: Deploy các lần sau

Quy trình hằng ngày:

```text
1. Push code lên main
2. Chờ CI pass
3. Chờ Docker build image xong
4. Mở Deploy workflow
5. Chọn production + image_tag
6. Kiểm tra /ready
```

Nếu muốn deploy đúng SHA image, vào workflow `Docker`, xem tag SHA đã push rồi nhập tag đó vào `image_tag`.

## Bước 10: Rollback

Chạy lại workflow `Deploy` với `image_tag` cũ.

Hoặc trên VPS:

```bash
cd /opt/webtui-chat
WEBTUI_API_IMAGE=ghcr.io/duclamdev/application-chat/api:TAG_CU \
WEBTUI_WORKER_IMAGE=ghcr.io/duclamdev/application-chat/worker:TAG_CU \
sh deploy/scripts/deploy-compose.sh
```

Nếu migration đã thay đổi dữ liệu theo hướng destructive, cần restore backup hoặc có kế hoạch rollback riêng.

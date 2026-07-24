# VPSTTT Chat self-hosted

Mỗi bản cài là một instance độc lập do customer sở hữu: một domain cố định, một
PostgreSQL, Redis, RabbitMQ, storage, TURN và bộ secret riêng. VPSTTT không cấp
zone trên hạ tầng trung tâm và không nhận dữ liệu chat của instance.

## Yêu cầu

- Linux VPS có IPv4 public, tối thiểu 4 vCPU, 8 GB RAM và 40 GB SSD.
- Docker Engine và Docker Compose v2.
- DNS `A` của domain trỏ vào IPv4 của VPS.
- Mở TCP `80`, `443`, `3478`; UDP `443`, `3478`, `49160-49200`.
- Không có reverse proxy khác chiếm cổng `80` hoặc `443`.

## Cài mới

```sh
git clone <repository-url> vpsttt-chat
cd vpsttt-chat
sh deploy/self-hosted/install.sh \
  --domain chat.example.com \
  --email admin@example.com \
  --name "Example Chat"
```

Caddy tự lấy và gia hạn TLS. Tài khoản đầu tiên đăng ký tại domain trở thành
workspace owner; ngay sau đó đăng ký mở được chuyển sang `invite_only`.

## Vận hành

```sh
sh deploy/self-hosted/check.sh
sh deploy/self-hosted/backup.sh
sh deploy/self-hosted/update.sh
sh deploy/self-hosted/restore.sh /absolute/path/to/backup --yes
```

File `.env` chứa toàn bộ secret của instance, có quyền file `0600` sau khi
installer tạo. Không commit hoặc gửi file này cho VPSTTT.

## Domain và client

Người dùng nhập `chat.example.com` trong ứng dụng. Client gọi discovery tại
chính domain đó rồi đăng nhập vào instance của customer. Nhập domain không tạo
instance mới; operator phải cài stack và cấu hình DNS trước.

API, WebSocket và admin dùng cùng origin:

- Web: `https://chat.example.com`
- API: `https://chat.example.com/api`
- WebSocket: `wss://chat.example.com/ws`
- Admin: `https://chat.example.com/admin`

## Giới hạn media

Cuộc gọi 1:1 dùng WebRTC và coturn trong stack. TURN đang dùng credential tĩnh
riêng của instance; hãy đổi `TURN_PASSWORD`, cập nhật
`NEXT_PUBLIC_RTC_ICE_SERVERS` rồi build lại `web` và `admin` nếu credential bị
lộ. Nhóm gọi quy mô lớn cần bổ sung SFU/HPB chuyên dụng.

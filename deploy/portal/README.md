# WebTUI Chat Portal

Portal là website trung tâm tại `chat.vpsttt.com/portal`. Portal không chạy chat
backend và không nhận mật khẩu/token của customer. Trình duyệt gọi discovery
trực tiếp tới instance self-hosted, sau đó điều hướng sang domain customer.

## Triển khai

1. Tạo DNS `A chat.vpsttt.com -> <public IPv4>`.
2. Sao chép `.env.example` thành `.env` và cập nhật domain, email, link tải app.
3. Chạy:

```sh
docker compose --env-file .env -f compose.yml up -d --build
```

Customer instance phải cho phép origin portal trong `CORS_ALLOWED_ORIGINS`.
Installer self-hosted mặc định thêm origin `https://chat.vpsttt.com`; người dùng
mở portal tại `https://chat.vpsttt.com/portal`. Nếu portal dùng domain khác,
truyền origin không có path, ví dụ `--portal-origin https://portal.example.com`.

## Ranh giới trách nhiệm

- Portal: nhập domain, discovery, download center, documentation.
- Instance customer: đăng ký/đăng nhập, token, dữ liệu chat, file, WebSocket.
- Control plane license/heartbeat: là dịch vụ riêng khi triển khai giai đoạn sau,
  không được trộn vào database chat của customer.

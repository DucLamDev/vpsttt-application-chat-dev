# Cấu hình ZEGOCLOUD và Firebase push

Tài liệu này cấu hình cuộc gọi ZEGOCLOUD cho web, desktop, mobile và Firebase Cloud Messaging cho thông báo tin nhắn/cuộc gọi trên mobile.

## 1. ZEGOCLOUD Dashboard

1. Mở project `Voice & Video Call` trong ZEGOCLOUD Console.
2. Trong `Project Configuration > Project Information`, lấy `AppID`, `AppSign` và `ServerSecret`.
3. Giữ region là `Global` nếu người dùng ở nhiều khu vực.
4. Bật dịch vụ `Voice & Video Call` trong `Service Management`.
5. Không đưa `ServerSecret` vào web, desktop hoặc mobile. Backend dùng secret này để tạo Token04 ngắn hạn.

Project không cần tạo room thủ công. Mỗi call dùng backend call ID làm ZEGOCLOUD room ID và giới hạn hai người.

## 2. Firebase Console

1. Tạo hoặc mở Firebase project, sau đó bật `Cloud Messaging API (V1)`.
2. Thêm Android app production với package `com.vpsttt.webtui_chat`.
3. Thêm Android app dev với package `com.vpsttt.webtui_chat.dev` để APK debug nhận push.
4. Trong `Project settings > Service accounts`, chọn `Generate new private key`.
5. Không commit file JSON. Encode file thành một dòng để đặt trên VPS:

```bash
base64 -w 0 firebase-service-account.json
```

Với iOS, thêm app bằng Bundle ID đang dùng trong Xcode, bật `Push Notifications` và `Background Modes > Remote notifications`, sau đó upload APNs authentication key trong `Project settings > Cloud Messaging`.

## 3. `.env` trên VPS

Mở `/opt/webtui-chat/.env` và thêm:

```env
ZEGO_APP_ID=87181369
ZEGO_APP_SIGN=THAY_BANG_APP_SIGN
ZEGO_SERVER_SECRET=THAY_BANG_SERVER_SECRET_32_KY_TU
ZEGO_TOKEN_TTL=24h
ZEGO_CALL_RING_TIMEOUT=30s

FIREBASE_PROJECT_ID=ten-firebase-project
FIREBASE_SERVICE_ACCOUNT_JSON_BASE64=CHUOI_BASE64_MOT_DONG
FIREBASE_SERVICE_ACCOUNT_FILE=
```

`FIREBASE_SERVICE_ACCOUNT_FILE` chỉ dùng khi chạy không qua Docker và file JSON nằm trên máy chủ. Với Compose hiện tại nên dùng biến base64 vì cả API và worker cùng đọc `.env`.

Khởi động lại API và worker:

```bash
cd /opt/webtui-chat
docker compose -f deploy/docker/compose.prod.yml up -d api worker
docker compose -f deploy/docker/compose.prod.yml logs --tail=100 worker
```

## 4. GitHub Actions secrets cho mobile

Trong `Settings > Secrets and variables > Actions`, thêm:

```text
FIREBASE_PROJECT_ID
FIREBASE_MESSAGING_SENDER_ID
FIREBASE_API_KEY
FIREBASE_ANDROID_APP_ID
FIREBASE_ANDROID_DEV_APP_ID
```

Các giá trị lấy từ `Project settings > General > Your apps > SDK setup and configuration`. `FIREBASE_ANDROID_APP_ID` thuộc app production; `FIREBASE_ANDROID_DEV_APP_ID` thuộc app dev.

## 5. Kiểm tra sau deploy

1. Cài APK mới và đăng nhập để app đăng ký FCM token với backend.
2. Tắt màn hình máy B, gửi tin nhắn từ A và kiểm tra thông báo trên màn hình khóa.
3. Gọi từ A sang B; B phải nhận thông báo cuộc gọi, mở app và có nút nhận/từ chối.
4. A hủy trước khi B nhận; giao diện gọi đến của B phải đóng khi app đồng bộ trạng thái.
5. Không nhận trong 30 giây; backend chuyển call sang `missed` và cả hai bên kết thúc.
6. B nhận cuộc gọi rồi một bên tắt; phía còn lại phải rời room và tin nhắn cuối là cuộc gọi đã kết thúc, có thời lượng tính từ lúc nhận.

Nếu push không đến, kiểm tra `push_devices` có token FCM đang `active`, log worker không có lỗi OAuth/FCM, package của APK khớp Firebase app và quyền notification trên điện thoại đã bật.

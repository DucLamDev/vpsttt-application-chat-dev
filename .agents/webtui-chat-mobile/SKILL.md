---
name: webtui-chat-mobile
description: Hướng dẫn agent thiết kế, sinh code và rà soát mobile app WebTui Chat bằng Flutter theo Clean Architecture, dựa trên roadmap mobile, backend Go/OpenAPI, realtime chat, workspace multi-tenant, bot/AI theo từng công ty và reference UI Zalo-like/WebTui mobile đã chốt. Dùng khi làm Flutter mobile app, mobile UI, Android/iOS packaging, CH Play, Firebase App Distribution hoặc download APK.
---

# WebTui Chat Mobile

## Quy trình bắt buộc

1. Đọc `docs/planning/mobile-flutter-roadmap.md` trước khi tạo hoặc sửa Flutter mobile app.
2. Đọc `docs/design/mobile/references/mobile-ui-reference.md` trước khi dựng bất kỳ màn UI nào.
3. Mở ảnh `docs/design/mobile/references/webtui-mobile-zalo-reference.png` trước khi thiết kế layout. Nếu ảnh chưa tồn tại, dừng phần dựng UI và yêu cầu đặt ảnh gốc vào đúng path.
4. Bám Clean Architecture: `Presentation -> Application -> Domain <- Data`; domain không import Flutter, Dio, Drift, Firebase hoặc generated DTO.
5. Mọi feature lớn phải có `domain`, `application`, `data`, `presentation`; repository interface đặt ở domain, implementation đặt ở data.
6. UI gọi use case/controller, không gọi Dio, Drift, Secure Storage, Firebase hoặc WebSocket trực tiếp trong widget.
7. Dữ liệu luôn scope theo `workspace_id`; không trộn cache, route, websocket subscription hoặc notification giữa các workspace.
8. Tất cả copy UI, log, empty state, toast, lỗi và tài liệu bàn giao phải là tiếng Việt có dấu.
9. Quy tắc toàn cục: không thêm tiếng Việt không dấu vào mobile app. Mọi chuỗi hardcoded mới trong `mobile/lib` phải qua guard `mobile/test/global/vietnamese_diacritics_rule_test.dart`.

## Nguyên tắc UI mobile

- Thiết kế theo mẫu Zalo-like trong ảnh reference: sáng, gọn, chuyên nghiệp, mật độ thông tin cao nhưng dễ quét.
- Màn đầu phải là trải nghiệm app thật, không phải landing page marketing.
- Các màn chính cần có: Splash/Login, Tin nhắn, Bạn bè, Kênh & Bot, Kênh, Cài đặt.
- Bottom navigation ưu tiên 4 vùng: Tin nhắn, Danh bạ, Khám phá/Kênh, Thêm/Cài đặt.
- Dùng segmented tabs cho nhóm lọc: Hội thoại/Kênh & Bot, Tất cả/Chưa đọc/Yêu thích.
- List item phải có avatar/icon, tên, preview, thời gian/badge/trạng thái; không tạo card quá to làm giảm mật độ.
- Dùng primary xanh WebTui/Zalo-like, nền xám rất nhạt, border mảnh, shadow nhẹ.
- Icon phải mềm và quen thuộc; tránh icon cứng, quá generic hoặc giống AI-generated.
- Không dùng tiếng Việt không dấu trong nhãn UI.

## Luồng sản phẩm cần giữ

- Mỗi công ty là một workspace riêng.
- Super admin quản lý toàn hệ thống; workspace admin quản lý workspace.
- Bot/AI theo từng workspace, không hard-code flow hoặc API order VPSTTT trong mobile.
- Mobile không gọi trực tiếp LLM provider; AI secret nằm ở backend/vault.
- File chat nội bộ đi qua backend auth; APK/app release có thể đi qua `download.vpsttt.com`.

## Kiểm tra trước khi bàn giao

- Chạy `flutter analyze` và test phù hợp nếu đã có project Flutter.
- Chụp screenshot iPhone-like và Android-like viewport cho các màn UI mới.
- Đặt screenshot cạnh `webtui-mobile-zalo-reference.png` để kiểm tra navigation, spacing, density, màu và phong cách.
- Nếu làm Android release: tạo AAB cho CH Play, APK signed cho Firebase/direct download, versionCode tăng, checksum SHA-256 cho APK public.


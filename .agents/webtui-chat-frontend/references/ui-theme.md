# UI Theme Theo Mockup Ảnh Số 3

## Tinh thần sản phẩm

WebTui Chat là chat nội bộ tự host cho doanh nghiệp Việt. UI nên giống công cụ vận hành nghiêm túc: sáng, sắc nét, nhiều thông tin nhưng dễ quét, ưu tiên tốc độ thao tác.

Không làm landing page khi người dùng yêu cầu app. Màn hình đầu tiên nên là trải nghiệm chat hoặc dashboard thật.

## Layout chính

```text
┌────────┬────────────────────┬─────────────────────────────┬────────────────────┐
│ rail   │ channel/convo list │ chat workspace              │ detail panel        │
│ blue   │ white              │ white                        │ pinned/media/files  │
└────────┴────────────────────┴─────────────────────────────┴────────────────────┘
```

- Rail trái: xanh cobalt đậm, icon trắng, item active sáng hơn, avatar user ở đáy.
- Cột kênh/hội thoại: tiêu đề "Kênh & Hội thoại", tabs `Tất cả`, `Chưa đọc`, `Yêu thích`, danh sách channel có badge unread.
- Main chat: header channel, member count, search, notification, info; timeline thoáng; composer cố định dưới.
- Panel phải: tabs `Đã ghim`, `Ảnh`, `File`, settings icon; card file/media nhỏ, không rối.
- Admin/dashboard dùng cùng rail nhưng nội dung là bảng, chart, form cấu hình.

## Màu và cảm giác

Gợi ý token:

- `--brand-900: #083A8C`
- `--brand-800: #0B4DB3`
- `--brand-700: #0F63E6`
- `--accent-green: #16B364`
- `--accent-orange: #F59E0B`
- `--accent-red: #F04438`
- `--surface: #FFFFFF`
- `--surface-muted: #F5F7FB`
- `--border: #E5EAF3`
- `--text: #101828`
- `--text-muted: #667085`

Tránh UI một màu xanh toàn bộ. Dùng xanh cho navigation/action chính, còn trạng thái dùng xanh lá/cam/đỏ/tím vừa đủ.

## Component rules

- Dùng lucide icons cho navigation/action: message, hash, bell, file, bot, workflow, users, settings, search, pin, send, paperclip.
- Card radius tối đa 8px trừ khi design system đã khác.
- Không nhồi card trong card.
- Button icon cần tooltip khi icon không quen thuộc.
- Bảng admin phải dense, dễ scan, có filter/search/status.
- Chat composer có attach, mention, emoji, send icon; không đặt hướng dẫn dài trong UI.
- Badge unread là đỏ nhỏ; status online dùng chấm xanh trên avatar.

## Screen set MVP

- Login/register.
- Workspace/channel shell.
- Channel list + direct conversations.
- Message timeline + composer + thread panel.
- File upload/download/attachment panel.
- Notifications dropdown/list.
- Member directory + presence.
- Admin dashboard stats.
- User/member/RBAC management.
- Integrations: API token, bot, incoming/outgoing webhook.
- Operations: cronjobs, backup jobs, health/audit.

## Responsive

- Desktop: 4 cột như mockup.
- Tablet: rail + list + main, panel phải thành drawer.
- Mobile: bottom nav hoặc compact rail, list/main/detail tách route; composer luôn dễ chạm.

## Copy tiếng Việt

Ưu tiên label ngắn giống mockup: `Tin nhắn`, `Bạn bè`, `Kênh`, `Ticket`, `File`, `Bot`, `Automation`, `Cài đặt`. `Thông báo` là popup realtime ở đầu panel chat, không phải tab sidebar.

Các trạng thái nên viết rõ: `Đang gửi`, `Gửi thất bại`, `Đang tải file`, `Không có quyền`, `Đã sao chép`.

Không viết tiếng Việt không dấu trong UI hoặc tài liệu bàn giao. Các ngoại lệ hợp lệ là code identifier, route, biến môi trường, tên package và thuật ngữ kỹ thuật bắt buộc.

# Desktop App Phase D8 Completion

Ngay chot: 2026-07-14

Phase D8 hoan thien lop nghiep vu con thieu cho desktop shell: department, bot/order bot, automation/webhook/API token, ticket domain/UI that, system/announcement message rendering va deep link sang Admin Panel theo quyen.

## Ra soat Phase D7

| Hang muc | Ket luan |
|---|---|
| Notification center/native notification | Giu trang thai xong; frontend co preference, quiet hours, deep link va notification click highlight message. |
| Tray/single-instance/autostart | Giu trang thai xong code native; tray cap nhat unread tooltip qua Tauri command. |
| Native smoke | Van bi chan boi may hien tai thieu Rust/Cargo/MSVC, nen `tauri build` dung o `cargo metadata`. |

## Ban giao D8

| Hang muc | Trang thai | Ghi chu |
|---|---:|---|
| D8.1 Department | Xong | Desktop shell dung API department that cho cay, member, lead/member role va channel lien ket. |
| D8.2 Bot workspace | Xong | Bot page hien danh sach bot, installation/session va kenh ket noi theo workspace. |
| D8.3-D8.5 Order bot | Xong | Wallet balance, deposit QR, order payment QR, services expiring/renew dung API order bot that. |
| D8.6 Automation CRUD/run/history | Xong | Automation page co cronjob CRUD, pause/resume, run-now, run history va webhook management. |
| D8.7 Webhook/API token permission | Xong | Incoming/outgoing webhook va API token duoc thao tac trong automation workspace; secret chi hien theo response chinh sach mot lan. |
| D8.8 Ticket domain va UI | Xong | Them migration `000018_tickets`, backend module tickets, OpenAPI/client/types/query keys va ticket page that thay placeholder. |
| D8.9 Announcement/system message | Xong | Timeline nhan dien `kind=system/announcement` hoac metadata tuong ung, render thanh dong he thong rieng khong co action/reaction. |
| D8.10 Admin deep link | Xong | Settings chi hien nut mo Admin Panel khi user co `admin.view`, desktop mo bang platform external link. |

## Backend va contract

- Migration moi: `backend/db/migrations/000018_tickets.up.sql`.
- Module moi: `backend/internal/modules/tickets`.
- Route moi: `/api/v1/workspaces/{workspace_id}/tickets` va `/api/v1/workspaces/{workspace_id}/tickets/{ticket_id}`.
- Permission moi: `ticket.view` va `ticket.manage`; member duoc view/create, admin/owner duoc manage.
- OpenAPI va `desktop-openapi-contract.test.ts` da bat buoc ticket paths cho desktop MVP.

## Kiem thu

Lenh can chay sau thay doi D8:

```bash
go test ./internal/modules/tickets/...
npm.cmd run test:unit -- desktop-openapi-contract.test.ts
npm.cmd run typecheck
npm.cmd --workspace @webtui/web run lint
npm.cmd --workspace @webtui/web run build:desktop
npm.cmd --workspace @webtui/desktop run tauri -- build
```

Ghi chu: `tauri build` van can Rust/Cargo/rustup va Visual Studio Build Tools MSVC SDK tren Windows. Neu may thieu `cargo`, lenh se dung o `cargo metadata`.

Ket qua luot chay 2026-07-14:

- `go test ./internal/modules/tickets/...` pass voi `GOCACHE` tro vao workspace.
- `go test ./internal/modules/notifications/...` pass voi `GOCACHE` tro vao workspace.
- `npm.cmd run test:unit -- desktop-openapi-contract.test.ts` pass.
- `npm.cmd run typecheck` pass.
- `npm.cmd --workspace @webtui/web run lint` pass.
- `npm.cmd --workspace @webtui/web run build:desktop` pass va sinh static route `/chat/desktop`.
- `npm.cmd --workspace @webtui/desktop run tauri -- build` van dung o `cargo metadata` vi may hien tai chua co `cargo`.

## Dieu kien chuyen D9

- Chay migration `000018_tickets` tren database dev/staging.
- Smoke test ticket lifecycle voi user co `ticket.view` va `ticket.manage`.
- Cai native toolchain de smoke test lai tray, deep link, notification click va static desktop bundle.

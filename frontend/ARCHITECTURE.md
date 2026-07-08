# Kiến trúc frontend

Frontend mục tiêu dùng Next.js App Router, shadcn/ui, TanStack Query và Zustand.

## Ứng dụng

- `apps/web`: trải nghiệm chat của người dùng.
- `apps/admin`: trang quản trị hệ thống.

## Package dùng chung

- `packages/api-client`: REST/WebSocket client typed.
- `packages/config`: cấu hình ESLint, Tailwind và TypeScript dùng chung.
- `packages/icons`: adapter icon dùng chung.
- `packages/types`: DTO và type dùng chung.
- `packages/ui`: component UI dùng chung.

## Quy tắc

- Không gọi API trực tiếp trong component nếu đã có API client.
- Server state dùng TanStack Query.
- Client state như theme, socket, composer draft dùng Zustand.
- Component dùng chung đặt trong `packages/ui`.
- Feature code đặt trong `src/features`.


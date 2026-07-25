import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WebTUI Chat Portal",
  description: "Kết nối và tải client cho WebTUI Chat self-hosted.",
  icons: {
    apple: "/brand/logo_webtui.png",
    icon: "/brand/logo_webtui.png"
  }
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}

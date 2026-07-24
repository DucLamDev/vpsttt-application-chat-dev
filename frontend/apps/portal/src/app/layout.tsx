import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  display: "swap",
  subsets: ["latin", "vietnamese"],
  variable: "--font-inter"
});

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
    <html className={inter.variable} lang="vi">
      <body>{children}</body>
    </html>
  );
}

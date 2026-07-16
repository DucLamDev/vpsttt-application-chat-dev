import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@webtui/ui/styles.css";
import "./globals.css";
import { AppProviders } from "./providers";

const inter = Inter({
  display: "swap",
  subsets: ["latin", "vietnamese"],
  variable: "--font-inter"
});

export const metadata: Metadata = {
  title: "WebTui Chat",
  description: "Nền tảng chat nội bộ tự host cho doanh nghiệp Việt.",
  icons: {
    apple: "/brand/logo_webtui.png",
    icon: "/brand/logo_webtui.png",
    shortcut: "/brand/logo_webtui.png"
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html className={inter.variable} lang="vi" suppressHydrationWarning>
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}

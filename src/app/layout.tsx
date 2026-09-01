import type { Metadata, Viewport } from "next";
import { ThemeBoot } from "@/components/shell/ThemeBoot";
import "./globals.css";

export const metadata: Metadata = {
  title: "CineMap · 影展排片与影院地图",
  description:
    "Local-first 上影节排片助手：选片、挑场次、日程表导出、影院地图打卡点亮。",
  applicationName: "CineMap",
  appleWebApp: { capable: true, title: "CineMap" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ebe7de",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" data-theme="cream" suppressHydrationWarning>
      <body className="font-sans antialiased selection:bg-accent/25 selection:text-ink">
        <ThemeBoot />
        {children}
      </body>
    </html>
  );
}

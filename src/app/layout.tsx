import type { Metadata, Viewport } from "next";
import { ThemeBoot } from "@/components/shell/ThemeBoot";
import "./globals.css";

export const metadata: Metadata = {
  title: "CineMap · 影展排片与影院地图",
  description: "Local-first film festival scheduler and cinema map",
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

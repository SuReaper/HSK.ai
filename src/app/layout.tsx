import localFont from "next/font/local";
import type { Metadata, Viewport } from "next";
import { AppShell } from "@/components/app-shell";
import "./globals.css";

const geistSans = localFont({
  src: "../fonts/Geist[wght].woff2",
  variable: "--font-geist-sans",
  weight: "100 900",
  display: "swap",
  preload: true,
  fallback: ["system-ui", "sans-serif"],
});

const geistMono = localFont({
  src: "../fonts/GeistMono[wght].woff2",
  variable: "--font-geist-mono",
  weight: "100 900",
  display: "swap",
  preload: false,
});

const spaceMono = localFont({
  src: [
    {
      path: "../fonts/SpaceMono-Regular.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../fonts/SpaceMono-Bold.ttf",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-space-mono",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: "HSK.ai — Intent-to-Pay アシスタント",
  description:
    "平易な言葉でHashKey Chainでの支払いを送信。あなたの意図を検証可能なオンチェーン決済に変換するAIアシスタントです。",
  applicationName: "HSK.ai",
  icons: {
    icon: "/hskailogo.png",
    apple: "/hskailogo.png",
  },
};

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`dark ${geistSans.variable} ${geistMono.variable} ${spaceMono.variable} h-full antialiased`}
    >
      <body className="min-h-full text-foreground">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
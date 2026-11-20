import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "侍日本語ラボ | 失敗させない日本語学習",
  description: "日本語教員試験対策から登録日本語教員まで、皆さんの背中を後押しします。書籍で基礎を学び、SNS×アプリで毎日成長できるコミュニティ。",
  keywords: ["日本語教員", "日本語教育", "試験対策", "学習教材"],
  openGraph: {
    title: "侍日本語ラボ",
    description: "失敗させない日本語学習へ。",
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

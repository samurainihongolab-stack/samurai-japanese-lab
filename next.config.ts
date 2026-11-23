import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Instagram画像の日本語フォント（Noto Sans JP, OFL）をサーバーレス関数へ同梱する
  outputFileTracingIncludes: {
    "/api/quiz/image/[slug]": ["./assets/fonts/**"],
    "/api/cron/publish": ["./assets/fonts/**"],
    "/api/admin/quiz": ["./assets/fonts/**"],
  },
};

export default nextConfig;

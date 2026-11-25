import path from "node:path";
import { siteOrigin } from "../quiz/templates/common";
import type { Platform } from "../quiz/types";
import { bufferTextBackend } from "./buffer";
import { MockPlatform, type MockScript } from "./mock";
import { InstagramPublisher, ThreadsPublisher, XPublisher, instagramLiveBackend, threadsLiveBackend, xLiveBackend } from "./platforms";
import type { Publisher } from "./types";

export const LIVE_CONFIRM_PHRASE = "I_UNDERSTAND_THIS_POSTS_TO_REAL_ACCOUNTS";

export function publicationPlatforms(): readonly Platform[] | undefined {
  return process.env.SNS_TEXT_PROVIDER === "buffer" ? ["x", "threads"] : undefined;
}

export function publicationMode() {
  if (process.env.SNS_MODE === "live") return "live";
  if (process.env.QUIZ_BACKEND === "supabase" || process.env.VERCEL) return "disabled";
  return "dry-run";
}

export function createMock(script?: MockScript, file?: string) {
  return new MockPlatform(file ?? process.env.MOCK_PLATFORM_FILE ?? path.join(process.cwd(), ".local-data", "mock-platform.json"), script);
}

export function createPublishers(opts?: { mock?: MockPlatform }): Record<Platform, Publisher> {
  // mock を明示的に渡した場合（デモ/テスト）は SNS_MODE に関わらず必ず dry-run。環境変数の引き継ぎで実投稿に到達させない。
  const live = process.env.SNS_MODE === "live" && !opts?.mock;
  if (!live) {
    const m = opts?.mock ?? createMock();
    return {
      threads: new ThreadsPublisher(m.backend("threads"), "dry-run"),
      x: new XPublisher(m.backend("x"), "dry-run"),
      instagram: new InstagramPublisher(m.backend("instagram"), "dry-run"),
    };
  }
  // 実投稿は二重の明示確認がなければ構築できない
  if (process.env.SNS_LIVE_CONFIRM !== LIVE_CONFIRM_PHRASE) throw new Error("SNS_MODE=live には SNS_LIVE_CONFIRM の明示確認が必要です");
  const origin = siteOrigin();
  if (!origin.startsWith("https://") || /localhost|127\.0\.0\.1/.test(origin)) throw new Error("実投稿には https の本番 NEXT_PUBLIC_SITE_URL が必要です");
  const useBuffer = process.env.SNS_TEXT_PROVIDER === "buffer";
  return {
    threads: new ThreadsPublisher(useBuffer ? bufferTextBackend("threads") : threadsLiveBackend(), "live"),
    x: new XPublisher(useBuffer ? bufferTextBackend("x") : xLiveBackend(), "live"),
    instagram: new InstagramPublisher(instagramLiveBackend(), "live"),
  };
}

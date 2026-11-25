import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { Platform } from "../quiz/types";
import { matchesContent } from "./match";
import { PublishError, type PlatformBackend, type PublishContent, type PublishedRef } from "./types";

export type MockBehavior =
  | "ok"
  | "fail" // 4xx: 確実に未投稿
  | "rate_limit"
  | "error_before_send" // タイムアウトだが実際は未投稿
  | "error_after_send"; // タイムアウトだが実際は投稿済み（最悪ケース）

export type MockScript = (platform: Platform, slug: string, callNo: number) => MockBehavior;

interface MockPost {
  id: string;
  platform: Platform;
  marker: string;
  text: string;
  imageUrl?: string;
  /** X のように媒体が URL を短縮して返す場合の展開済みURL（entities 相当） */
  urls?: string[];
  url: string;
  at: string;
}

/** 疑似SNS。「媒体側に実際に載っている投稿」をファイルに保持し、照合(find)にも答える。実ネットワーク通信は一切しない。 */
export class MockPlatform {
  private calls = new Map<string, number>();
  constructor(
    private file: string,
    private script: MockScript = () => "ok",
  ) {}

  private async read(): Promise<MockPost[]> {
    try {
      return JSON.parse(await fs.readFile(this.file, "utf8"));
    } catch {
      return [];
    }
  }
  async posts(): Promise<MockPost[]> {
    return this.read();
  }
  async reset() {
    await fs.rm(this.file, { force: true });
  }

  backend(platform: Platform): PlatformBackend {
    return {
      post: async (c: PublishContent): Promise<PublishedRef> => {
        const key = platform + ":" + c.question.slug;
        const n = (this.calls.get(key) ?? 0) + 1;
        this.calls.set(key, n);
        const b = this.script(platform, c.question.slug, n);
        const record = async () => {
          const posts = await this.read();
          const id = platform + "_mock_" + randomUUID().slice(0, 8);
          // 本物のXと同様、本文中のURLは t.co に短縮され、元URLは entities(urls) にのみ残る
          const shorten = platform === "x";
          const found = shorten ? c.text.match(/https?:\/\/\S+/g) ?? [] : [];
          const text = shorten ? c.text.replace(/https?:\/\/\S+/g, () => "https://t.co/" + randomUUID().slice(0, 10)) : c.text;
          const post: MockPost = { id, platform, marker: c.marker, text, urls: shorten ? found : undefined, imageUrl: c.imageUrl, url: "https://mock." + platform + ".invalid/p/" + id, at: new Date().toISOString() };
          posts.push(post);
          await fs.mkdir(path.dirname(this.file), { recursive: true });
          await fs.writeFile(this.file, JSON.stringify(posts, null, 2));
          return { externalId: post.id, url: post.url };
        };
        switch (b) {
          case "ok":
            return record();
          case "fail":
            throw new PublishError("[mock] 400 invalid request", "definite");
          case "rate_limit":
            throw new PublishError("[mock] 429 rate limit", "rate_limit", 60_000);
          case "error_before_send":
            throw new PublishError("[mock] timeout（送信前に切断）", "unknown");
          case "error_after_send":
            await record();
            throw new PublishError("[mock] timeout（応答なし）", "unknown");
        }
      },
      find: async (c: PublishContent) => {
        const hit = (await this.read()).find((p) => p.platform === platform && matchesContent(c, { text: p.text, urls: p.urls }));
        return hit ? { externalId: hit.id, url: hit.url } : null;
      },
    };
  }
}

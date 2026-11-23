import { buildInstagramCaption } from "../quiz/templates/instagram";
import { answerUrl, siteOrigin } from "../quiz/templates/common";
import { matchesContent } from "./match";
import { buildThreadsPost } from "../quiz/templates/threads";
import { buildXPost } from "../quiz/templates/x";
import { renderQuestionImage, IG_H, IG_W } from "../quiz/image";
import type { Platform, QuizQuestion } from "../quiz/types";
import {
  PublishError,
  fetchJson,
  requireEnv,
  type PlatformBackend,
  type PublishContent,
  type PublishedRef,
  type Publisher,
} from "./types";

abstract class BasePublisher implements Publisher {
  abstract readonly platform: Platform;
  constructor(
    protected backend: PlatformBackend,
    readonly mode: "dry-run" | "live",
  ) {}
  abstract prepare(q: QuizQuestion): Promise<PublishContent>;
  publish(content: PublishContent): Promise<PublishedRef> {
    return this.backend.post(content);
  }
  lookup(content: PublishContent): Promise<PublishedRef | null> {
    return this.backend.find(content);
  }
  protected wrapBuild<T>(fn: () => T): T {
    try {
      return fn();
    } catch (e) {
      throw new PublishError(String((e as Error).message), "definite");
    }
  }
}

export class ThreadsPublisher extends BasePublisher {
  readonly platform = "threads" as const;
  async prepare(q: QuizQuestion): Promise<PublishContent> {
    const { text } = this.wrapBuild(() => buildThreadsPost(q));
    return { question: q, text, marker: answerUrl(q), matchKind: "url" };
  }
}

export class XPublisher extends BasePublisher {
  readonly platform = "x" as const;
  async prepare(q: QuizQuestion): Promise<PublishContent> {
    const { text } = this.wrapBuild(() => buildXPost(q)); // 加重文字数（URL=23）を検証
    return { question: q, text, marker: answerUrl(q), matchKind: "url" };
  }
}

export class InstagramPublisher extends BasePublisher {
  readonly platform = "instagram" as const;
  async prepare(q: QuizQuestion): Promise<PublishContent> {
    const { text } = this.wrapBuild(() => buildInstagramCaption(q));
    // 画像が生成でき、4:5・PNG であることを投稿前に検証する
    let img;
    try {
      img = await renderQuestionImage(q);
    } catch (e) {
      throw new PublishError("画像生成に失敗: " + (e as Error).message, "definite");
    }
    if (img.width * 5 !== img.height * 4 || img.width !== IG_W || img.height !== IG_H) throw new PublishError("画像が 4:5 ではありません", "definite");
    const imageUrl = new URL("/api/quiz/image/" + q.slug, siteOrigin());
    if (this.mode === "live") {
      if (!q.content_hash) throw new PublishError("承認済み画像のハッシュがありません", "definite");
      imageUrl.searchParams.set("revision", q.content_hash);
    }
    return { question: q, text, imageUrl: imageUrl.href, marker: text, matchKind: "text" };
  }
}

// ───────────── 実API（SNS_MODE=live かつ明示確認がある場合のみ使用。実アカウント未接続のため未検証） ─────────────

function providerId(id: unknown, operation: string): string {
  if (typeof id !== "string" || !/^\d+$/.test(id)) {
    throw new PublishError(operation + ": 有効な応答IDがありません", "unknown");
  }
  return id;
}

const authHeader = (token: string) => ({ Authorization: "Bearer " + token });

export function threadsLiveBackend(): PlatformBackend {
  const base = "https://graph.threads.net/v1.0";
  return {
    async post(c) {
      const user = requireEnv("THREADS_USER_ID");
      const h = { ...authHeader(requireEnv("THREADS_ACCESS_TOKEN")), "Content-Type": "application/json" };
      const cont = (await fetchJson(base + "/" + user + "/threads", { method: "POST", headers: h, body: JSON.stringify({ media_type: "TEXT", text: c.text }) }, "Threads container")) as { id: string };
      const pub = (await fetchJson(base + "/" + user + "/threads_publish", { method: "POST", headers: h, body: JSON.stringify({ creation_id: providerId(cont?.id, "Container creation") }) }, "Threads publish")) as { id: string };
      const id = providerId(pub?.id, "Publication");
      const info = (await fetchJson(base + "/" + id + "?fields=permalink", { headers: h }, "Threads permalink").catch(() => ({}))) as { permalink?: string };
      return { externalId: id, url: info?.permalink ?? null };
    },
    async find(c) {
      const user = requireEnv("THREADS_USER_ID");
      // 取得は直近の1ページのみ。「見つからない」は未投稿の証明ではない（エンジン側で unknown を維持し、手動照合へ）。実APIで未検証。
      const r = (await fetchJson(base + "/" + user + "/threads?fields=id,text,permalink&limit=25", { headers: authHeader(requireEnv("THREADS_ACCESS_TOKEN")) }, "Threads lookup")) as { data?: { id: string; text?: string; permalink?: string }[] };
      const hit = r.data?.find((p) => matchesContent(c, { text: p.text }));
      return hit ? { externalId: hit.id, url: hit.permalink ?? null } : null;
    },
  };
}

export function xLiveBackend(): PlatformBackend {
  // OAuth 2.0 User Context トークン（tweet.write, tweet.read, users.read）を想定。
  const base = "https://api.x.com/2";
  return {
    async post(c) {
      const h = { ...authHeader(requireEnv("X_USER_ACCESS_TOKEN")), "Content-Type": "application/json" };
      const r = (await fetchJson(base + "/tweets", { method: "POST", headers: h, body: JSON.stringify({ text: c.text }) }, "X post")) as { data?: { id: string } };
      const id = providerId(r?.data?.id, "X publication");
      return { externalId: id, url: "https://x.com/i/status/" + id };
    },
    async find(c) {
      const user = requireEnv("X_USER_ID");
      // 本文中の URL は t.co に置換されるため、entities.urls[].expanded_url（展開済みURL）で照合する。取得は直近1ページのみ・実APIで未検証。
      const r = (await fetchJson(base + "/users/" + user + "/tweets?max_results=10&tweet.fields=entities", { headers: authHeader(requireEnv("X_USER_ACCESS_TOKEN")) }, "X lookup")) as { data?: { id: string; text: string; entities?: { urls?: { expanded_url?: string; unwound_url?: string }[] } }[] };
      const hit = r.data?.find((t) => matchesContent(c, { text: t.text, urls: t.entities?.urls?.flatMap((u) => [u.expanded_url, u.unwound_url]) }));
      return hit ? { externalId: hit.id, url: "https://x.com/i/status/" + hit.id } : null;
    },
  };
}

export function instagramLiveBackend(): PlatformBackend {
  const base = "https://graph.facebook.com/" + (process.env.IG_GRAPH_VERSION || "v21.0");
  return {
    async post(c) {
      const user = requireEnv("IG_USER_ID");
      const h = { ...authHeader(requireEnv("IG_ACCESS_TOKEN")), "Content-Type": "application/json" };
      if (!c.imageUrl) throw new PublishError("画像URLがありません", "definite");
      const cont = (await fetchJson(base + "/" + user + "/media", { method: "POST", headers: h, body: JSON.stringify({ image_url: c.imageUrl, caption: c.text }) }, "Instagram container")) as { id: string };
      const pub = (await fetchJson(base + "/" + user + "/media_publish", { method: "POST", headers: h, body: JSON.stringify({ creation_id: providerId(cont?.id, "Container creation") }) }, "Instagram publish")) as { id: string };
      const id = providerId(pub?.id, "Publication");
      const info = (await fetchJson(base + "/" + id + "?fields=permalink", { headers: h }, "Instagram permalink").catch(() => ({}))) as { permalink?: string };
      return { externalId: id, url: info?.permalink ?? null };
    },
    async find(c) {
      const user = requireEnv("IG_USER_ID");
      // キャプション全文の完全一致（正規化後）。取得は直近1ページのみ・実APIで未検証（Instagram 側のキャプション正規化も要確認）。
      const r = (await fetchJson(base + "/" + user + "/media?fields=id,caption,permalink&limit=25", { headers: authHeader(requireEnv("IG_ACCESS_TOKEN")) }, "Instagram lookup")) as { data?: { id: string; caption?: string; permalink?: string }[] };
      const hit = r.data?.find((m) => matchesContent(c, { text: m.caption }));
      return hit ? { externalId: hit.id, url: hit.permalink ?? null } : null;
    },
  };
}

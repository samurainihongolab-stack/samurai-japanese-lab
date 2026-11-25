import { createClient } from "@supabase/supabase-js";
import { bufferInstagram, imageDigest, instagramHash, instagramSnapshot } from "./buffer.mjs";

export type Carousel = {
  id: string;
  snapshot: ReturnType<typeof instagramSnapshot>;
  hash: string;
  scheduled_at: string;
  state: string;
  buffer_post_id: string | null;
  permalink: string | null;
};

const bucket = "instagram-carousels";
const urlLifetimeSeconds = 1800;

export function instagramService(
  env = process.env,
  request: typeof fetch = fetch,
) {
  const publicationEnabled = env.INSTAGRAM_CAROUSEL_ENABLED === "true";
  const { NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: secret } = env;
  if (!url || !secret) throw new Error("InstagramのSupabase設定がありません");
  const db = createClient(url, secret, { auth: { persistSession: false } });
  const storage = db.storage.from(bucket);

  async function readImage(key: string, digest: string) {
    if (key !== digest + ".jpg" || !/^[a-f0-9]{64}$/.test(digest)) throw new Error("画像識別子が不正です");
    const { data, error } = await storage.download(key);
    if (error || !data) throw new Error("画像を取得できません");
    const bytes = Buffer.from(await data.arrayBuffer());
    if (imageDigest(bytes) !== digest) throw new Error("承認画像の内容と一致しません");
    return bytes;
  }

  async function transition(row: Pick<Carousel, "id" | "hash">, from: string, to: string,
    actor?: { id: string; email: string }, bufferId?: string, permalink?: string) {
    const { data, error } = await db.rpc("instagram_transition", {
      p_id: row.id, p_hash: row.hash, p_from: from, p_to: to,
      p_actor: actor?.id ?? "instagram-cron", p_email: actor?.email ?? null,
      p_buffer_id: bufferId ?? null, p_permalink: permalink ?? null,
    });
    if (error) throw new Error("Instagramの状態を保存できません");
    return data === true;
  }

  const adapter = bufferInstagram({
    apiKey: env.BUFFER_API_KEY,
    request,
    publishingEnabled: publicationEnabled,
    signImage: async ({ key, digest }: { key: string; digest: string }) => {
      await readImage(key, digest);
      const expiresAt = Date.now() + urlLifetimeSeconds * 1000;
      const { data, error } = await storage.createSignedUrl(key, urlLifetimeSeconds);
      if (error || !data) throw new Error("画像の一時URLを発行できません");
      return { url: data.signedUrl, expiresAt };
    },
    claim: ({ postId, hash }: { postId: string; hash: string }) =>
      transition({ id: postId, hash }, "approved", "sending"),
    finish: async ({ postId, hash, state, bufferPostId }: {
      postId: string; hash: string; state: string; bufferPostId?: string;
    }) => {
      if (!await transition({ id: postId, hash }, "sending", state, undefined, bufferPostId)) {
        throw new Error("送信結果を確定できません");
      }
    },
  });

  return {
    async list() {
      const { data, error } = await db.from("instagram_carousels").select("*").order("created_at", { ascending: false }).limit(100);
      if (error) throw new Error("Instagram一覧を取得できません");
      return data as Carousel[];
    },
    async upload(file: File) {
      if (!file.size || file.size > 4_000_000 || file.type !== "image/jpeg") throw new Error("4 MB以下のJPEGを選択してください");
      const bytes = Buffer.from(await file.arrayBuffer());
      if (bytes[0] !== 255 || bytes[1] !== 216 || bytes[2] !== 255) throw new Error("JPEG形式が不正です");
      const digest = imageDigest(bytes);
      const key = digest + ".jpg";
      const { error } = await storage.upload(key, bytes, { contentType: "image/jpeg", upsert: false });
      if (error) await readImage(key, digest);
      return { key, digest };
    },
    readImage,
    async save(input: { caption: string; scheduledAt: string; images: { key: string; digest: string }[];
      id?: string; previousHash?: string }, actor: { id: string; email: string }) {
      const channelId = env.BUFFER_INSTAGRAM_CHANNEL_ID;
      if (!channelId) throw new Error("InstagramのBufferチャンネルIDが必要です");
      const snapshot = instagramSnapshot({ channelId, caption: input.caption, scheduledAt: input.scheduledAt, images: input.images });
      await Promise.all(snapshot.images.map(({ key, digest }) => readImage(key, digest)));
      const hash = instagramHash(snapshot);
      if (input.id !== undefined) {
        const { data, error } = await db.rpc("instagram_replace", {
          p_id: input.id, p_previous_hash: input.previousHash, p_snapshot: snapshot,
          p_hash: hash, p_scheduled_at: snapshot.scheduledAt, p_actor: actor.id, p_email: actor.email,
        });
        if (error) throw new Error("下書きを更新できません");
        return data === true;
      }
      const { error } = await db.from("instagram_carousels").insert({
        snapshot, hash, scheduled_at: snapshot.scheduledAt,
      });
      if (error) throw new Error("下書きを保存できません");
      return true;
    },
    async review(id: string, hash: string, approved: boolean, actor: { id: string; email: string }) {
      return transition({ id, hash }, approved ? "draft" : "approved", approved ? "approved" : "draft", actor);
    },
    async run() {
      if (!publicationEnabled) return { state: "disabled" };
      if (!env.BUFFER_API_KEY || !env.BUFFER_INSTAGRAM_CHANNEL_ID) throw new Error("Bufferの設定がありません");
      const now = new Date();
      const stale = new Date(now.getTime() - 5 * 60_000).toISOString();
      const { data, error } = await db.from("instagram_carousels").select("*")
        .or(`and(state.eq.approved,scheduled_at.lte.${now.toISOString()}),state.eq.accepted,and(state.eq.sending,sending_at.lt.${stale})`)
        .order("scheduled_at").limit(10);
      if (error) throw new Error("Instagramの予約を取得できません");
      for (const row of data as Carousel[]) {
        if (row.state === "sending") {
          await transition(row, "sending", "unknown");
        } else if (row.state === "accepted" && row.buffer_post_id) {
          const status = await adapter.checkStatus(row.buffer_post_id);
          if (status.state === "published" || status.state === "failed") {
            await transition(row, "accepted", status.state, undefined, undefined, status.permalink?.match(/^https:\/\/(?:www\.)?instagram\.com\//) ? status.permalink : undefined);
          }
        } else if (row.state === "approved" && row.snapshot.channelId === env.BUFFER_INSTAGRAM_CHANNEL_ID) {
          await adapter.publish({ postId: row.id, approvedHash: row.hash, post: row.snapshot });
        }
      }
      return { state: "checked", count: data.length };
    },
  };
}

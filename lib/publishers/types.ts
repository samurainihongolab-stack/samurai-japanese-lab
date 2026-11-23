import type { Platform, QuizQuestion } from "../quiz/types";

export interface PublishContent {
  question: QuizQuestion;
  text: string;
  /** Instagram のみ: Meta が取得する公開画像URL */
  imageUrl?: string;
  /** 照合用の識別子。matchKind=url なら解答ページURL（問題ごとに一意）、text なら投稿本文の全文（正規化して完全一致）。 */
  marker: string;
  matchKind: "url" | "text";
}

export interface PublishedRef {
  externalId: string;
  url: string | null;
}

/**
 * definite : 媒体側で未投稿であることが確実（4xx・事前検証失敗）→ 再試行可
 * rate_limit: 429。retryAfterMs 後に再試行
 * unknown  : 送ったか不明（タイムアウト・5xx・通信断）→ 自動再送禁止、照合へ
 */
export class PublishError extends Error {
  constructor(
    message: string,
    public kind: "definite" | "rate_limit" | "unknown",
    public retryAfterMs?: number,
  ) {
    super(message);
  }
}

/** 媒体APIの薄いラッパ（本物 or モック）。 */
export interface PlatformBackend {
  post(content: PublishContent): Promise<PublishedRef>;
  find(content: PublishContent): Promise<PublishedRef | null>;
}

export interface Publisher {
  readonly platform: Platform;
  readonly mode: "dry-run" | "live";
  /** 投稿文・画像の検証。失敗時は PublishError(definite) */
  prepare(q: QuizQuestion): Promise<PublishContent>;
  publish(content: PublishContent): Promise<PublishedRef>;
  lookup(content: PublishContent): Promise<PublishedRef | null>;
}

/** 認証情報・トークンをログやエラーに出さない。 */
export function redact(s: string): string {
  return s.replace(/(access_token=|Bearer\s+)[A-Za-z0-9._\-|]+/gi, "$1[REDACTED]");
}

export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new PublishError(`環境変数 ${name} が未設定です`, "definite");
  return v;
}

/** HTTPレスポンスを PublishError 分類に変換。 */
export async function classifyHttp(res: Response, what: string): Promise<never> {
  if (res.status === 429) {
    const ra = Number(res.headers.get("retry-after"));
    throw new PublishError(`${what}: レート制限 (429)`, "rate_limit", Number.isFinite(ra) && ra > 0 ? ra * 1000 : 15 * 60_000);
  }
  if (res.status === 408 || res.status === 409 || res.status >= 500) throw new PublishError(`${what}: サーバーエラー ${res.status}（送信結果不明）`, "unknown");
  throw new PublishError(`${what}: HTTP ${res.status}`, "definite");
}

export async function fetchJson(url: string, init: RequestInit, what: string, timeoutMs = 20_000): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (e) {
    throw new PublishError(`${what}: 通信失敗/タイムアウト（送信結果不明）: ${redact(String(e))}`, "unknown");
  }
  if (!res.ok) await classifyHttp(res, what);
  return res.json();
}

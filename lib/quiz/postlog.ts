import type { Platform, PostAttempt, PostLog } from "./types";

export interface ClaimConfig {
  leaseMs: number; // 送信リース時間（これを超えた sending は「結果不明」とみなす）
  maxAttempts: number;
  backoffBaseMs: number;
}
export const DEFAULT_CLAIM_CONFIG: ClaimConfig = { leaseMs: 5 * 60_000, maxAttempts: 4, backoffBaseMs: 10 * 60_000 };

/**
 * 世代トークン(updated_at)の次の値。呼び出し側が同じ時刻(now)を渡しても必ず前進させる（最低 +1ms）。
 * これにより、同じ読み取りに基づく2回目の更新が世代照合(CAS)を通過しない。
 */
export function nextGeneration(prev: string | null | undefined, now: Date): string {
  const p = prev ? new Date(prev).getTime() : -Infinity;
  return new Date(Math.max(now.getTime(), p + 1)).toISOString();
}

export type SkipReason = "already_succeeded" | "in_progress" | "reconciling" | "backoff" | "max_attempts";

export type ClaimDecision =
  | { action: "send"; patch: Partial<PostLog> }
  | { action: "reconcile"; patch: Partial<PostLog> }
  | { action: "skip"; reason: SkipReason };

/**
 * 重複投稿防止の中核（純粋関数）。(question_id, platform) の既存ログから次の動作を決める。
 * - succeeded は二度と送らない
 * - sending のリース切れ／unknown は「送ったか不明」なので再送せず照合（reconcile）する
 */
export function decideClaim(existing: PostLog | null, now: Date, cfg: ClaimConfig): ClaimDecision {
  const t = now.getTime();
  const lease = new Date(t + cfg.leaseMs).toISOString();
  if (!existing) return { action: "send", patch: { status: "sending", attempts: 1, lease_until: lease } };
  switch (existing.status) {
    case "succeeded":
      return { action: "skip", reason: "already_succeeded" };
    case "sending":
      if (existing.lease_until && new Date(existing.lease_until).getTime() > t) return { action: "skip", reason: "in_progress" };
      return { action: "reconcile", patch: { status: "unknown", lease_until: lease } };
    case "unknown":
      if (existing.lease_until && new Date(existing.lease_until).getTime() > t) return { action: "skip", reason: "reconciling" };
      return { action: "reconcile", patch: { status: "unknown", lease_until: lease } };
    case "failed":
      if (existing.attempts >= cfg.maxAttempts) return { action: "skip", reason: "max_attempts" };
      if (existing.next_retry_at && new Date(existing.next_retry_at).getTime() > t) return { action: "skip", reason: "backoff" };
      return { action: "send", patch: { status: "sending", attempts: existing.attempts + 1, lease_until: lease } };
  }
}

export type PostResult =
  | { type: "succeeded"; externalId: string; url: string | null }
  | { type: "failed"; error: string; retryAfterMs?: number }
  | { type: "unknown"; error: string }
  | { type: "reconciled_found"; externalId: string; url: string | null }
  | { type: "reconciled_missing" }
  /** 管理者が媒体側を目視し「未投稿」と確認した。このときだけ再送可能（failed）に戻す。 */
  | { type: "manual_not_posted"; note?: string }
  /** 送信直前に承認取り消し等を検出し、実際には何も送らずに枠を解放した。試行回数は消費しない。 */
  | { type: "aborted_before_send"; reason: string };

export function applyResult(
  log: PostLog,
  result: PostResult,
  now: Date,
  cfg: ClaimConfig,
  newId: () => string,
): { patch: Partial<PostLog>; attempt: PostAttempt } {
  const ts = now.toISOString();
  const base = { id: newId(), post_log_id: log.id, question_id: log.question_id, platform: log.platform as Platform, attempt_no: log.attempts, at: ts };
  switch (result.type) {
    case "succeeded":
    case "reconciled_found":
      return {
        patch: { status: "succeeded", external_id: result.externalId, external_url: result.url, posted_at: ts, lease_until: null, last_error: null, next_retry_at: null },
        attempt: { ...base, outcome: result.type, error: null },
      };
    case "failed": {
      const wait = result.retryAfterMs ?? cfg.backoffBaseMs * 2 ** Math.max(0, log.attempts - 1);
      return {
        patch: { status: "failed", last_error: result.error, lease_until: null, next_retry_at: new Date(now.getTime() + wait).toISOString() },
        attempt: { ...base, outcome: "failed", error: result.error },
      };
    }
    case "unknown":
      // 送信結果不明: lease を残さず unknown で固定。次回は照合のみ（自動再送しない）。
      return { patch: { status: "unknown", last_error: result.error, lease_until: null }, attempt: { ...base, outcome: "unknown", error: result.error } };
    case "reconciled_missing": {
      // 照合は取得範囲が限られ、投稿が反映される前かもしれない。「見つからない」は未投稿の証明ではないため unknown を維持し、
      // 自動再送しない（人間が媒体側を確認して resolveUnknown で解決する）。
      const msg = "照合で投稿を見つけられませんでしたが、未投稿の証明ではありません。媒体側を確認してください（手動照合が必要）";
      return {
        patch: { status: "unknown", last_error: msg, lease_until: null, next_retry_at: null },
        attempt: { ...base, outcome: "reconciled_missing", error: msg },
      };
    }
    case "manual_not_posted":
      return {
        patch: { status: "failed", last_error: "管理者が媒体側で未投稿を確認" + (result.note ? ": " + result.note : ""), lease_until: null, next_retry_at: null, attempts: Math.min(log.attempts, cfg.maxAttempts - 1) },
        attempt: { ...base, outcome: "reconciled_missing", error: "管理者が未投稿を確認" + (result.note ? ": " + result.note : "") },
      };
    case "aborted_before_send":
      return {
        patch: { status: "failed", attempts: Math.max(0, log.attempts - 1), last_error: "送信前に中止（未送信）: " + result.reason, lease_until: null, next_retry_at: null },
        attempt: { ...base, outcome: "failed", error: "送信前に中止（未送信）: " + result.reason },
      };
  }
}

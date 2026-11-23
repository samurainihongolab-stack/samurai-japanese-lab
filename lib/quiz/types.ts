/** 日本語教員試験クイズ（SNS連携）のドメイン型。既存 lib/db/schema.ts とは独立。 */

export type ChoiceKey = "A" | "B" | "C" | "D";
export const CHOICE_KEYS: ChoiceKey[] = ["A", "B", "C", "D"];

export type QuizStatus = "draft" | "reviewed" | "approved" | "published";
export type Platform = "threads" | "x" | "instagram";
export const PLATFORMS: Platform[] = ["threads", "x", "instagram"];

export interface QuizQuestion {
  /** 内部管理ID。読者向け表示には使わない。 */
  id: string;
  /** HP公開用URL識別子（連番を連想させない）。 */
  slug: string;
  category: string;
  question: string;
  choices: Record<ChoiceKey, string>;
  correct_answer: ChoiceKey;
  explanation: string;
  difficulty: "初級" | "中級" | "上級";
  status: QuizStatus;
  scheduled_at: string | null; // ISO8601
  published_at: string | null;
  reviewed_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  /** 承認者の Supabase ユーザーID は approved_by、表示用メールはこちら */
  approved_by_email: string | null;
  /** 承認時点の本文ハッシュ。投稿時に再計算して一致を検証する */
  content_hash: string | null;
  created_at: string;
  updated_at: string;
}

export type ReviewKind = "ai" | "human";
export type ReviewVerdict = "pass" | "needs_changes" | "fail";

/** 校閲記録。AI一次校閲と人間の確認を区別する。content_hash は校閲した時点の本文。 */
export interface QuizReview {
  id: string;
  question_id: string;
  kind: ReviewKind;
  reviewer: string;
  verdict: ReviewVerdict;
  comments: string;
  checks: { level: "error" | "warning"; message: string }[];
  content_hash: string;
  created_at: string;
}

export interface AuditEntry {
  id: string;
  actor_id: string;
  actor_kind: "human" | "ai" | "system";
  actor_email: string | null;
  action: string;
  entity: string;
  entity_id: string;
  detail: Record<string, unknown>;
  created_at: string;
}

/** SNSごとの投稿状態。 */
export type PostStatus =
  | "sending" // 送信中（リース保持）
  | "succeeded"
  | "failed" // 確定的な失敗（再試行可）
  | "unknown"; // 送信結果不明（自動再送禁止・照合必須）

export interface PostLog {
  id: string;
  question_id: string;
  platform: Platform;
  status: PostStatus;
  attempts: number;
  external_id: string | null;
  external_url: string | null;
  last_error: string | null;
  lease_until: string | null;
  posted_at: string | null;
  next_retry_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PostAttempt {
  id: string;
  post_log_id: string;
  question_id: string;
  platform: Platform;
  attempt_no: number;
  outcome: "succeeded" | "failed" | "unknown" | "reconciled_found" | "reconciled_missing";
  error: string | null;
  at: string;
}

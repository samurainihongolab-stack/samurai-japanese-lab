import type { AuditEntry, Platform, PostAttempt, PostLog, QuizQuestion, QuizReview } from "./types";
import type { ClaimConfig, PostResult, SkipReason } from "./postlog";

export type ClaimResult =
  | { action: "send"; log: PostLog }
  | { action: "reconcile"; log: PostLog }
  | { action: "skip"; reason: SkipReason; log: PostLog };

export interface QuizRepository {
  readonly backend: "file" | "supabase";
  // 問題
  listQuestions(): Promise<QuizQuestion[]>;
  getQuestion(id: string): Promise<QuizQuestion | null>;
  /** 公開条件（published かつ scheduled_at <= now）を満たす問題のみ返す。公開ページ専用。 */
  getPublicBySlug(slug: string, now?: Date): Promise<QuizQuestion | null>;
  listPublic(now?: Date): Promise<QuizQuestion[]>;
  insertIfAbsent(questions: QuizQuestion[]): Promise<number>;
  updateQuestion(id: string, patch: Partial<QuizQuestion>): Promise<QuizQuestion>;
  /** 本文変更時は承認を自動無効化する（withInvalidation）。 */
  // 校閲・監査
  addReview(r: QuizReview): Promise<void>;
  listReviews(questionId?: string): Promise<QuizReview[]>;
  addAudit(a: AuditEntry): Promise<void>;
  listAudit(limit?: number): Promise<AuditEntry[]>;
  /** 接続確認。失敗時は例外（DB障害を空データと誤認しないため）。 */
  ping(): Promise<void>;
  // 投稿履歴
  listPostLogs(questionId?: string): Promise<PostLog[]>;
  listAttempts(questionId?: string): Promise<PostAttempt[]>;
  /** 原子的に (question, platform) を確保する。同時実行しても send は1つだけ。 */
  claimPost(questionId: string, platform: Platform, now: Date, cfg: ClaimConfig): Promise<ClaimResult>;
  /** 管理者の手動再試行: failed を即時再試行可能にする（試行上限・待機時間をリセット）。unknown/succeeded は対象外。 */
  requeueFailed(questionId: string, platform: Platform): Promise<boolean>;
  /**
   * 投稿結果の記録。世代照合(CAS)に失敗した場合（既に状態が進んでいる／確定済み）は何も変更せず現在の行を返す。
   * audit を渡すと、状態更新・履歴挿入・監査ログを一体で記録する（Supabase 版は単一トランザクション、適用されなかった場合は監査も残さない）。
   */
  recordResult(log: PostLog, result: PostResult, now: Date, cfg: ClaimConfig, audit?: AuditEntry): Promise<PostLog>;
}

export const publicFields = (q: QuizQuestion) => q;

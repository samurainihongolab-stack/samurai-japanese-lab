import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuditEntry, Platform, PostAttempt, PostLog, QuizQuestion, QuizReview } from "./types";
import { applyResult, decideClaim, nextGeneration, type ClaimConfig, type PostResult } from "./postlog";
import { withInvalidation } from "./hash";
import type { ClaimResult, QuizRepository } from "./repository";

/**
 * Supabase 実装。※実DB未接続のため未検証（ローカルは FileQuizRepository で検証済み）。
 * 公開ページは anon クライアント（RLSで公開条件を強制）、管理・投稿は service_role。
 */
export class SupabaseQuizRepository implements QuizRepository {
  readonly backend = "supabase" as const;
  constructor(private admin: SupabaseClient, private anon: SupabaseClient) {}

  private ck<T>(r: { data: T; error: { message: string } | null }): T {
    if (r.error) throw new Error(`supabase: ${r.error.message}`);
    return r.data;
  }
  async listQuestions() {
    return this.ck(await this.admin.from("quiz_questions").select("*").order("created_at")) as QuizQuestion[];
  }
  async getQuestion(id: string) {
    return this.ck(await this.admin.from("quiz_questions").select("*").eq("id", id).maybeSingle()) as QuizQuestion | null;
  }
  // 公開列のみ（承認者メール等は列権限で anon に付与されていない。002 マイグレーション参照）
  private static PUBLIC_COLS = "id,slug,category,question,choices,correct_answer,explanation,difficulty,status,scheduled_at,published_at,created_at,updated_at";
  async getPublicBySlug(slug: string) {
    // RLS が status/scheduled_at を強制する。
    return this.ck(await this.anon.from("quiz_questions").select(SupabaseQuizRepository.PUBLIC_COLS).eq("slug", slug).maybeSingle()) as unknown as QuizQuestion | null;
  }
  async listPublic() {
    return this.ck(await this.anon.from("quiz_questions").select(SupabaseQuizRepository.PUBLIC_COLS).order("scheduled_at", { ascending: false })) as unknown as QuizQuestion[];
  }
  async insertIfAbsent(questions: QuizQuestion[]) {
    const r = await this.admin.from("quiz_questions").upsert(questions, { onConflict: "id", ignoreDuplicates: true }).select("id");
    return (this.ck(r) as unknown[]).length;
  }
  async ping() {
    this.ck(await this.admin.from("quiz_questions").select("id").limit(1));
  }
  async addReview(r: QuizReview) {
    this.ck(await this.admin.from("quiz_reviews").insert(r));
  }
  async listReviews(questionId?: string) {
    let q = this.admin.from("quiz_reviews").select("*").order("created_at");
    if (questionId) q = q.eq("question_id", questionId);
    return this.ck(await q) as QuizReview[];
  }
  async addAudit(a: AuditEntry) {
    this.ck(await this.admin.from("admin_audit_log").insert(a));
  }
  async listAudit(limit = 100) {
    return this.ck(await this.admin.from("admin_audit_log").select("*").order("created_at", { ascending: false }).limit(limit)) as AuditEntry[];
  }
  async updateQuestion(id: string, patch: Partial<QuizQuestion>) {
    // 本文変更時の承認無効化は DB トリガー(002)が強制。アプリ側でも同じ規則を適用する。
    const old = await this.getQuestion(id);
    if (!old) throw new Error("question not found: " + id);
    patch = withInvalidation(old, patch);
    return this.ck(
      await this.admin.from("quiz_questions").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id).select().single(),
    ) as QuizQuestion;
  }
  async listPostLogs(questionId?: string) {
    let q = this.admin.from("quiz_post_log").select("*");
    if (questionId) q = q.eq("question_id", questionId);
    return this.ck(await q) as PostLog[];
  }
  async listAttempts(questionId?: string) {
    let q = this.admin.from("quiz_post_attempts").select("*").order("at");
    if (questionId) q = q.eq("question_id", questionId);
    return this.ck(await q) as PostAttempt[];
  }

  /** 楽観ロック(CAS)で原子的に確保。UNIQUE(question_id, platform) が重複行を防ぐ。 */
  async claimPost(questionId: string, platform: Platform, now: Date, cfg: ClaimConfig): Promise<ClaimResult> {
    for (let i = 0; i < 5; i++) {
      const cur = (await this.admin.from("quiz_post_log").select("*").eq("question_id", questionId).eq("platform", platform).maybeSingle()).data as PostLog | null;
      const d = decideClaim(cur, now, cfg);
      if (d.action === "skip") return { action: "skip", reason: d.reason, log: cur! };
      const ts = now.toISOString();
      if (!cur) {
        const ins = await this.admin.from("quiz_post_log").insert({ id: randomUUID(), question_id: questionId, platform, created_at: ts, updated_at: ts, ...d.patch }).select().single();
        if (ins.error) continue; // unique 違反 = 他プロセスが先に確保 → 再判定
        return { action: d.action, log: ins.data as PostLog };
      }
      const upd = await this.admin.from("quiz_post_log").update({ ...d.patch, updated_at: nextGeneration(cur.updated_at, now) }).eq("id", cur.id).eq("updated_at", cur.updated_at).select();
      if (upd.data && upd.data.length === 1) return { action: d.action, log: upd.data[0] as PostLog };
    }
    throw new Error("claimPost: contention");
  }
  async requeueFailed(questionId: string, platform: Platform) {
    const r = await this.admin.from("quiz_post_log").update({ next_retry_at: null, attempts: 1, updated_at: new Date().toISOString() }).eq("question_id", questionId).eq("platform", platform).eq("status", "failed").select("id");
    return ((this.ck(r) as unknown[]) ?? []).length > 0;
  }
  /**
   * 状態更新・履歴(quiz_post_attempts)・監査ログを DB 関数 quiz_record_post_result(004) で単一トランザクションとして記録する。
   * CAS(updated_at)不一致／確定済みの場合は applied=false で何も変更されず、現在の行を返す。
   * RPC 自体が失敗した場合は例外（DB 側で全体ロールバック済み。状態だけ変わることはない）。
   */
  async recordResult(log: PostLog, result: PostResult, now: Date, cfg: ClaimConfig, audit?: AuditEntry) {
    const { patch, attempt } = applyResult(log, result, now, cfg, randomUUID);
    const terminalOk = result.type === "succeeded" || result.type === "reconciled_found";
    const r = await this.admin.rpc("quiz_record_post_result", {
      p_log_id: log.id,
      p_expected_updated_at: log.updated_at,
      p_patch: { ...patch, updated_at: now.toISOString() },
      p_attempt: attempt,
      p_terminal_ok: terminalOk,
      p_audit: audit ?? null,
    });
    const out = this.ck(r) as { applied: boolean; log: PostLog };
    return out.log;
  }
}

import { randomUUID } from "node:crypto";
import { CONTENT_FIELDS, contentHash } from "./hash";
import type { QuizRepository } from "./repository";
import { DEFAULT_CLAIM_CONFIG } from "./postlog";
import type { AuditEntry, Platform, PostLog, QuizQuestion, QuizReview, ReviewVerdict } from "./types";
import { hasErrors, validateQuestion } from "./validate";

/**
 * 操作主体。human は認証済みの管理者（lib/auth/admin の AdminUser から作る）だけが名乗れる。
 * AI・システムは最終承認できない。将来 reviewer を足す場合は role の許可を can() 側で管理する。
 */
export type Actor =
  | { kind: "human"; id: string; email: string; role: "admin" | "reviewer" }
  | { kind: "ai"; id: string }
  | { kind: "system"; id: string };

export const humanActor = (u: { id: string; email: string; role: "admin" | "reviewer" }): Actor => ({ kind: "human", id: u.id, email: u.email, role: u.role });

function auditEntry(actor: Actor, action: string, entityId: string, detail: Record<string, unknown> = {}): AuditEntry {
  return {
    id: randomUUID(),
    actor_id: actor.id,
    actor_kind: actor.kind,
    actor_email: actor.kind === "human" ? actor.email : null,
    action,
    entity: "quiz_question",
    entity_id: entityId,
    detail,
    created_at: new Date().toISOString(),
  };
}
async function audit(repo: QuizRepository, actor: Actor, action: string, entityId: string, detail: Record<string, unknown> = {}) {
  await repo.addAudit(auditEntry(actor, action, entityId, detail));
}

/** 最新の校閲（本文ハッシュが現在と一致するもののみ有効）。 */
export function latestValidReview(reviews: QuizReview[], q: QuizQuestion, kind?: "ai" | "human"): QuizReview | null {
  const h = contentHash(q);
  const valid = reviews.filter((r) => r.question_id === q.id && r.content_hash === h && (!kind || r.kind === kind));
  return valid.sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0] ?? null;
}

/**
 * AI による一次校閲を記録する（step 2-3）。整合性チェックの結果を添え、pass かつエラーなしなら draft → reviewed。
 * 校閲は「承認」ではない。reviewed は「最終承認待ち」を意味する。
 */
export async function recordAiReview(
  repo: QuizRepository,
  id: string,
  input: { reviewer: string; verdict: ReviewVerdict; comments: string },
): Promise<{ question: QuizQuestion; review: QuizReview }> {
  const q = await repo.getQuestion(id);
  if (!q) throw new Error("question not found");
  const checks = validateQuestion(q);
  const verdict: ReviewVerdict = hasErrors(checks) && input.verdict === "pass" ? "needs_changes" : input.verdict;
  const review: QuizReview = {
    id: randomUUID(),
    question_id: id,
    kind: "ai",
    reviewer: input.reviewer,
    verdict,
    comments: input.comments,
    checks,
    content_hash: contentHash(q),
    created_at: new Date().toISOString(),
  };
  await repo.addReview(review);
  let question = q;
  if (verdict === "pass" && q.status === "draft") question = await repo.updateQuestion(id, { status: "reviewed", reviewed_by: input.reviewer });
  await audit(repo, { kind: "ai", id: input.reviewer }, "ai_review", id, { verdict, errors: checks.filter((c) => c.level === "error").length });
  return { question, review };
}

/**
 * 最終承認（step 4）。認証済みの人間の admin だけが実行できる。
 * 前提: status=reviewed、現在の本文に対する AI 一次校閲(pass)が存在、整合性エラーなし、予約日時あり。
 * 承認時の本文ハッシュを保存し、投稿時に再検証する。
 */
export async function approve(repo: QuizRepository, id: string, actor: Actor, scheduledAt: Date, expectedHash: string): Promise<QuizQuestion> {
  if (actor.kind !== "human") throw new Error("最終承認は人間の管理者のみ実行できます（AI・システムは不可）");
  if (actor.role !== "admin") throw new Error("最終承認には admin 権限が必要です");
  if (typeof expectedHash !== "string" || !/^[0-9a-f]{64}$/.test(expectedHash)) throw new Error("承認には、画面で確認した本文のハッシュ(contentHash)が必要です");
  const q = await repo.getQuestion(id);
  if (!q) throw new Error("question not found");
  // 本文固定: 管理者が画面で確認した本文と、いま承認しようとしている最新本文が一致することを要求する（古い画面からの承認を防ぐ）。
  // ※ この照合と updateQuestion の間に別操作が入る隙間は残るが、投稿直前に承認時ハッシュを再検証するため、その場合は投稿されない（fail-closed）。
  if (contentHash(q) !== expectedHash) throw new ApprovalConflictError();
  if (q.status !== "reviewed") throw new Error(`AI一次校閲済み(reviewed)のみ承認できます (現在: ${q.status})`);
  if (Number.isNaN(scheduledAt.getTime())) throw new Error("予約日時が不正です");
  if (hasErrors(validateQuestion(q))) throw new Error("整合性エラーがあるため承認できません");
  const review = latestValidReview(await repo.listReviews(id), q, "ai");
  if (!review || review.verdict !== "pass") throw new Error("現在の本文に対する AI 一次校閲(pass)がありません。本文変更後は再校閲が必要です");
  const hash = contentHash(q);
  const out = await repo.updateQuestion(id, {
    status: "approved",
    approved_by: actor.id,
    approved_by_email: actor.email,
    approved_at: new Date().toISOString(),
    content_hash: hash,
    scheduled_at: scheduledAt.toISOString(),
  });
  await audit(repo, actor, "approve", id, { content_hash: hash, scheduled_at: scheduledAt.toISOString(), ai_review_id: review.id });
  return out;
}

/** 承認の取り消し（approved → draft）。admin のみ。 */
export async function revokeApproval(repo: QuizRepository, id: string, actor: Actor, reason: string): Promise<QuizQuestion> {
  if (actor.kind !== "human" || actor.role !== "admin") throw new Error("承認の取り消しは admin のみ");
  const q = await repo.getQuestion(id);
  if (!q) throw new Error("question not found");
  if (q.status === "draft") return q;
  const out = await repo.updateQuestion(id, { status: "draft", approved_by: null, approved_by_email: null, approved_at: null, content_hash: null, published_at: null, scheduled_at: null });
  await audit(repo, actor, "revoke_approval", id, { reason, previous_status: q.status });
  return out;
}

export const EDITABLE_FIELDS = ["question", "choices", "correct_answer", "explanation", "category", "difficulty"] as const;
export class PostStateConflictError extends Error {
  readonly status = 409;
  constructor() {
    super("投稿状態が他の操作で更新されたため、手動解決は適用されませんでした。画面を再読み込みして現在の状態を確認してください。");
    this.name = "PostStateConflictError";
  }
}
export class ApprovalConflictError extends Error {
  readonly status = 409;
  constructor() {
    super("確認した本文と現在の本文が一致しません。本文が変更されています。最新の内容を再表示して確認し直してください。");
    this.name = "ApprovalConflictError";
  }
}

export type ContentPatch = Partial<Pick<QuizQuestion, "question" | "choices" | "correct_answer" | "explanation" | "category" | "difficulty">>;

/** 本文の編集。本文（問題・選択肢・正答・解説）が変わると承認は自動で無効化され draft に戻る。 */
export async function editContent(repo: QuizRepository, id: string, actor: Actor, patch: ContentPatch): Promise<{ question: QuizQuestion; invalidated: boolean }> {
  if (actor.kind !== "human" || actor.role !== "admin") throw new Error("編集は admin のみ");
  // 型は実行時に入力を制限しない。status / approved_* / content_hash / scheduled_at 等の改ざんで承認フローを迂回させないため許可リストで検証する。
  if (typeof patch !== "object" || patch === null || Array.isArray(patch)) throw new Error("patch は オブジェクトである必要があります");
  const unknown = Object.keys(patch).filter((k) => !(EDITABLE_FIELDS as readonly string[]).includes(k));
  if (unknown.length) throw new Error("編集できない項目が含まれています: " + unknown.join(", "));
  const before = await repo.getQuestion(id);
  if (!before) throw new Error("question not found");
  const out = await repo.updateQuestion(id, patch);
  const invalidated = before.status !== "draft" && out.status === "draft";
  await audit(repo, actor, "edit", id, { fields: Object.keys(patch), content_changed: CONTENT_FIELDS.some((f) => f in patch), invalidated_approval: invalidated });
  return { question: out, invalidated };
}

/**
 * 結果不明(unknown)の投稿を、管理者が媒体側を目視で確認したうえで解決する。
 * posted: 投稿済みと記録（再送しない）。not_posted: 未投稿を確認 → このときだけ再送可能（failed）へ。
 */
export async function resolveUnknown(
  repo: QuizRepository,
  questionId: string,
  platform: Platform,
  actor: Actor,
  input: { resolution: "posted" | "not_posted"; note?: string; externalId?: string; url?: string | null },
): Promise<PostLog> {
  if (actor.kind !== "human" || actor.role !== "admin") throw new Error("手動照合の解決は admin のみ");
  const log = (await repo.listPostLogs(questionId)).find((l) => l.platform === platform);
  if (!log) throw new Error("投稿ログがありません");
  if (log.status !== "unknown") throw new Error(`手動解決できるのは unknown のみです (現在: ${log.status})`);
  const now = new Date();
  // 監査ログは状態更新と一体で記録する（Supabase 版は同一トランザクション。CAS 不一致で適用されなければ監査も残さない）。
  const entry = auditEntry(actor, "resolve_unknown", questionId, { platform, resolution: input.resolution, note: input.note ?? null, external_id: input.externalId ?? null });
  let out: PostLog;
  if (input.resolution === "posted") {
    if (!input.externalId?.trim()) throw new Error("投稿済みとして記録するには、媒体側の投稿ID（または投稿URL）が必要です");
    out = await repo.recordResult(log, { type: "reconciled_found", externalId: input.externalId.trim(), url: input.url ?? null }, now, DEFAULT_CLAIM_CONFIG, entry);
  } else if (input.resolution === "not_posted") {
    out = await repo.recordResult(log, { type: "manual_not_posted", note: input.note }, now, DEFAULT_CLAIM_CONFIG, entry);
  } else {
    throw new Error("resolution は posted / not_posted");
  }
  // CAS 不一致（他の操作で既に状態が進んだ）の場合は適用されていない。成功を装わず、画面の再読み込みを促す。
  const applied = input.resolution === "posted" ? out.status === "succeeded" && out.external_id === input.externalId!.trim() : out.status === "failed" && (out.last_error ?? "").startsWith("管理者が媒体側で未投稿を確認");
  if (!applied) throw new PostStateConflictError();
  return out;
}

export { audit as recordAudit };

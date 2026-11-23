import { NextRequest, NextResponse } from "next/server";
import { authorize, can } from "@/lib/auth/admin";
import { getRepository } from "@/lib/quiz";
import { createPublishers, publicationMode } from "@/lib/publishers";
import { runPublishCycle } from "@/lib/publishers/engine";
import { ApprovalConflictError, PostStateConflictError, approve, editContent, humanActor, latestValidReview, recordAudit, resolveUnknown, revokeApproval, type ContentPatch } from "@/lib/quiz/workflow";
import { contentHash } from "@/lib/quiz/hash";
import { PLATFORMS, type Platform } from "@/lib/quiz/types";
import { validateQuestion } from "@/lib/quiz/validate";

export const dynamic = "force-dynamic";

const fail = (status: number, error: string, extra: Record<string, unknown> = {}) => NextResponse.json({ success: false, error, ...extra }, { status });

// GET: 問題一覧 + AI校閲 + 媒体別投稿状態 + エラー履歴。DB障害は 503 で明示する（空データと誤認させない）。
export async function GET(req: NextRequest) {
  const auth = await authorize(req, "read");
  if (!auth.ok) return fail(auth.status, auth.error);
  try {
    const repo = getRepository();
    await repo.ping();
    const [questions, logs, attempts, reviews] = await Promise.all([repo.listQuestions(), repo.listPostLogs(), repo.listAttempts(), repo.listReviews()]);
    const data = questions.map((q) => {
      const ai = latestValidReview(reviews, q, "ai");
      return {
        ...q,
        issues: validateQuestion(q),
        ai_review: ai ? { verdict: ai.verdict, reviewer: ai.reviewer, comments: ai.comments, at: ai.created_at } : null,
        hash_ok: q.content_hash ? contentHash(q) === q.content_hash : null,
        current_hash: contentHash(q), // 承認要求に添えて返す（画面で確認した本文の固定）
        posts: PLATFORMS.map((p) => logs.find((l) => l.question_id === q.id && l.platform === p) ?? null),
        errors: attempts.filter((a) => a.question_id === q.id && a.error).slice(-10),
      };
    });
    return NextResponse.json({ success: true, mode: process.env.SNS_MODE === "live" ? "live" : "dry-run", backend: repo.backend, connection: "ok", user: { email: auth.user.email, role: auth.user.role }, data });
  } catch (e) {
    console.error("[admin/quiz] データベース接続障害:", (e as Error).message);
    return fail(503, "DB_UNAVAILABLE", { detail: "データベースに接続できません。設定または障害を確認してください。", connection: "error" });
  }
}

// POST: { action: "approve" | "edit" | "revoke" | "retry" | "run", id, ... }
export async function POST(req: NextRequest) {
  const needed = "approve" as const; // 状態変更はすべて admin 権限（将来 reviewer を分ける時は action ごとに切替）
  const auth = await authorize(req, needed);
  if (!auth.ok) return fail(auth.status, auth.error);
  const body = (await req.json().catch(() => ({}))) as { action?: string; id?: string; scheduledAt?: string; platform?: Platform; confirmed?: boolean; patch?: ContentPatch; reason?: string; expectedHash?: string; resolution?: "posted" | "not_posted"; note?: string; externalId?: string; url?: string };
  const actor = humanActor(auth.user);
  try {
    const publishAction = body.action === "run" || body.action === "retry";
    if ((publishAction || body.action === "resolve_unknown") && !can(auth.user.role, "publish_ops")) {
      return fail(403, "Publication permission required");
    }
    if (publishAction && publicationMode() === "disabled") {
      return fail(409, "永続DBではドライランの投稿処理を停止しています");
    }
    const repo = getRepository();
    switch (body.action) {
      case "approve": {
        if (body.confirmed !== true) throw new Error("確認チェックが必要です（confirmed: true）");
        const at = new Date(body.scheduledAt ?? "");
        return NextResponse.json({ success: true, data: await approve(repo, body.id!, actor, at, body.expectedHash as string) });
      }
      case "edit":
        return NextResponse.json({ success: true, ...(await editContent(repo, body.id!, actor, body.patch ?? {})) });
      case "revoke":
        return NextResponse.json({ success: true, data: await revokeApproval(repo, body.id!, actor, body.reason ?? "") });
      case "resolve_unknown": {
        if (!body.id || !body.platform || !PLATFORMS.includes(body.platform) || !body.resolution) throw new Error("id / platform / resolution が必要です");
        return NextResponse.json({ success: true, data: await resolveUnknown(repo, body.id, body.platform, actor, { resolution: body.resolution, note: body.note, externalId: body.externalId, url: body.url ?? null }) });
      }
      case "retry": {
        if (!body.id || !body.platform || !PLATFORMS.includes(body.platform)) throw new Error("id / platform が必要です");
        const publishers = createPublishers();
        const requeued = await repo.requeueFailed(body.id, body.platform);
        await recordAudit(repo, actor, "retry", body.id, { platform: body.platform, requeued });
        const report = await runPublishCycle({ repo, publishers, onlyQuestionId: body.id });
        return NextResponse.json({ success: true, requeued, report });
      }
      case "run": {
        const publishers = createPublishers();
        await recordAudit(repo, actor, "manual_run", body.id ?? "-", {});
        const report = await runPublishCycle({ repo, publishers, onlyQuestionId: body.id });
        return NextResponse.json({ success: true, report });
      }
      default:
        return fail(400, "unknown action");
    }
  } catch (e) {
    if (e instanceof ApprovalConflictError) return fail(409, e.message, { code: "APPROVAL_CONFLICT" });
    if (e instanceof PostStateConflictError) return fail(409, e.message, { code: "POST_STATE_CONFLICT" });
    return fail(400, (e as Error).message);
  }
}

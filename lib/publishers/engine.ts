import { contentHash } from "../quiz/hash";
import { DEFAULT_CLAIM_CONFIG, type ClaimConfig } from "../quiz/postlog";
import type { QuizRepository } from "../quiz/repository";
import { PLATFORMS, type Platform, type PostLog, type QuizQuestion } from "../quiz/types";
import { hasErrors, validateQuestion } from "../quiz/validate";
import { PublishError, redact, type Publisher } from "./types";

export type PlatformOutcome =
  | { platform: Platform; result: "posted"; url: string | null; warning?: string }
  | { platform: Platform; result: "reconciled_found" | "reconciled_missing" }
  | { platform: Platform; result: "skipped"; reason: string }
  | { platform: Platform; result: "failed" | "unknown" | "rate_limited"; error: string };

export interface RunReport {
  question: string | null; // slug（内部IDは出さない）
  stage: "idle" | "blocked" | "hp_published" | "done";
  note?: string;
  outcomes: PlatformOutcome[];
}

export interface EngineOptions {
  repo: QuizRepository;
  publishers: Record<Platform, Publisher>;
  now?: Date;
  config?: ClaimConfig;
  /** 1日（JST）に新規着手する問題数。既定1 */
  maxNewPerDay?: number;
  /** HP公開確認。既定は公開ページと同じ判定（repo.getPublicBySlug）。実運用では HTTP 確認に差し替える。 */
  verifyHp?: (q: QuizQuestion, now: Date) => Promise<boolean>;
  /** 指定時はその問題のみ対象（管理画面の手動実行）。 */
  onlyQuestionId?: string;
}

const jstDay = (d: Date) => new Date(d.getTime() + 9 * 3600_000).toISOString().slice(0, 10);

function settled(logs: PostLog[], cfg: ClaimConfig): boolean {
  return PLATFORMS.every((p) => {
    const l = logs.find((x) => x.platform === p);
    return !!l && (l.status === "succeeded" || (l.status === "failed" && l.attempts >= cfg.maxAttempts));
  });
}

/**
 * 1回の実行で最大1問を処理する（1日1問設計）。
 * 順序: 承認確認 → HP公開 → HP公開確認 → 媒体ごとに独立して投稿 → 結果保存。
 */
export async function runPublishCycle(opts: EngineOptions): Promise<RunReport> {
  const { repo, publishers } = opts;
  const now = opts.now ?? new Date();
  const cfg = opts.config ?? DEFAULT_CLAIM_CONFIG;
  const maxNewPerDay = opts.maxNewPerDay ?? 1;

  const [questions, allLogs] = await Promise.all([repo.listQuestions(), repo.listPostLogs()]);

  // dry-run の模擬投稿ログ（external_id に "_mock_"）が残ったまま live に切り替えると、「投稿済み」と誤認して実投稿が欠落する。
  // ログにモードの列がないため、安全側に倒して live は停止し、人間が dry-run ログを整理してから再開する。
  if (Object.values(publishers).some((p) => p.mode === "live") && allLogs.some((l) => l.external_id?.includes("_mock_"))) {
    return { question: null, stage: "blocked", note: "dry-run の模擬投稿ログが残っているため live 投稿を停止（人間が模擬ログを整理してから再開）", outcomes: [] };
  }
  const due = questions
    .filter((q) => (q.status === "approved" || q.status === "published") && q.scheduled_at && new Date(q.scheduled_at) <= now)
    .filter((q) => !opts.onlyQuestionId || q.id === opts.onlyQuestionId)
    .sort((a, b) => (a.scheduled_at! < b.scheduled_at! ? -1 : 1));

  // 未完了の最も古い問題を先に完了させる（完了/上限到達まで次へ進まない）
  // status=approved の問題は、過去のSNS成功ログがあってもHP公開が必要（取り消し→再承認でHPが閉じたまま塞がらないように）。
  // SNS側は claimPost が already_succeeded で skip するので重複投稿しない。
  const target = due.find((q) => q.status === "approved" || !settled(allLogs.filter((l) => l.question_id === q.id), cfg));
  if (!target) return { question: null, stage: "idle", note: "対象なし", outcomes: [] };

  const logs = allLogs.filter((l) => l.question_id === target.id);
  if (logs.length === 0 && !opts.onlyQuestionId) {
    const startedToday = new Set(allLogs.filter((l) => jstDay(new Date(l.created_at)) === jstDay(now)).map((l) => l.question_id));
    if (startedToday.size >= maxNewPerDay) return { question: target.slug, stage: "idle", note: "本日の新規投稿枠を使用済み", outcomes: [] };
  }

  // 1. 承認状態の確認（承認者記名・整合性）
  if (!target.approved_by || !target.approved_at) return { question: target.slug, stage: "blocked", note: "承認者の記録がありません", outcomes: [] };
  if (!target.content_hash || contentHash(target) !== target.content_hash) {
    return { question: target.slug, stage: "blocked", note: "承認時の本文ハッシュと不一致（承認後に本文が変更された可能性）のため投稿しません", outcomes: [] };
  }
  const issues = validateQuestion(target);
  if (hasErrors(issues)) return { question: target.slug, stage: "blocked", note: "整合性エラー: " + issues.filter((i) => i.level === "error").map((i) => i.message).join(" / "), outcomes: [] };

  // 2. HP解答ページを公開
  let q = target;
  let stage: RunReport["stage"] = "done";
  if (q.status === "approved") {
    q = await repo.updateQuestion(q.id, { status: "published", published_at: now.toISOString() });
    stage = "hp_published";
  }
  // 3. HPの公開状態を確認（失敗したらSNSへ進まない）
  const ok = await (opts.verifyHp ?? (async (x, n) => !!(await repo.getPublicBySlug(x.slug, n))))(q, now);
  if (!ok) return { question: q.slug, stage: "blocked", note: "HP公開を確認できないためSNS投稿を中止", outcomes: [] };

  // 4-5. 媒体ごとに独立処理（1媒体の失敗は他媒体に影響せず、成功済み媒体は再送しない）
  const outcomes: PlatformOutcome[] = [];
  for (const platform of PLATFORMS) outcomes.push(await runPlatform(repo, publishers[platform], q, now, cfg));
  return { question: q.slug, stage, outcomes };
}

async function runPlatform(repo: QuizRepository, pub: Publisher, q: QuizQuestion, now: Date, cfg: ClaimConfig): Promise<PlatformOutcome> {
  const platform = pub.platform;
  // 送信直前に最新の本文を取り直し、承認時ハッシュと再照合する（承認後の改ざん・変更を検出）
  const fresh = await repo.getQuestion(q.id);
  if (!fresh || fresh.status !== "published" || !fresh.content_hash || contentHash(fresh) !== fresh.content_hash) {
    return { platform, result: "skipped", reason: "content_hash_mismatch" };
  }
  q = fresh;
  const claim = await repo.claimPost(q.id, platform, now, cfg);
  if (claim.action === "skip") return { platform, result: "skipped", reason: claim.reason };

  try {
    const content = await pub.prepare(q);

    if (claim.action === "reconcile") {
      // 送信結果が不明だった投稿: 再送せず、媒体側に存在するか照合する
      const found = await pub.lookup(content);
      if (found) {
        await repo.recordResult(claim.log, { type: "reconciled_found", externalId: found.externalId, url: found.url }, now, cfg);
        return { platform, result: "reconciled_found" };
      }
      await repo.recordResult(claim.log, { type: "reconciled_missing" }, now, cfg);
      return { platform, result: "reconciled_missing" }; // 未投稿を手動確認するまで自動再送しない
    }

    // 送信直前の再確認: prepare（画像生成など）の間に承認取り消し・本文変更が起きていないか。
    // 外部API送信とDB更新は単一トランザクションにできないため、この確認と送信開始の間の極小の隙間は残る（残余リスク）。
    const latest = await repo.getQuestion(q.id);
    if (!latest || latest.status !== "published" || !latest.content_hash || contentHash(latest) !== latest.content_hash || latest.content_hash !== q.content_hash) {
      await repo.recordResult(claim.log, { type: "aborted_before_send", reason: "承認の取り消し/本文変更を検出" }, now, cfg);
      return { platform, result: "skipped", reason: "approval_revoked" };
    }

    const ref = await pub.publish(content);
    await repo.recordResult(claim.log, { type: "succeeded", externalId: ref.externalId, url: ref.url }, now, cfg);
    // 送信中に取り消された場合は止められない。投稿済みの事実を記録しつつ警告を返す（人間が媒体側の投稿を確認・削除判断する）。
    const after = await repo.getQuestion(q.id);
    const warning = !after || after.status !== "published" || after.content_hash !== q.content_hash ? "送信中に承認が取り消された可能性があります。投稿済みのため媒体側を確認してください" : undefined;
    return warning ? { platform, result: "posted", url: ref.url, warning } : { platform, result: "posted", url: ref.url };
  } catch (e) {
    const msg = redact(e instanceof Error ? e.message : String(e));
    // 想定外の例外、および照合中の失敗は安全側（不明のまま・再送しない）に倒す
    const kind = claim.action === "reconcile" ? "unknown" : e instanceof PublishError ? e.kind : "unknown";
    if (kind === "unknown") {
      await repo.recordResult(claim.log, { type: "unknown", error: msg }, now, cfg);
      return { platform, result: "unknown", error: msg };
    }
    await repo.recordResult(claim.log, { type: "failed", error: msg, retryAfterMs: e instanceof PublishError ? e.retryAfterMs : undefined }, now, cfg);
    return { platform, result: kind === "rate_limit" ? "rate_limited" : "failed", error: msg };
  }
}

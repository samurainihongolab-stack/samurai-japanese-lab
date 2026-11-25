// AI一次校閲の記録。最終承認ではない（承認は認証済みの人間の管理者のみ）。
// 使い方: tsx scripts/ai-review.mts <questionId|all> --verdict pass|needs_changes|fail --comment "所見"
import { getRepository } from "../lib/quiz";
import { recordAiReview } from "../lib/quiz/workflow";

const a = process.argv.slice(2);
const target = a[0];
const opt = (k: string) => a[a.indexOf(k) + 1];
if (!target || a.indexOf("--verdict") < 0) throw new Error("usage: ai-review <id|all> --verdict pass|needs_changes|fail --comment ...");
const repo = getRepository();
const ids = target === "all" ? (await repo.listQuestions()).filter((q) => q.status === "draft").map((q) => q.id) : [target];
for (const id of ids) {
  const r = await recordAiReview(repo, id, { reviewer: "claude-ai", verdict: opt("--verdict") as "pass", comments: opt("--comment") ?? "" });
  console.log(id, "verdict:", r.review.verdict, "status:", r.question.status, "checks:", JSON.stringify(r.review.checks));
}

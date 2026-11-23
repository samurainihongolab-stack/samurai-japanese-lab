import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { FileQuizRepository } from "../lib/quiz/file-repo";
import { renderQuestionImage } from "../lib/quiz/image";
import { seedToQuestions } from "../lib/quiz/seed";
import { buildInstagramCaption } from "../lib/quiz/templates/instagram";
import { buildThreadsPost } from "../lib/quiz/templates/threads";
import { buildXPost, xWeightedLength } from "../lib/quiz/templates/x";
import { isPubliclyVisible, validateQuestion, hasErrors } from "../lib/quiz/validate";
import { approve as approveWithHash, editContent, humanActor, recordAiReview, resolveUnknown, revokeApproval } from "../lib/quiz/workflow";
import { contentHash } from "../lib/quiz/hash";
import { runPublishCycle } from "../lib/publishers/engine";
import { createMock, createPublishers } from "../lib/publishers";
import type { MockScript } from "../lib/publishers/mock";
import { DEFAULT_CLAIM_CONFIG } from "../lib/quiz/postlog";

process.env.NEXT_PUBLIC_SITE_URL = "https://example.test";
const DAY = 86_400_000;
const ADMIN = humanActor({ id: "admin-1", email: "admin@example.test", role: "admin" });
const aiReview = (repo: FileQuizRepository, id: string) => recordAiReview(repo, id, { reviewer: "ai-test", verdict: "pass", comments: "ok" });
const T0 = new Date("2026-12-01T03:00:00Z"); // JST 12:00
// 管理画面と同じく「いま画面で確認した本文のハッシュ」を添えて承認する（ハッシュ固定の挙動そのものは tests/safety-fixes.test.mts で検証）
const approve = async (repo: FileQuizRepository, id: string, actor: Parameters<typeof approveWithHash>[2], at: Date) => approveWithHash(repo, id, actor, at, contentHash((await repo.getQuestion(id))!));

async function setup(script?: MockScript, approveAll = true) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "quiz-test-"));
  const repo = new FileQuizRepository(path.join(dir, "store.json"));
  const mock = createMock(script, path.join(dir, "mock.json"));
  await repo.insertIfAbsent(seedToQuestions(T0));
  if (approveAll) {
    for (const q of await repo.listQuestions()) {
      await aiReview(repo, q.id);
      await approve(repo, q.id, ADMIN, new Date(T0.getTime() - 1000));
    }
  }
  const publishers = createPublishers({ mock });
  return { repo, mock, publishers };
}
const run = (s: Awaited<ReturnType<typeof setup>>, now: Date, extra = {}) => runPublishCycle({ repo: s.repo, publishers: s.publishers, now, ...extra });

// ───── 2. データ整合性 ─────
test("4問がすべて整合性検査を通過する", () => {
  const qs = seedToQuestions();
  assert.equal(qs.length, 4);
  for (const q of qs) assert.deepEqual(validateQuestion(q).filter((i) => i.level === "error"), [], q.slug);
  assert.deepEqual(qs.map((q) => q.correct_answer), ["B", "C", "B", "B"]);
  assert.ok(qs.every((q) => q.status === "draft" && !q.approved_by), "seed は未承認(draft)");
});

test("不正データを検出する（重複選択肢・不正な正答・解説不一致）", () => {
  const q = seedToQuestions()[0];
  assert.ok(hasErrors(validateQuestion({ ...q, choices: { ...q.choices, C: q.choices.A } })));
  assert.ok(hasErrors(validateQuestion({ ...q, correct_answer: "E" as never })));
  assert.ok(hasErrors(validateQuestion({ ...q, correct_answer: "A" })), "正答Aなら解説に語がなく不一致");
  assert.ok(hasErrors(validateQuestion({ ...q, slug: "Bad Slug" })));
});

test("公開判定: published かつ予約時刻到達のみ", () => {
  const now = new Date("2026-12-01T00:00:00Z");
  const past = "2026-11-30T00:00:00Z";
  const future = "2026-12-02T00:00:00Z";
  assert.equal(isPubliclyVisible({ status: "published", scheduled_at: past }, now), true);
  assert.equal(isPubliclyVisible({ status: "published", scheduled_at: future }, now), false);
  for (const st of ["draft", "reviewed", "approved"] as const) assert.equal(isPubliclyVisible({ status: st, scheduled_at: past }, now), false);
  assert.equal(isPubliclyVisible({ status: "published", scheduled_at: null }, now), false);
});

// ───── 4. 投稿文 ─────
test("SNS投稿文: 連番・内部ID・正答表示なし／文字数制限内／URL", () => {
  for (const q of seedToQuestions()) {
    const th = buildThreadsPost(q);
    const x = buildXPost(q);
    const ig = buildInstagramCaption(q);
    for (const t of [th.text, x.text, ig.text]) {
      assert.ok(!/第\s*[0-9０-９]+\s*問/.test(t), "連番なし");
      assert.ok(!t.includes(q.id) && !/\bQ\d{3}\b/.test(t), "内部IDなし");
      assert.ok(t.startsWith("【今日の日本語教員試験クイズ】"));
      assert.ok(!t.includes("正解：") && !t.includes("正解:"), "正答を載せない");
    }
    assert.ok(th.text.includes("https://example.test/quiz/" + q.slug));
    assert.ok(x.text.endsWith("https://example.test/quiz/" + q.slug));
    assert.ok((x.meta.weighted as number) <= 280);
    assert.ok([...th.text].length <= 500);
    assert.ok(!/https?:\/\//.test(ig.text), "Instagram キャプションにURLなし");
    assert.ok(ig.text.includes("プロフィールのリンク"));
  }
  assert.equal(xWeightedLength("abc", 1), 3 + 23);
  assert.equal(xWeightedLength("あい", 0), 4);
});

test("X: 280超過は送信前に拒否", () => {
  const q = { ...seedToQuestions()[0], question: "あ".repeat(200) };
  assert.throws(() => buildXPost(q), /文字数超過/);
});

// ───── 5. Instagram画像 ─────
test("Instagram画像: 1080x1350(4:5) PNG、4枚生成", async () => {
  for (const q of seedToQuestions()) {
    const r = await renderQuestionImage(q);
    assert.equal(r.width * 5, r.height * 4);
    assert.deepEqual([...r.png.subarray(1, 4)], [0x50, 0x4e, 0x47]);
    assert.ok(r.layout.contentBottom < 1200);
  }
});

// ───── 6-9. 投稿エンジン ─────
test("未承認(draft/reviewed)の問題は一切投稿されない", async () => {
  const s = await setup(undefined, false);
  const r = await run(s, T0);
  assert.equal(r.stage, "idle");
  assert.equal((await s.mock.posts()).length, 0);
});

test("承認フロー: AI校閲なし(draft)の直接承認は拒否", async () => {
  const s = await setup(undefined, false);
  const [q] = await s.repo.listQuestions();
  await assert.rejects(approve(s.repo, q.id, ADMIN, T0), /reviewed/);
});

test("4問×3媒体=12件の模擬投稿（1日1問、翌日に次の問題）", async () => {
  const s = await setup();
  for (let d = 0; d < 4; d++) {
    const r = await run(s, new Date(T0.getTime() + d * DAY));
    assert.equal(r.outcomes.filter((o) => o.result === "posted").length, 3, "day " + d);
    // 同日の2回目は枠使用済みで何もしない
    const again = await run(s, new Date(T0.getTime() + d * DAY + 3600_000));
    assert.equal(again.stage, "idle");
  }
  assert.equal((await s.mock.posts()).length, 12);
  assert.equal((await s.repo.listPostLogs()).filter((l) => l.status === "succeeded").length, 12);
  assert.equal((await run(s, new Date(T0.getTime() + 9 * DAY))).stage, "idle");
  assert.equal((await s.mock.posts()).length, 12);
  const qs = await s.repo.listQuestions();
  assert.ok(qs.every((q) => q.status === "published" && q.published_at));
});

test("予約前は投稿されず、予約時刻後に投稿される", async () => {
  const s = await setup(undefined, false);
  for (const q of await s.repo.listQuestions()) {
    await aiReview(s.repo, q.id);
    await approve(s.repo, q.id, ADMIN, new Date(T0.getTime() + 2 * DAY));
  }
  assert.equal((await run(s, T0)).stage, "idle");
  assert.equal((await s.mock.posts()).length, 0);
  assert.equal((await run(s, new Date(T0.getTime() + 2 * DAY + 1000))).outcomes.length, 3);
});

test("重複投稿防止: 同時実行・再実行でも各媒体1回だけ", async () => {
  const s = await setup();
  const rs = await Promise.all([run(s, T0), run(s, T0), run(s, T0), run(s, T0)]);
  assert.equal((await s.mock.posts()).length, 3);
  assert.equal(rs.flatMap((r) => r.outcomes).filter((o) => o.result === "posted").length, 3);
  await run(s, T0);
  await run(s, new Date(T0.getTime() + 1000));
  assert.equal((await s.mock.posts()).length, 3);
});

test("部分失敗: 失敗媒体だけ再試行し、成功済み媒体へ再投稿しない", async () => {
  const s = await setup((p, _slug, n) => (p === "x" && n === 1 ? "fail" : "ok"));
  const r1 = await run(s, T0);
  assert.deepEqual(r1.outcomes.map((o) => o.result), ["posted", "failed", "posted"]);
  // バックオフ中は再試行しない
  const r2 = await run(s, new Date(T0.getTime() + 60_000));
  assert.deepEqual(r2.outcomes.map((o) => o.result), ["skipped", "skipped", "skipped"]);
  // バックオフ経過後: X のみ送信、他は already_succeeded
  const r3 = await run(s, new Date(T0.getTime() + 30 * 60_000));
  assert.deepEqual(r3.outcomes.map((o) => o.result), ["skipped", "posted", "skipped"]);
  const posts = await s.mock.posts();
  assert.equal(posts.filter((p) => p.platform === "threads").length, 1);
  assert.equal(posts.filter((p) => p.platform === "instagram").length, 1);
  assert.equal(posts.filter((p) => p.platform === "x").length, 1);
  const attempts = (await s.repo.listAttempts()).filter((a) => a.platform === "x");
  assert.deepEqual(attempts.map((a) => a.outcome), ["failed", "succeeded"]);
});

test("送信結果不明(投稿済み): 自動再送せず照合して成功扱い（二重投稿なし）", async () => {
  const s = await setup((p, _s, n) => (p === "threads" && n === 1 ? "error_after_send" : "ok"));
  const r1 = await run(s, T0);
  assert.equal(r1.outcomes[0].result, "unknown");
  assert.equal((await s.repo.listPostLogs()).find((l) => l.platform === "threads")!.status, "unknown");
  const r2 = await run(s, new Date(T0.getTime() + 60_000));
  assert.equal(r2.outcomes[0].result, "reconciled_found");
  assert.equal((await s.mock.posts()).filter((p) => p.platform === "threads").length, 1);
  assert.equal((await s.repo.listPostLogs()).find((l) => l.platform === "threads")!.status, "succeeded");
});

test("送信結果不明(未投稿): 照合で見つからなくても自動再送しない。管理者が未投稿を確認して初めて再送", async () => {
  // 旧仕様（照合で見つからない→failed→自動再送）は二重投稿の恐れがあるため廃止（Codex round2 R2-C）。詳細は tests/safety-fixes.test.mts
  const s = await setup((p, _s, n) => (p === "instagram" && n === 1 ? "error_before_send" : "ok"));
  await run(s, T0);
  const r2 = await run(s, new Date(T0.getTime() + 6 * 60_000));
  assert.equal(r2.outcomes[2].result, "reconciled_missing");
  const r3 = await run(s, new Date(T0.getTime() + 2 * 3600_000));
  assert.equal(r3.outcomes[2].result, "reconciled_missing", "何度実行しても再送されない");
  assert.equal((await s.repo.listPostLogs()).find((l) => l.platform === "instagram")!.status, "unknown");
  assert.equal((await s.mock.posts()).filter((p) => p.platform === "instagram").length, 0);
  const q = (await s.repo.listQuestions()).find((x) => x.status === "published")!;
  await resolveUnknown(s.repo, q.id, "instagram", ADMIN, { resolution: "not_posted" });
  const r4 = await run(s, new Date(T0.getTime() + 3 * 3600_000));
  assert.equal(r4.outcomes[2].result, "posted");
  assert.equal((await s.mock.posts()).filter((p) => p.platform === "instagram").length, 1);
});

test("クラッシュ(送信中リース切れ)も不明扱い: 照合のみで再送しない", async () => {
  const s = await setup();
  const [q] = (await s.repo.listQuestions()).sort((a, b) => (a.id < b.id ? -1 : 1));
  const claim = await s.repo.claimPost(q.id, "threads", T0, DEFAULT_CLAIM_CONFIG); // sending のまま放置
  assert.equal(claim.action, "send");
  // リース有効中は他実行がスキップ
  assert.equal((await run(s, new Date(T0.getTime() + 60_000))).outcomes[0].result, "skipped");
  // リース切れ後: 照合（未投稿確認）→ 次回送信。いきなり送信はしない
  const r = await run(s, new Date(T0.getTime() + 10 * 60_000));
  assert.equal(r.outcomes[0].result, "reconciled_missing");
  assert.equal((await s.mock.posts()).filter((p) => p.platform === "threads").length, 0);
});

test("レート制限: 待機時間中は再試行せず、後で成功", async () => {
  const s = await setup((p, _s, n) => (p === "x" && n === 1 ? "rate_limit" : "ok"));
  const r1 = await run(s, T0);
  assert.equal(r1.outcomes[1].result, "rate_limited");
  assert.equal((await run(s, new Date(T0.getTime() + 30_000))).outcomes[1].result, "skipped");
  assert.equal((await run(s, new Date(T0.getTime() + 5 * 60_000))).outcomes[1].result, "posted");
});

test("試行上限に達した媒体は自動再試行せず、手動再試行(requeue)で復帰", async () => {
  const s = await setup((p) => (p === "x" ? "fail" : "ok"));
  let t = T0.getTime();
  for (let i = 0; i < 6; i++) {
    await run(s, new Date(t));
    t += 6 * 3600_000;
  }
  const log = (await s.repo.listPostLogs()).find((l) => l.platform === "x")!;
  assert.equal(log.status, "failed");
  assert.equal(log.attempts, DEFAULT_CLAIM_CONFIG.maxAttempts);
  assert.equal(await s.repo.requeueFailed(log.question_id, "x"), true);
  assert.equal((await s.repo.listPostLogs()).find((l) => l.platform === "x")!.next_retry_at, null);
});

test("HP公開を確認できない場合はSNS投稿しない", async () => {
  const s = await setup();
  const r = await run(s, T0, { verifyHp: async () => false });
  assert.equal(r.stage, "blocked");
  assert.equal((await s.mock.posts()).length, 0);
});

test("実投稿モードは明示確認なしでは構築できない", () => {
  const prev = { ...process.env };
  process.env.SNS_MODE = "live";
  delete process.env.SNS_LIVE_CONFIRM;
  assert.throws(() => createPublishers(), /SNS_LIVE_CONFIRM/);
  process.env.SNS_LIVE_CONFIRM = "I_UNDERSTAND_THIS_POSTS_TO_REAL_ACCOUNTS";
  process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
  assert.throws(() => createPublishers(), /https/);
  Object.assign(process.env, prev);
  delete process.env.SNS_MODE;
  process.env.NEXT_PUBLIC_SITE_URL = "https://example.test";
});

// ───── Step A: 承認フロー（AI一次校閲 / 人間の最終承認 / ハッシュ） ─────
const fresh = async () => setup(undefined, false);
const firstId = async (s: Awaited<ReturnType<typeof setup>>) => (await s.repo.listQuestions())[0].id;

test("AIは最終承認できない（ai / system / reviewer権限 / 校閲なし）", async () => {
  const s = await fresh();
  const id = await firstId(s);
  await aiReview(s.repo, id);
  await assert.rejects(approve(s.repo, id, { kind: "ai", id: "claude" }, T0), /人間の管理者のみ/);
  await assert.rejects(approve(s.repo, id, { kind: "system", id: "cron" }, T0), /人間の管理者のみ/);
  await assert.rejects(approve(s.repo, id, humanActor({ id: "u", email: "r@x", role: "reviewer" }), T0), /admin 権限/);
  assert.equal((await s.repo.getQuestion(id))!.status, "reviewed");
  assert.equal((await s.repo.getQuestion(id))!.approved_by, null);
});

test("AI校閲は承認ではない: reviewed になるだけで、校閲記録とコメントが残る。整合性エラーは pass にできない", async () => {
  const s = await fresh();
  const id = await firstId(s);
  const { question, review } = await recordAiReview(s.repo, id, { reviewer: "claude-ai", verdict: "pass", comments: "正答Bで解説と一致" });
  assert.equal(question.status, "reviewed");
  assert.equal(question.approved_by, null);
  assert.equal(review.kind, "ai");
  assert.equal(review.comments, "正答Bで解説と一致");
  assert.equal(review.content_hash, contentHash(question));
  const bad = await s.repo.listQuestions();
  const q2 = bad[1];
  await s.repo.updateQuestion(q2.id, { correct_answer: "A" }); // 解説と不一致
  const r2 = await recordAiReview(s.repo, q2.id, { reviewer: "claude-ai", verdict: "pass", comments: "" });
  assert.equal(r2.review.verdict, "needs_changes");
  assert.equal(r2.question.status, "draft");
});

test("管理者は最終承認できる（ハッシュ・承認者・監査ログが記録される）", async () => {
  const s = await fresh();
  const id = await firstId(s);
  await aiReview(s.repo, id);
  const q = await approve(s.repo, id, ADMIN, new Date(T0.getTime() - 1000));
  assert.equal(q.status, "approved");
  assert.equal(q.approved_by, "admin-1");
  assert.equal(q.approved_by_email, "admin@example.test");
  assert.equal(q.content_hash, contentHash(q));
  const log = await s.repo.listAudit();
  assert.deepEqual(log.map((a) => a.action).sort(), ["ai_review", "approve"]);
  assert.equal(log.find((a) => a.action === "approve")!.actor_kind, "human");
  assert.equal(log.find((a) => a.action === "ai_review")!.actor_kind, "ai");
});

test("承認後に本文(問題文/選択肢/正答/解説)を変更すると承認が無効になる", async () => {
  for (const patch of [{ question: "変更後の問題文？" }, { explanation: "変更後の解説。気づき仮説" }, { choices: { A: "a", B: "気づき仮説", C: "c", D: "d" } }, { correct_answer: "A" as const }]) {
    const s = await fresh();
    const id = await firstId(s);
    await aiReview(s.repo, id);
    await approve(s.repo, id, ADMIN, new Date(T0.getTime() - 1000));
    const { invalidated, question } = await editContent(s.repo, id, ADMIN, patch);
    assert.equal(invalidated, true, JSON.stringify(patch));
    assert.equal(question.status, "draft");
    assert.equal(question.approved_by, null);
    assert.equal(question.content_hash, null);
    assert.equal(question.scheduled_at, null);
    assert.equal((await run(s, T0)).stage, "idle", "無効化後は投稿されない");
    assert.equal((await s.mock.posts()).length, 0);
  }
});

test("承認の無効化はリポジトリ層で強制（ワークフローを迂回した直接更新でも無効化）。本文以外の更新では無効化しない", async () => {
  const s = await fresh();
  const id = await firstId(s);
  await aiReview(s.repo, id);
  await approve(s.repo, id, ADMIN, new Date(T0.getTime() - 1000));
  await s.repo.updateQuestion(id, { category: "別分野" });
  assert.equal((await s.repo.getQuestion(id))!.status, "approved");
  await s.repo.updateQuestion(id, { explanation: "こっそり変更" });
  assert.equal((await s.repo.getQuestion(id))!.status, "draft");
});

test("本文変更後は再校閲なしで承認できない（古いAI校閲は無効）", async () => {
  const s = await fresh();
  const id = await firstId(s);
  await aiReview(s.repo, id);
  await s.repo.updateQuestion(id, { explanation: "シュミットの気づき仮説（改訂）" });
  await assert.rejects(approve(s.repo, id, ADMIN, T0), /reviewed/); // draft に戻っている
  await s.repo.updateQuestion(id, { status: "reviewed" }); // 迂回して reviewed にしても…
  await assert.rejects(approve(s.repo, id, ADMIN, T0), /AI 一次校閲\(pass\)がありません/);
});

test("ハッシュ不一致では投稿しない（ストアを直接改ざん）", async () => {
  const s = await setup();
  const file = (s.repo as unknown as { file: string }).file;
  const store = JSON.parse(fs.readFileSync(file, "utf8"));
  const target = store.questions.find((q: { slug: string }) => q.slug === "noticing-hypothesis-k7m2");
  target.explanation += "（改ざん）"; // invalidation を迂回して書き換え
  fs.writeFileSync(file, JSON.stringify(store));
  const r = await run(s, T0);
  assert.equal(r.stage, "blocked");
  assert.match(r.note!, /ハッシュ/);
  assert.equal((await s.mock.posts()).length, 0);
});

test("HP公開後〜送信直前の改ざんも検出し、その媒体には送らない", async () => {
  const s = await setup();
  const file = (s.repo as unknown as { file: string }).file;
  const real = s.publishers.threads.prepare.bind(s.publishers.threads);
  s.publishers.threads.prepare = async (q) => {
    const store = JSON.parse(fs.readFileSync(file, "utf8"));
    store.questions.find((x: { id: string }) => x.id === q.id).question += "改";
    fs.writeFileSync(file, JSON.stringify(store));
    return real(q);
  };
  const r = await run(s, T0);
  // threads は prepare 前に検証済みなので投稿されうるが、続く x / instagram は改ざん検出で送信されない
  assert.deepEqual(r.outcomes.slice(1).map((o) => (o as { reason?: string }).reason), ["content_hash_mismatch", "content_hash_mismatch"]);
  assert.equal((await s.mock.posts()).filter((p) => p.platform !== "threads").length, 0);
});

test("承認の取り消しは admin のみ。取り消すと投稿されない。編集・取り消しは監査ログに残る", async () => {
  const s = await setup();
  const id = await firstId(s);
  await assert.rejects(revokeApproval(s.repo, id, { kind: "ai", id: "claude" }, "x"), /admin のみ/);
  await revokeApproval(s.repo, id, ADMIN, "再確認");
  assert.equal((await s.repo.getQuestion(id))!.status, "draft");
  assert.ok((await s.repo.listAudit()).some((a) => a.action === "revoke_approval"));
  await assert.rejects(editContent(s.repo, id, { kind: "system", id: "x" }, { question: "q" }), /admin のみ/);
});

test("ファイルストア破損は空データと誤認せず例外にする", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "quiz-corrupt-"));
  const f = path.join(dir, "store.json");
  fs.writeFileSync(f, "{ broken json");
  const repo = new FileQuizRepository(f);
  await assert.rejects(repo.listQuestions());
  await assert.rejects(repo.ping());
  assert.equal(fs.readFileSync(f, "utf8"), "{ broken json", "破損ファイルを上書きしない");
});

// ───── Codex 監査 round1 の指摘に対する回帰テスト ─────
test("editContent は許可リスト外（status/approved_*/content_hash/scheduled_at 等）の更新を拒否する", async () => {
  const s = await setup(undefined, false);
  const id = (await s.repo.listQuestions())[0].id;
  for (const bad of [{ status: "published" }, { approved_by: "x" }, { approved_at: "2020-01-01T00:00:00Z" }, { content_hash: "h" }, { scheduled_at: "2020-01-01T00:00:00Z" }]) {
    await assert.rejects(editContent(s.repo, id, ADMIN, bad as never), /編集できない項目/);
  }
  const after = (await s.repo.getQuestion(id))!;
  assert.equal(after.status, "draft");
  assert.equal(after.approved_by, null);
  await editContent(s.repo, id, ADMIN, { category: "ok-category" }); // 許可項目は通る
});

test("mock を明示した createPublishers は SNS_MODE=live でも dry-run（デモが実投稿に到達しない）", () => {
  const prev = { ...process.env };
  process.env.SNS_MODE = "live";
  try {
    const p = createPublishers({ mock: createMock(undefined, path.join(os.tmpdir(), "m-" + Date.now() + ".json")) });
    assert.ok(Object.values(p).every((x) => x.mode === "dry-run"));
  } finally {
    for (const k of Object.keys(process.env)) if (!(k in prev)) delete process.env[k];
    Object.assign(process.env, prev);
    if (!("SNS_MODE" in prev)) delete process.env.SNS_MODE;
  }
});

test("dry-run の模擬ログが残っている状態では live 投稿を停止する（投稿欠落の防止）", async () => {
  const s = await setup();
  const r1 = await run(s, T0); // dry-run で1回実行 → 模擬ログが残る
  assert.ok(r1.outcomes.length > 0);
  const liveLike = Object.fromEntries(Object.entries(s.publishers).map(([k, p]) => [k, Object.assign(Object.create(Object.getPrototypeOf(p)), p, { mode: "live" })])) as typeof s.publishers;
  const r2 = await runPublishCycle({ repo: s.repo, publishers: liveLike, now: new Date(T0.getTime() + DAY) });
  assert.equal(r2.stage, "blocked");
  assert.equal(r2.outcomes.length, 0);
});

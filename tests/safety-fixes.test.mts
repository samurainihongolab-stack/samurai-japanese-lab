// Codex 監査 round2 の指摘（R2-A/B/C/D/E/F）に対する回帰テスト。
// 修正前に失敗すること（不具合の再現）を確認してから修正した。名前空間 import を使うのは、未実装の関数でもテスト単位で失敗させるため。
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { FileQuizRepository } from "../lib/quiz/file-repo";
import { seedToQuestions } from "../lib/quiz/seed";
import * as wf from "../lib/quiz/workflow";
import { contentHash } from "../lib/quiz/hash";
import { runPublishCycle } from "../lib/publishers/engine";
import { createMock, createPublishers } from "../lib/publishers";
import * as match from "../lib/publishers/match";
import type { MockScript } from "../lib/publishers/mock";
import { InstagramPublisher } from "../lib/publishers/platforms";
import type { QuizQuestion } from "../lib/quiz/types";
import { DEFAULT_CLAIM_CONFIG } from "../lib/quiz/postlog";

process.env.NEXT_PUBLIC_SITE_URL = "https://example.test";
const ADMIN = wf.humanActor({ id: "admin-1", email: "admin@example.test", role: "admin" });
const T0 = new Date("2026-12-01T03:00:00Z");
const MIN = 60_000;
// 画面で見た本文のハッシュを承認要求に添える（管理画面と同じ動作）
const approveSeen = async (repo: FileQuizRepository, id: string, at: Date) => wf.approve(repo, id, ADMIN, at, contentHash((await repo.getQuestion(id))!));
const review = (repo: FileQuizRepository, id: string) => wf.recordAiReview(repo, id, { reviewer: "ai-test", verdict: "pass", comments: "ok" });

async function setup(script?: MockScript, approveAll = true) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "safety-test-"));
  const repo = new FileQuizRepository(path.join(dir, "store.json"));
  const mock = createMock(script, path.join(dir, "mock.json"));
  await repo.insertIfAbsent(seedToQuestions(T0));
  if (approveAll) {
    for (const q of await repo.listQuestions()) {
      await review(repo, q.id);
      await approveSeen(repo, q.id, new Date(T0.getTime() - 1000));
    }
  }
  return { repo, mock, publishers: createPublishers({ mock }) };
}
type S = Awaited<ReturnType<typeof setup>>;
const run = (s: S, now: Date) => runPublishCycle({ repo: s.repo, publishers: s.publishers, now });
const logOf = async (s: S, platform: string) => (await s.repo.listPostLogs()).find((l) => l.platform === platform)!;

// ───── R2-A: 承認の本文固定 ─────
test("R2-A 古い画面からの承認は拒否される（本文が変わった後は、旧ハッシュで承認できない）", async () => {
  const s = await setup(undefined, false);
  const id = (await s.repo.listQuestions())[0].id;
  await review(s.repo, id);
  const seenByAdmin = contentHash((await s.repo.getQuestion(id))!); // 管理者が画面で確認した本文
  // 別の操作で本文が変更され、再校閲まで完了している（draft→reviewed）
  await wf.editContent(s.repo, id, ADMIN, { explanation: "別の担当者が書き換えた解説（シュミットの気づき仮説）" });
  await review(s.repo, id);
  assert.equal((await s.repo.getQuestion(id))!.status, "reviewed");
  await assert.rejects(wf.approve(s.repo, id, ADMIN, T0, seenByAdmin), (e: Error & { status?: number }) => {
    assert.equal(e.name, "ApprovalConflictError");
    assert.equal(e.status, 409);
    return true;
  });
  assert.equal((await s.repo.getQuestion(id))!.status, "reviewed", "拒否時は状態を変えない");
  // 最新本文を見直したハッシュなら承認できる
  const out = await approveSeen(s.repo, id, T0);
  assert.equal(out.status, "approved");
});

test("R2-A 本文4項目（問題文・選択肢・正答・解説）のどれが変わっても検出する。ハッシュ省略も拒否", async () => {
  for (const patch of [{ question: "変更後の問題文？" }, { choices: { A: "a", B: "b", C: "c", D: "d" } }, { correct_answer: "A" as const }, { explanation: "変更後の解説" }]) {
    const s = await setup(undefined, false);
    const id = (await s.repo.listQuestions())[0].id;
    await review(s.repo, id);
    const seen = contentHash((await s.repo.getQuestion(id))!);
    await s.repo.updateQuestion(id, patch); // 本文変更（承認前なので status は reviewed のまま可）
    await s.repo.updateQuestion(id, { status: "reviewed" });
    await review(s.repo, id);
    await assert.rejects(wf.approve(s.repo, id, ADMIN, T0, seen), /ApprovalConflict|本文が変更/, JSON.stringify(patch));
  }
  const s = await setup(undefined, false);
  const id = (await s.repo.listQuestions())[0].id;
  await review(s.repo, id);
  await assert.rejects(wf.approve(s.repo, id, ADMIN, T0, undefined as never), /ハッシュ/);
  await assert.rejects(wf.approve(s.repo, id, ADMIN, T0, "" as never), /ハッシュ/);
});

// ───── R2-B/C: 結果不明の投稿は自動再送しない ─────
test("R2-C 照合で見つからなくても『未投稿の証明』にしない: unknown を維持し、何度実行しても自動再送されない", async () => {
  const s = await setup((p, _slug, n) => (p === "x" && n === 1 ? "error_before_send" : "ok"));
  let t = T0.getTime();
  const r1 = await run(s, new Date(t));
  assert.equal((await logOf(s, "x")).status, "unknown");
  for (let i = 0; i < 6; i++) {
    t += 6 * MIN; // リース(5分)を過ぎるたびに照合が走る
    await run(s, new Date(t));
    const l = await logOf(s, "x");
    assert.equal(l.status, "unknown", `run ${i + 1}: 照合で見つからなくても failed に戻さない`);
  }
  assert.equal((await s.mock.posts()).filter((p) => p.platform === "x").length, 0, "自動再送なし");
  assert.equal((await logOf(s, "x")).attempts, 1, "送信試行は1回のまま");
  assert.ok(r1.outcomes.some((o) => o.platform === "x"));
});

test("R2-C 手動照合: 管理者が『未投稿を確認』したときだけ再送可能になる。『投稿済み』なら成功として記録（再送しない）", async () => {
  const s = await setup((p, _slug, n) => (p === "x" && n === 1 ? "error_before_send" : "ok"));
  await run(s, T0);
  const q = (await s.repo.listQuestions()).find((x) => x.status === "published")!;
  // 権限のない主体は解決できない
  await assert.rejects(wf.resolveUnknown(s.repo, q.id, "x", { kind: "ai", id: "claude" }, { resolution: "not_posted" }), /admin のみ/);
  await wf.resolveUnknown(s.repo, q.id, "x", ADMIN, { resolution: "not_posted", note: "Xを目視で確認、未投稿" });
  assert.equal((await logOf(s, "x")).status, "failed");
  await run(s, new Date(T0.getTime() + 30 * MIN));
  assert.equal((await s.mock.posts()).filter((p) => p.platform === "x").length, 1, "手動で未投稿確認後は送信される");
  // unknown 以外には使えない
  await assert.rejects(wf.resolveUnknown(s.repo, q.id, "x", ADMIN, { resolution: "not_posted" }), /unknown/);
  assert.ok((await s.repo.listAudit()).some((a) => a.action === "resolve_unknown"));

  const s2 = await setup((p, _slug, n) => (p === "x" && n === 1 ? "error_before_send" : "ok"));
  await run(s2, T0);
  const q2 = (await s2.repo.listQuestions()).find((x) => x.status === "published")!;
  await wf.resolveUnknown(s2.repo, q2.id, "x", ADMIN, { resolution: "posted", externalId: "1234567890", url: "https://x.com/i/status/1234567890" });
  assert.equal((await logOf(s2, "x")).status, "succeeded");
  await run(s2, new Date(T0.getTime() + 30 * MIN));
  assert.equal((await s2.mock.posts()).filter((p) => p.platform === "x").length, 0, "投稿済みと記録したら再送しない");
});

test("R2-C 送信後に応答が途切れた投稿は、照合で見つかれば成功扱い（重複投稿しない）", async () => {
  const s = await setup((p, _slug, n) => (p === "instagram" && n === 1 ? "error_after_send" : "ok"));
  await run(s, T0);
  assert.equal((await logOf(s, "instagram")).status, "unknown");
  await run(s, new Date(T0.getTime() + 6 * MIN));
  assert.equal((await logOf(s, "instagram")).status, "succeeded");
  assert.equal((await s.mock.posts()).filter((p) => p.platform === "instagram").length, 1);
});

// ───── R2-B/D: 照合の識別子 ─────
test("R2-D Instagram: 書き出しが同じ別問題を取り違えない（先頭24文字での照合を廃止）", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "safety-ig-"));
  const mock = createMock(undefined, path.join(dir, "mock.json"));
  const [base] = seedToQuestions(T0);
  const q1: QuizQuestion = { ...base, id: "q-1", slug: "same-start-aaaa", question: base.question };
  const q2: QuizQuestion = { ...base, id: "q-2", slug: "same-start-bbbb", question: base.question + "（別問題）" };
  assert.equal([...q1.question].slice(0, 24).join(""), [...q2.question].slice(0, 24).join(""), "前提: 先頭24文字が同一");
  const ig = new InstagramPublisher(mock.backend("instagram"), "dry-run");
  const c1 = await ig.prepare(q1);
  const c2 = await ig.prepare(q2);
  await ig.publish(c1); // q1 だけが媒体側にある
  assert.ok(await ig.lookup(c1), "q1 は見つかる");
  assert.equal(await ig.lookup(c2), null, "q2 を q1 の投稿と誤認しない");
});

test("R2-B X: t.co に置き換えられた本文でも、展開済みURL(entities)で照合できる。slug の前方一致は別問題", () => {
  const c = { marker: "https://example.test/quiz/noticing-hypothesis-k7m2", matchKind: "url" as const };
  const tcoText = "【今日の日本語教員試験クイズ】\n問題…\nhttps://t.co/AbCdEf123";
  assert.equal(match.matchesContent(c, { text: tcoText }), false, "t.co だけでは判定できない");
  assert.equal(match.matchesContent(c, { text: tcoText, urls: ["https://example.test/quiz/noticing-hypothesis-k7m2"] }), true);
  assert.equal(match.matchesContent(c, { text: tcoText, urls: ["https://example.test/quiz/noticing-hypothesis-k7m2-extra"] }), false, "slug が前方一致するだけの別問題");
  assert.equal(match.matchesContent(c, { text: "…\nhttps://example.test/quiz/noticing-hypothesis-k7m2\n" }), true);
  assert.equal(match.matchesContent(c, { text: "…https://example.test/quiz/noticing-hypothesis-k7m2-2" }), false);
  assert.equal(match.matchesContent(c, { text: "…https://example.test/quiz/noticing-hypothesis-k7m2?utm=a" }), true);
  assert.equal(match.matchesContent({ marker: "本文A\n本文B", matchKind: "text" }, { text: "本文A\r\n本文B  " }), true, "text は改行・末尾空白を正規化して全文一致");
  assert.equal(match.matchesContent({ marker: "本文A", matchKind: "text" }, { text: "本文A（別問題）" }), false, "text は部分一致にしない");
});

test("R2-B 模擬Xは本物のXと同様に URL を t.co 化する。それでも照合で自分の投稿を見つけられる", async () => {
  const s = await setup((p, _slug, n) => (p === "x" && n === 1 ? "error_after_send" : "ok"));
  await run(s, T0);
  const xp = (await s.mock.posts()).find((p) => p.platform === "x")!;
  assert.match(xp.text, /https:\/\/t\.co\//, "模擬Xは t.co へ短縮");
  assert.ok(!xp.text.includes("example.test/quiz/"), "本文中に元URLは残らない");
  await run(s, new Date(T0.getTime() + 6 * MIN));
  assert.equal((await logOf(s, "x")).status, "succeeded", "entities の展開URLで照合成功");
  assert.equal((await s.mock.posts()).filter((p) => p.platform === "x").length, 1);
});

// ───── R2-F: 承認取り消し中の送信防止 ─────
test("R2-F 準備(prepare)中に承認が取り消されたら送信しない。確保した送信枠は解放される", async () => {
  const s = await setup();
  const id = (await s.repo.listQuestions())[0].id;
  const real = s.publishers.threads.prepare.bind(s.publishers.threads);
  s.publishers.threads.prepare = async (q) => {
    const c = await real(q);
    await wf.revokeApproval(s.repo, q.id, ADMIN, "競合: 準備中に取り消し"); // 別の管理者が同時に取り消し
    return c;
  };
  const r = await run(s, T0);
  assert.equal((await s.mock.posts()).length, 0, "どの媒体にも投稿されない");
  assert.equal((r.outcomes[0] as { reason?: string }).reason, "approval_revoked");
  const l = await logOf(s, "threads");
  assert.notEqual(l.status, "sending", "sending のまま残さない");
  assert.equal(l.lease_until, null);
  assert.equal(l.attempts, 0, "未送信なので試行回数を消費しない");
  assert.equal((await s.repo.getQuestion(id))!.status, "draft");
});

test("R2-F 取り消し→再承認後は、解放された送信枠から改めて送信できる（取り消しで投稿が永久に塞がらない）", async () => {
  const s = await setup();
  const id = (await s.repo.listQuestions())[0].id;
  const real = s.publishers.threads.prepare.bind(s.publishers.threads);
  let revoked = false;
  s.publishers.threads.prepare = async (q) => {
    const c = await real(q);
    if (!revoked) {
      revoked = true;
      await wf.revokeApproval(s.repo, q.id, ADMIN, "race");
    }
    return c;
  };
  await run(s, T0);
  await review(s.repo, id);
  await approveSeen(s.repo, id, new Date(T0.getTime() - 1000));
  await run(s, new Date(T0.getTime() + 10 * MIN));
  const posts = (await s.mock.posts()).filter((p) => p.platform === "threads");
  assert.equal(posts.length, 1);
});

test("R2-F 並行実行（cron と手動実行が同時）でも同一投稿は1回だけ", async () => {
  const s = await setup();
  await Promise.all([run(s, T0), run(s, T0), run(s, T0)]);
  const posts = await s.mock.posts();
  for (const p of ["threads", "x", "instagram"]) assert.equal(posts.filter((x) => x.platform === p).length, 1, p);
});

// ───── R2-E: 再承認後のHP再公開 ─────
test("R2-E 承認取り消し→再承認した問題はHPに再公開される。SNSは重複投稿しない", async () => {
  const s = await setup();
  const r1 = await run(s, T0);
  assert.equal(r1.stage, "hp_published");
  const q = (await s.repo.listQuestions()).find((x) => x.slug === r1.question)!;
  assert.equal((await s.mock.posts()).length, 3);
  await wf.revokeApproval(s.repo, q.id, ADMIN, "誤記修正");
  assert.equal(await s.repo.getPublicBySlug(q.slug, T0), null, "取り消し後はHP非公開");
  await wf.editContent(s.repo, q.id, ADMIN, { category: q.category }); // 本文は不変
  await review(s.repo, q.id);
  await approveSeen(s.repo, q.id, new Date(T0.getTime() - 1000));
  const r2 = await run(s, new Date(T0.getTime() + 60 * MIN));
  assert.equal(r2.stage, "hp_published", "過去のSNS成功ログがあってもHPを再公開する");
  assert.equal(r2.question, q.slug);
  assert.ok(await s.repo.getPublicBySlug(q.slug, new Date(T0.getTime() + 61 * MIN)), "HPで閲覧できる");
  assert.equal((await s.mock.posts()).length, 3, "SNSは重複投稿しない");
  assert.ok(r2.outcomes.every((o) => o.result === "skipped" && (o as { reason?: string }).reason === "already_succeeded"));
});

// ───── 新サイクル round1 の指摘: 手動解決の結果を、遅れて届いた自動照合の結果が上書きしない ─────
test("手動で『投稿済み』と確定した後、遅れて返った自動照合(見つからず)の結果で unknown に戻されない", async () => {
  const s = await setup((p, _slug, n) => (p === "x" && n === 1 ? "error_before_send" : "ok"));
  await run(s, T0);
  const q = (await s.repo.listQuestions()).find((x) => x.status === "published")!;
  // 自動照合が開始された（リース取得）状態
  const claim = await s.repo.claimPost(q.id, "x", new Date(T0.getTime() + 10 * MIN), DEFAULT_CLAIM_CONFIG);
  assert.equal(claim.action, "reconcile");
  // その間に管理者が媒体側を確認して「投稿済み」と確定
  await wf.resolveUnknown(s.repo, q.id, "x", ADMIN, { resolution: "posted", externalId: "999", url: "https://x.com/i/status/999" });
  // 遅れて照合結果（見つからず）が届く
  await s.repo.recordResult(claim.log, { type: "reconciled_missing" }, new Date(T0.getTime() + 11 * MIN), DEFAULT_CLAIM_CONFIG);
  const l = await logOf(s, "x");
  assert.equal(l.status, "succeeded", "人間の確定結果を失わない");
  assert.equal(l.external_id, "999");
});

test("世代照合(CAS): 古い画面の『未投稿を確認』が、その後に始まった新しい送信(sending)を failed に戻して再送可能にしてしまわない", async () => {
  const s = await setup((p, _slug, n) => (p === "x" && n === 1 ? "error_before_send" : "ok"));
  await run(s, T0);
  const q = (await s.repo.listQuestions()).find((x) => x.status === "published")!;
  const stale = await logOf(s, "x"); // 管理者A: 古い画面が持つ unknown の状態
  assert.equal(stale.status, "unknown");
  // 管理者B が先に「未投稿を確認」→ 新しい送信が始まる（sending）
  await wf.resolveUnknown(s.repo, q.id, "x", ADMIN, { resolution: "not_posted" });
  const later = new Date(T0.getTime() + 30 * MIN);
  const claim = await s.repo.claimPost(q.id, "x", later, DEFAULT_CLAIM_CONFIG);
  assert.equal(claim.action, "send");
  assert.equal((await logOf(s, "x")).status, "sending");
  // 管理者A の古い操作が遅れて届く
  await s.repo.recordResult(stale, { type: "manual_not_posted", note: "古い画面" }, new Date(T0.getTime() + 31 * MIN), DEFAULT_CLAIM_CONFIG);
  const l = await logOf(s, "x");
  assert.equal(l.status, "sending", "送信中の状態を古い操作で巻き戻さない");
  assert.equal(l.attempts, claim.log.attempts);
});

test("手動解決: 古い画面からの操作は適用されず（成功を装わず）409相当の PostStateConflictError、監査ログも残らない。成功時は監査が状態更新と一体で残る", async () => {
  const s = await setup((p, _slug, n) => (p === "x" && n === 1 ? "error_before_send" : "ok"));
  await run(s, T0);
  const q = (await s.repo.listQuestions()).find((x) => x.status === "published")!;
  assert.equal((await logOf(s, "x")).status, "unknown");
  const auditCount = async () => (await s.repo.listAudit(1000)).filter((a) => a.action === "resolve_unknown").length;
  const a0 = await auditCount();
  // 先に別の管理者が「未投稿を確認」（成功）。監査が1件残る
  await wf.resolveUnknown(s.repo, q.id, "x", ADMIN, { resolution: "not_posted", note: "確認" });
  assert.equal(await auditCount(), a0 + 1);
  // 状態は failed になったので、同じ画面（unknown 前提）からの二重操作は拒否される
  await assert.rejects(wf.resolveUnknown(s.repo, q.id, "x", ADMIN, { resolution: "posted", externalId: "1" }), /unknown のみ/);
  // CAS 不一致（読み取り後に状態が進んだ）を再現: listPostLogs 直後に状態を進める
  const claim = await s.repo.claimPost(q.id, "x", new Date(T0.getTime() + 30 * MIN), DEFAULT_CLAIM_CONFIG);
  assert.equal(claim.action, "send");
  await s.repo.recordResult(claim.log, { type: "unknown", error: "again" }, new Date(T0.getTime() + 31 * MIN), DEFAULT_CLAIM_CONFIG);
  const origList = s.repo.listPostLogs.bind(s.repo);
  let first = true;
  s.repo.listPostLogs = async (qid?: string) => {
    const r = await origList(qid);
    if (first) { // 読み取り後・書き込み前に別の操作が割り込む
      first = false;
      const cur = r.find((l) => l.platform === "x")!;
      await s.repo.recordResult(cur, { type: "reconciled_missing" }, new Date(T0.getTime() + 32 * MIN), DEFAULT_CLAIM_CONFIG);
    }
    return r;
  };
  const a1 = await auditCount();
  await assert.rejects(wf.resolveUnknown(s.repo, q.id, "x", ADMIN, { resolution: "not_posted" }), (e: Error) => e instanceof wf.PostStateConflictError && (e as wf.PostStateConflictError).status === 409);
  assert.equal(await auditCount(), a1, "適用されなかった操作の監査は残さない");
  assert.equal((await logOf(s, "x")).status, "unknown", "状態は変わらない");
});

test("世代照合(CAS): 確保と結果記録に同じ時刻が渡されても世代は前進し、同じ古い読み取りに基づく2回目の結果は適用されない（Codex指摘）", async () => {
  const s = await setup(undefined, true);
  const q = (await s.repo.listQuestions())[0];
  const now = new Date(T0.getTime() + 5 * MIN);
  const claim = await s.repo.claimPost(q.id, "x", now, DEFAULT_CLAIM_CONFIG); // sending, updated_at = now
  assert.equal(claim.action, "send");
  const r1 = await s.repo.recordResult(claim.log, { type: "unknown", error: "timeout" }, now, DEFAULT_CLAIM_CONFIG); // 同じ now
  assert.equal(r1.status, "unknown");
  assert.notEqual(r1.updated_at, claim.log.updated_at, "結果記録で世代が変わる");
  // 同じ確保ログ(claim.log)に基づく2つ目の結果（遅れて届いた failed）は、自動再送可能な failed に変えてはいけない
  const r2 = await s.repo.recordResult(claim.log, { type: "failed", error: "late" }, now, DEFAULT_CLAIM_CONFIG);
  assert.equal(r2.status, "unknown");
  assert.equal((await logOf(s, "x")).status, "unknown");
});

// ───── ファイルストアのロック（Codex指摘）: 経過時間だけで有効なロックを奪わない／自分のロックだけ解放する ─────
test("ファイルロック: 生存プロセスが保持する古いロックは奪わず、解放を待ってから処理する", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lock-test-"));
  const file = path.join(dir, "store.json");
  const lock = file + ".lock";
  fs.mkdirSync(lock);
  fs.writeFileSync(path.join(lock, "owner"), `${process.pid}:someone-else`); // 生存しているプロセスの所有
  const old = new Date(Date.now() - 60_000);
  fs.utimesSync(lock, old, old); // 60 秒前（旧実装なら 10 秒超で奪っていた）
  const repo = new FileQuizRepository(file);
  let done = false;
  const op = repo.listQuestions().then(() => (repo as unknown as { withLock: (f: () => Promise<number>) => Promise<number> }).withLock(async () => 1)).then(() => { done = true; });
  await new Promise((r) => setTimeout(r, 400));
  assert.equal(done, false, "有効なロックを奪って進んではいけない");
  assert.ok(fs.existsSync(lock));
  fs.rmSync(lock, { recursive: true });
  await op;
  assert.equal(done, true);
});

test("ファイルロック: 所有プロセスが存在しない放棄ロックは回収される。自分のものでないロックは解放時に消さない", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lock-test-"));
  const file = path.join(dir, "store.json");
  const lock = file + ".lock";
  const { spawnSync } = await import("node:child_process");
  const deadPid = Number(spawnSync(process.execPath, ["-e", "process.stdout.write(String(process.pid))"]).stdout.toString());
  fs.mkdirSync(lock);
  fs.writeFileSync(path.join(lock, "owner"), `${deadPid}:ghost`);
  const repo = new FileQuizRepository(file);
  const withLock = (repo as unknown as { withLock: <T>(f: () => Promise<T>) => Promise<T> }).withLock.bind(repo);
  assert.equal(await withLock(async () => "ok"), "ok", "放棄ロックを回収して処理できる");
  assert.ok(!fs.existsSync(lock));
  // 処理中にロックが（何らかの理由で）別の所有者に渡った場合、元の所有者の finally は新しい所有者のロックを消さない
  await withLock(async () => {
    fs.writeFileSync(path.join(lock, "owner"), `${process.pid}:new-owner`);
  });
  assert.ok(fs.existsSync(lock), "他者のロックは残る");
  assert.equal(fs.readFileSync(path.join(lock, "owner"), "utf8"), `${process.pid}:new-owner`);
});

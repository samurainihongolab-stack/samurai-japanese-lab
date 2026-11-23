// 004 の DB 関数 quiz_record_post_result を実際の PostgreSQL（PGlite、ローカルのみ）で検証する。
// ※ PGlite は単一セッションのため「真の並行実行」は再現できない。直列での CAS／ロールバック／権限を検証し、
//    並行競合は実 Supabase での検証手順（docs/supabase-connection-plan.md）に残す。
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { before, test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { SupabaseQuizRepository } from "../lib/quiz/supabase-repo";
import { DEFAULT_CLAIM_CONFIG } from "../lib/quiz/postlog";
import type { AuditEntry, PostLog } from "../lib/quiz/types";

const mig = (f: string) => fs.readFileSync(path.join(process.cwd(), "supabase", "migrations", f), "utf8");
const BOOT = `
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth;
  create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
  grant usage on schema public, auth to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant execute on functions to anon, authenticated, service_role; -- Supabase の既定を模擬
`;
const Q = (id: string) => "insert into quiz_questions (id,slug,category,question,choices,correct_answer,explanation) values ('" + id + "','s-" + id + "','c','Q?','{\"A\":\"a\",\"B\":\"b\",\"C\":\"c\",\"D\":\"d\"}','B','e')";

const db = new PGlite();
// PGlite 上で service_role として RPC を呼ぶ最小の Supabase クライアント模擬（rpc のみ）。
const fakeAdmin = {
  rpc: async (fn: string, a: Record<string, unknown>) => {
    try {
      await db.exec("set role service_role");
      const r = await db.query<{ r: unknown }>(`select public.${fn}($1::uuid,$2::timestamptz,$3::jsonb,$4::jsonb,$5::boolean,$6::jsonb) as r`, [a.p_log_id, a.p_expected_updated_at, JSON.stringify(a.p_patch), JSON.stringify(a.p_attempt), a.p_terminal_ok, a.p_audit == null ? null : JSON.stringify(a.p_audit)]);
      return { data: r.rows[0].r, error: null };
    } catch (e) {
      return { data: null, error: { message: (e as Error).message } };
    } finally {
      await db.exec("reset role");
    }
  },
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const repo = new SupabaseQuizRepository(fakeAdmin as any, fakeAdmin as any);

const getLog = async (id: string) => (await db.query<{ j: PostLog }>("select to_jsonb(l) as j from quiz_post_log l where id=$1", [id])).rows[0].j;
const count = async (t: string) => Number((await db.query<{ c: string }>("select count(*)::text c from " + t)).rows[0].c);
let seq = 0;
async function newLog(status: string, attempts = 1): Promise<PostLog> {
  const qid = "rq" + ++seq;
  await db.exec(Q(qid));
  const r = await db.query<{ id: string }>("insert into quiz_post_log (question_id, platform, status, attempts) values ($1,'x',$2,$3) returning id", [qid, status, attempts]);
  return getLog(r.rows[0].id);
}
const audit = (id = "00000000-0000-4000-8000-0000000000a1"): AuditEntry => ({ id, actor_id: "u1", actor_kind: "human", actor_email: "admin@example.test", action: "resolve_unknown", entity: "quiz_question", entity_id: "q", detail: { k: 1 }, created_at: new Date().toISOString() });

before(async () => {
  await db.exec(BOOT);
  for (const f of ["001_quiz.sql", "002_review_and_audit.sql", "003_revoke_unneeded_privileges.sql", "004_atomic_post_result.sql"]) await db.exec(mig(f));
});

test("004 は再適用でき（冪等）、実行権限は service_role のみ", async () => {
  await db.exec(mig("004_atomic_post_result.sql"));
  const sig = "public.quiz_record_post_result(uuid,timestamptz,jsonb,jsonb,boolean,jsonb)";
  for (const role of ["anon", "authenticated"]) {
    const r = await db.query<{ ok: boolean }>(`select has_function_privilege('${role}', '${sig}', 'execute') ok`);
    assert.equal(r.rows[0].ok, false, role + " は実行不可");
  }
  assert.equal((await db.query<{ ok: boolean }>(`select has_function_privilege('service_role', '${sig}', 'execute') ok`)).rows[0].ok, true);
  // PUBLIC (grantee=0) にも実行権限がない
  const pub = await db.query("select a.privilege_type from pg_proc p, aclexplode(p.proacl) a where p.proname='quiz_record_post_result' and a.grantee=0");
  assert.deepEqual(pub.rows, []);
  // 管理者 JWT の authenticated でも呼べない（RLS の admin 判定に頼らず、実行権限で拒否）
  await db.exec("select set_config('request.jwt.claims', '{\"sub\":\"u1\",\"app_metadata\":{\"role\":\"admin\"}}', false); set role authenticated");
  try {
    await assert.rejects(db.query("select public.quiz_record_post_result(gen_random_uuid(), now(), '{}'::jsonb, '{}'::jsonb, false, null)"), /permission denied/);
  } finally {
    await db.exec("reset role");
  }
});

test("RPC: 状態更新・履歴・監査ログが一体で記録され、世代トークンが前進する", async () => {
  const log = await newLog("unknown", 2);
  const a0 = await count("quiz_post_attempts"), au0 = await count("admin_audit_log");
  const out = await repo.recordResult(log, { type: "manual_not_posted", note: "確認済み" }, new Date(), DEFAULT_CLAIM_CONFIG, audit());
  assert.equal(out.status, "failed");
  assert.match(out.last_error ?? "", /管理者が媒体側で未投稿を確認/);
  assert.ok(new Date(out.updated_at).getTime() > new Date(log.updated_at).getTime(), "updated_at が前進");
  assert.equal(await count("quiz_post_attempts"), a0 + 1);
  assert.equal(await count("admin_audit_log"), au0 + 1);
  const att = (await db.query<{ post_log_id: string; question_id: string; platform: string; outcome: string }>("select * from quiz_post_attempts where post_log_id=$1", [log.id])).rows;
  assert.deepEqual(att.map((x) => [x.post_log_id, x.question_id, x.platform, x.outcome]), [[log.id, log.question_id, "x", "reconciled_missing"]]);
});

test("RPC: 世代照合(CAS)不一致は適用されず、履歴・監査も残らない（安全な拒否）", async () => {
  const log = await newLog("unknown");
  await repo.recordResult(log, { type: "manual_not_posted" }, new Date(), DEFAULT_CLAIM_CONFIG); // 先に別の操作が成功
  const after = await getLog(log.id);
  const a0 = await count("quiz_post_attempts"), au0 = await count("admin_audit_log");
  // 古い読み取り(log)に基づく別の結果（遅れて届いた「投稿済み」）は適用されない
  const out = await repo.recordResult(log, { type: "reconciled_found", externalId: "late", url: null }, new Date(), DEFAULT_CLAIM_CONFIG, audit("00000000-0000-4000-8000-0000000000a2"));
  assert.equal(out.status, "failed");
  assert.deepEqual(await getLog(log.id), after, "行は変化しない");
  assert.equal(await count("quiz_post_attempts"), a0);
  assert.equal(await count("admin_audit_log"), au0, "適用されなかった操作の監査は残さない");
});

test("RPC: succeeded は終端状態。成功以外の結果では巻き戻せない", async () => {
  const log = await newLog("sending");
  const done = await repo.recordResult(log, { type: "succeeded", externalId: "e1", url: "https://x.test/1" }, new Date(), DEFAULT_CLAIM_CONFIG);
  assert.equal(done.status, "succeeded");
  // 最新の読み取り(done)に基づいていても、失敗/不明/未投稿確認では succeeded を変えない
  for (const result of [{ type: "failed", error: "x" }, { type: "unknown", error: "x" }, { type: "manual_not_posted" }, { type: "reconciled_missing" }] as const) {
    const a0 = await count("quiz_post_attempts");
    const out = await repo.recordResult(done, result, new Date(), DEFAULT_CLAIM_CONFIG);
    assert.equal(out.status, "succeeded", result.type);
    assert.equal(out.external_id, "e1");
    assert.equal(await count("quiz_post_attempts"), a0);
  }
});

test("RPC: 履歴挿入が失敗したら状態更新もロールバックされる（状態だけ変わらない）", async () => {
  const log = await newLog("sending");
  const before = await getLog(log.id);
  const a0 = await count("quiz_post_attempts");
  const res = await fakeAdmin.rpc("quiz_record_post_result", {
    p_log_id: log.id, p_expected_updated_at: log.updated_at,
    p_patch: { status: "succeeded", external_id: "ZZ", updated_at: new Date().toISOString() },
    p_attempt: { attempt_no: 1, outcome: "NOT_A_VALID_OUTCOME", error: null }, // check 制約違反
    p_terminal_ok: true, p_audit: null,
  });
  assert.ok(res.error, "エラーになる");
  assert.deepEqual(await getLog(log.id), before, "状態は変わっていない");
  assert.equal(await count("quiz_post_attempts"), a0);
});

test("RPC: 監査ログの挿入が失敗したら、状態更新・履歴もロールバックされる", async () => {
  const log = await newLog("unknown");
  const before = await getLog(log.id);
  const a0 = await count("quiz_post_attempts");
  await assert.rejects(
    repo.recordResult(log, { type: "manual_not_posted" }, new Date(), DEFAULT_CLAIM_CONFIG, { ...audit("00000000-0000-4000-8000-0000000000a3"), actor_kind: "robot" as never }),
    /supabase:/,
  );
  assert.deepEqual(await getLog(log.id), before);
  assert.equal(await count("quiz_post_attempts"), a0);
});

test("RPC: 更新できる列は許可リストのみ（id / question_id / platform / created_at を patch で書き換えられない）", async () => {
  const log = await newLog("sending");
  const res = await fakeAdmin.rpc("quiz_record_post_result", {
    p_log_id: log.id, p_expected_updated_at: log.updated_at,
    p_patch: { status: "failed", last_error: "e", question_id: "HACK", platform: "threads", id: "00000000-0000-4000-8000-00000000ffff", created_at: "2000-01-01T00:00:00Z", updated_at: new Date().toISOString() },
    p_attempt: { attempt_no: 1, outcome: "failed", error: "e", question_id: "HACK", platform: "threads" },
    p_terminal_ok: false, p_audit: null,
  });
  assert.equal(res.error, null);
  const after = await getLog(log.id);
  assert.equal(after.question_id, log.question_id);
  assert.equal(after.platform, "x");
  assert.equal(after.created_at, log.created_at);
  const att = (await db.query<{ question_id: string; platform: string }>("select question_id, platform from quiz_post_attempts where post_log_id=$1", [log.id])).rows;
  assert.deepEqual(att, [{ question_id: log.question_id, platform: "x" }], "履歴の識別子は入力でなく行から導出");
});

test("RPC: 存在しない行・不正な入力は例外（何も書かない）", async () => {
  const bad = await fakeAdmin.rpc("quiz_record_post_result", { p_log_id: "00000000-0000-4000-8000-00000000dead", p_expected_updated_at: new Date().toISOString(), p_patch: {}, p_attempt: { attempt_no: 1, outcome: "failed" }, p_terminal_ok: false, p_audit: null });
  assert.match(bad.error?.message ?? "", /not found/);
});

test("互換性: 001 時点の投稿ログ行がある既存DBに 002〜004 を適用してもデータは保持され、RPC が使える", async () => {
  const old = new PGlite();
  await old.exec(BOOT);
  await old.exec(mig("001_quiz.sql"));
  await old.exec(Q("legacy1"));
  await old.exec("insert into quiz_post_log (question_id, platform, status, attempts, external_id) values ('legacy1','threads','succeeded',1,'ext-1'), ('legacy1','x','unknown',2,null)");
  await old.exec("insert into quiz_post_attempts (post_log_id, question_id, platform, attempt_no, outcome) select id,'legacy1',platform,1,'succeeded' from quiz_post_log where platform='threads'");
  for (const f of ["002_review_and_audit.sql", "003_revoke_unneeded_privileges.sql", "004_atomic_post_result.sql"]) await old.exec(mig(f));
  const logs = (await old.query<{ platform: string; status: string; attempts: number; external_id: string | null }>("select platform,status,attempts,external_id from quiz_post_log order by platform")).rows;
  assert.deepEqual(logs, [{ platform: "threads", status: "succeeded", attempts: 1, external_id: "ext-1" }, { platform: "x", status: "unknown", attempts: 2, external_id: null }]);
  assert.equal(Number((await old.query<{ c: string }>("select count(*)::text c from quiz_post_attempts")).rows[0].c), 1);
  const row = (await old.query<{ j: { id: string; updated_at: string } }>("select to_jsonb(l) j from quiz_post_log l where platform='x'")).rows[0].j;
  await old.exec("set role service_role");
  const r = await old.query<{ r: { applied: boolean } }>("select public.quiz_record_post_result($1::uuid,$2::timestamptz,$3::jsonb,$4::jsonb,false,null) r", [row.id, row.updated_at, JSON.stringify({ status: "unknown", last_error: "m" }), JSON.stringify({ attempt_no: 2, outcome: "unknown", error: "m" })]);
  await old.exec("reset role");
  assert.equal(r.rows[0].r.applied, true);
});

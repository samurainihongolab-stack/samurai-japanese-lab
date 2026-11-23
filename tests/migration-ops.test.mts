// supabase/ops/*.sql（バックアップ・復元・ロールバック）を、既存データのある 001 状態の DB で実際に動かして検証する（ローカル PGlite のみ）。
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

const rd = (...p: string[]) => fs.readFileSync(path.join(process.cwd(), "supabase", ...p), "utf8");
const BOOT = `
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth; create function auth.jwt() returns jsonb language sql stable as $$ select '{}'::jsonb $$;
  grant usage on schema public, auth to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;`;
const row = (id: string, st: string) =>
  `insert into quiz_questions (id,slug,category,question,choices,correct_answer,explanation,status,approved_by,approved_at,scheduled_at,published_at) values ('${id}','s-${id}','c','Q?','{"A":"a","B":"b","C":"c","D":"d"}','B','e','${st}','u1','2026-01-01T00:00:00Z','2026-02-01T00:00:00Z','2026-02-01T00:00:00Z')`;

async function legacyDb() {
  const db = new PGlite();
  await db.exec(BOOT);
  await db.exec(rd("migrations", "001_quiz.sql"));
  await db.exec(row("a1", "approved"));
  await db.exec(row("p1", "published"));
  await db.exec("insert into quiz_questions (id,slug,category,question,choices,correct_answer,explanation) values ('d1','s-d1','c','Q?','{\"A\":\"a\",\"B\":\"b\",\"C\":\"c\",\"D\":\"d\"}','B','e')");
  return db;
}
const states = async (db: PGlite) => (await db.query<Record<string, unknown>>("select id,status,approved_by,to_char(approved_at at time zone 'utc','YYYY-MM-DD') as ap,to_char(scheduled_at at time zone 'utc','YYYY-MM-DD') as sc,to_char(published_at at time zone 'utc','YYYY-MM-DD') as pu from quiz_questions order by id")).rows;

test("precheck.sql は 001 状態の既存DBで読み取り専用として実行でき、影響を受ける行を示す", async () => {
  const db = await legacyDb();
  const before = await states(db);
  const sqls = rd("ops", "precheck.sql").split(/;\s*\n/).map((s) => s.replace(/^--.*$/gm, "").trim()).filter(Boolean);
  const res = [];
  for (const s of sqls) res.push((await db.query(s)).rows);
  assert.equal(res.length, 4);
  assert.deepEqual(res[1].map((r) => (r as { status: string }).status).sort(), ["approved", "published"]);
  assert.deepEqual(await states(db), before, "データは変更されない");
});

test("002 の影響の再現と復元: draft へ戻り承認情報が消える → snapshot から元の状態に復元できる", async () => {
  const db = await legacyDb();
  const original = await states(db);
  await db.exec(rd("ops", "pre002_snapshot.sql"));
  await db.exec(rd("ops", "pre002_snapshot.sql")); // 冪等
  await db.exec(rd("migrations", "002_review_and_audit.sql"));
  const after = await states(db);
  assert.deepEqual(after.map((r) => [r.id, r.status, r.approved_by, r.sc, r.pu]), [["a1", "draft", null, null, null], ["d1", "draft", null, null, null], ["p1", "draft", null, null, null]]);
  await db.exec(rd("ops", "restore_after_002.sql"));
  assert.deepEqual(await states(db), original, "承認者・承認日時・予約・公開日時を含め元に戻る");
});

test("退避表は anon / authenticated から参照できない（承認者情報の漏えい防止）", async () => {
  const db = await legacyDb();
  await db.exec(rd("ops", "pre002_snapshot.sql"));
  for (const role of ["anon", "authenticated"]) {
    await db.exec("set role " + role);
    try {
      await assert.rejects(db.query("select * from ops_pre002_quiz_questions_backup"), /permission denied/);
    } finally {
      await db.exec("reset role");
    }
  }
});

test("rollback_004.sql は RPC だけを削除し、データは変更しない", async () => {
  const db = new PGlite();
  await db.exec(BOOT);
  for (const f of ["001_quiz.sql", "002_review_and_audit.sql", "003_revoke_unneeded_privileges.sql", "004_atomic_post_result.sql"]) await db.exec(rd("migrations", f));
  await db.exec("insert into quiz_questions (id,slug,category,question,choices,correct_answer,explanation) values ('r1','s-r1','c','Q?','{\"A\":\"a\",\"B\":\"b\",\"C\":\"c\",\"D\":\"d\"}','B','e'); insert into quiz_post_log (question_id,platform,status) values ('r1','x','unknown')");
  await db.exec(rd("ops", "rollback_004.sql"));
  assert.equal((await db.query("select 1 from pg_proc where proname='quiz_record_post_result'")).rows.length, 0);
  assert.equal((await db.query("select 1 from quiz_post_log")).rows.length, 1);
  await db.exec(rd("migrations", "004_atomic_post_result.sql")); // 再適用（ロールフォワード）可能
});

test("復元: 002 適用後に本文が編集された行は復元しない（未承認の本文が公開されない）。本文が同じ行だけ復元する", async () => {
  const db = await legacyDb();
  await db.exec(rd("ops", "pre002_snapshot.sql"));
  await db.exec(rd("migrations", "002_review_and_audit.sql"));
  await db.exec("update quiz_questions set explanation='EDITED AFTER 002' where id='p1'"); // 002 後に編集された（人間は編集後の本文を承認していない）
  const sqls = rd("ops", "restore_after_002.sql").split(/;\s*\n/).map((s) => s.replace(/^--.*$/gm, "").trim()).filter(Boolean);
  for (const s of sqls) await db.query(s);
  const r = (await db.query<{ id: string; status: string }>("select id, status from quiz_questions where id in ('a1','p1') order by id")).rows;
  assert.deepEqual(r, [{ id: "a1", status: "approved" }, { id: "p1", status: "draft" }]);
  // 公開ポリシー相当: p1 は published ではないので匿名に見えない
  assert.equal((await db.query("select 1 from quiz_questions where status='published' and id='p1'")).rows.length, 0);
});

test("001–004 preflight allows fresh and empty 001 states and rejects existing rows and collisions", async () => {
  const db = new PGlite();
  const sql = rd("ops", "precheck_001_004.sql");
  try {
    await db.exec(BOOT);
    await db.exec(sql);
    await db.exec(rd("migrations", "001_quiz.sql"));
    await db.exec(sql);
    await db.exec(row("p1", "published"));
    await assert.rejects(db.exec(sql), /quiz_questions contains 1 rows/);
    await db.exec("rollback; delete from public.quiz_questions; create table public.quiz_reviews(id int)");
    await assert.rejects(db.exec(sql), /002–004 objects already exist/);
    await db.exec("rollback");
  } finally {
    await db.close();
  }
});

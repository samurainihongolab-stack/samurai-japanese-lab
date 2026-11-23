// 001/002 マイグレーションを実際の PostgreSQL（PGlite=WASM、ローカルのみ）で適用し、制約・RLS・トリガーを検証する。
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { before, test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const mig = (f: string) => fs.readFileSync(path.join(process.cwd(), "supabase", "migrations", f), "utf8");
const asRole = async (role: string, claims: object | null, fn: () => Promise<void>) => {
  await db.exec("select set_config('request.jwt.claims', '" + JSON.stringify(claims ?? {}) + "', false); set role " + role);
  try {
    await fn();
  } finally {
    await db.exec("reset role");
  }
};
const ids = async () => (await db.query<{ id: string }>("select id from quiz_questions order by id")).rows.map((r) => r.id);
const NEW = (id: string, extra = "") =>
  "insert into quiz_questions (id, slug, category, question, choices, correct_answer, explanation" + (extra ? ", " + extra.split("|")[0] : "") + ") values ('" + id + "','s-" + id + "','c','Q?','{\"A\":\"a\",\"B\":\"b\",\"C\":\"c\",\"D\":\"d\"}','B','expl B'" + (extra ? "," + extra.split("|")[1] : "") + ")";

before(async () => {
  // Supabase 相当のロール・auth.jwt() を用意
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth;
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
    grant usage on schema public, auth to anon, authenticated, service_role;
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  `);
  await db.exec(mig("001_quiz.sql"));
  await db.exec(mig("002_review_and_audit.sql"));
  await db.exec(mig("003_revoke_unneeded_privileges.sql"));
});

test("001/002 がエラーなく適用でき、再適用(冪等)もできる", async () => {
  await db.exec(mig("001_quiz.sql"));
  await db.exec(mig("002_review_and_audit.sql"));
  await db.exec(mig("003_revoke_unneeded_privileges.sql"));
  const t = await db.query<{ tablename: string }>("select tablename from pg_tables where schemaname='public' order by 1");
  assert.deepEqual(t.rows.map((r) => r.tablename), ["admin_audit_log", "quiz_post_attempts", "quiz_post_log", "quiz_questions", "quiz_reviews"]);
});

test("制約: 選択肢は A〜D の4つ、正答 A〜D、slug 形式", async () => {
  await assert.rejects(db.exec("insert into quiz_questions (id,slug,category,question,choices,correct_answer,explanation) values ('x1','x1','c','q','{\"A\":\"a\",\"B\":\"b\",\"C\":\"c\"}','A','e')"));
  await assert.rejects(db.exec("insert into quiz_questions (id,slug,category,question,choices,correct_answer,explanation) values ('x2','x2','c','q','{\"A\":\"a\",\"B\":\"b\",\"C\":\"c\",\"D\":\"d\",\"E\":\"e\"}','A','e')"));
  await assert.rejects(db.exec(NEW("x3").replace("'B','expl B'", "'E','expl'")));
  await assert.rejects(db.exec(NEW("x4").replace("'s-x4'", "'Bad Slug'")));
  await db.exec(NEW("ok1"));
});

test("制約: 承認者・承認日時・本文ハッシュなしの approved / published は不可", async () => {
  await assert.rejects(db.exec("update quiz_questions set status='approved' where id='ok1'"));
  await assert.rejects(db.exec("update quiz_questions set status='approved', approved_by='u1', approved_at=now() where id='ok1'"), /quiz_approved_requires_hash/);
  await assert.rejects(db.exec("update quiz_questions set status='published', approved_by='u1', approved_at=now(), content_hash='h' where id='ok1'"), /quiz_published_requires_schedule/);
});

test("RLS: 匿名は『published かつ予約時刻到達』のみ参照でき、書き込みは不可", async () => {
  await db.exec("update quiz_questions set status='published', approved_by='u1', approved_at=now(), content_hash='h', scheduled_at=now() - interval '1 hour', published_at=now() where id='ok1'");
  await db.exec(NEW("future", "status,approved_by,approved_at,content_hash,scheduled_at|'published','u1',now(),'h',now() + interval '2 days'"));
  await db.exec(NEW("approvedonly", "status,approved_by,approved_at,content_hash|'approved','u1',now(),'h'"));
  await db.exec(NEW("draft1"));
  await asRole("anon", null, async () => {
    assert.deepEqual(await ids(), ["ok1"]);
    await assert.rejects(db.exec("insert into quiz_questions (id,slug,category,question,choices,correct_answer,explanation) values ('h','h','c','q','{\"A\":\"a\",\"B\":\"b\",\"C\":\"c\",\"D\":\"d\"}','A','e')"));
    await assert.rejects(db.exec("select * from quiz_reviews"));
    await assert.rejects(db.exec("select * from admin_audit_log"));
    await assert.rejects(db.exec("select * from quiz_post_log"));
  });
});

test("RLS: 一般の認証ユーザーも公開問題のみ。admin(app_metadata.role)は全件参照可。書き込みは不可", async () => {
  await asRole("authenticated", { sub: "u2", app_metadata: {} }, async () => {
    assert.deepEqual(await ids(), ["ok1"]);
    assert.equal((await db.query("select * from quiz_reviews")).rows.length, 0);
    // 書き込みポリシーが無いので UPDATE は 0 行（または拒否）。実際に変わっていないことを後で確認する。
    await db.exec("update quiz_questions set category='hacked' where id='ok1'").catch(() => {});
  });
  assert.equal((await db.query<{ category: string }>("select category from quiz_questions where id='ok1'")).rows[0].category, "c");
  await asRole("authenticated", { sub: "u1", app_metadata: { role: "admin" } }, async () => {
    assert.deepEqual(await ids(), ["approvedonly", "draft1", "future", "ok1"]);
  });
  // ユーザーが自分で user_metadata に role=admin を入れても app_metadata でないため権限なし
  await asRole("authenticated", { sub: "u3", user_metadata: { role: "admin" }, app_metadata: {} }, async () => {
    assert.deepEqual(await ids(), ["ok1"]);
  });
});

test("トリガー: 承認後に本文を変更すると承認が自動無効化される（status=draft、承認情報クリア、匿名から非公開）", async () => {
  await db.exec("update quiz_questions set explanation='changed' where id='ok1'");
  const r = (await db.query<Record<string, unknown>>("select status, approved_by, content_hash, scheduled_at, published_at from quiz_questions where id='ok1'")).rows[0];
  assert.deepEqual(r, { status: "draft", approved_by: null, content_hash: null, scheduled_at: null, published_at: null });
  await asRole("anon", null, async () => assert.deepEqual(await ids(), []));
  // 本文以外の更新（category）では無効化されない
  await db.exec("update quiz_questions set category='x' where id='approvedonly'");
  assert.equal((await db.query<{ status: string }>("select status from quiz_questions where id='approvedonly'")).rows[0].status, "approved");
});

test("重複投稿防止: (question_id, platform) は1行のみ。校閲記録・監査ログは追記専用", async () => {
  await db.exec("insert into quiz_post_log (question_id, platform, status) values ('approvedonly','x','sending')");
  await assert.rejects(db.exec("insert into quiz_post_log (question_id, platform, status) values ('approvedonly','x','sending')"), /quiz_post_log_unique|unique/);
  await db.exec("insert into quiz_reviews (question_id, kind, reviewer, verdict, content_hash) values ('approvedonly','ai','claude','pass','h')");
  await assert.rejects(db.exec("insert into quiz_reviews (question_id, kind, reviewer, verdict, content_hash) values ('approvedonly','bot','claude','pass','h')"));
  await db.exec("insert into admin_audit_log (actor_id, actor_kind, action, entity, entity_id) values ('u1','human','approve','quiz_question','approvedonly')");
  await assert.rejects(db.exec("update admin_audit_log set action='x'"), /append-only/);
  await assert.rejects(db.exec("delete from admin_audit_log"), /append-only/);
  await asRole("authenticated", { sub: "u1", app_metadata: { role: "admin" } }, async () => {
    assert.equal((await db.query("select * from quiz_reviews")).rows.length, 1);
    assert.equal((await db.query("select * from admin_audit_log")).rows.length, 1);
  });
});

test("監査ログは TRUNCATE でも消せない（文トリガー＋権限）", async () => {
  await assert.rejects(db.exec("truncate public.admin_audit_log"), /append-only|truncate/);
  for (const role of ["anon", "authenticated", "service_role"]) {
    await asRole(role, null, async () => {
      await assert.rejects(db.exec("truncate public.admin_audit_log"));
    });
  }
  await asRole("service_role", null, async () => {
    assert.ok((await db.query("select * from admin_audit_log")).rows.length >= 1);
  });
});

test("匿名・一般ユーザーは承認者メール/ID・content_hash 列を読めない（列権限）。公開列は読める", async () => {
  await db.exec(NEW("pubcol", "status,approved_by,approved_by_email,approved_at,content_hash,scheduled_at,published_at|'published','u1','admin@example.test',now(),'h',now() - interval '1 hour',now()"));
  for (const role of ["anon", "authenticated"]) {
    await asRole(role, { sub: "u9", app_metadata: {} }, async () => {
      await assert.rejects(db.exec("select approved_by_email from quiz_questions"), /permission denied/);
      await assert.rejects(db.exec("select approved_by from quiz_questions"), /permission denied/);
      await assert.rejects(db.exec("select content_hash from quiz_questions"), /permission denied/);
      await assert.rejects(db.exec("select * from quiz_questions"), /permission denied/);
      const r = await db.query("select slug, question, choices, explanation from quiz_questions");
      assert.ok(r.rows.length >= 1);
    });
  }
  await asRole("service_role", null, async () => {
    await db.query("select approved_by_email, content_hash from quiz_questions"); // service_role は全列可
  });
});

// ───── 003: 不要な権限の取り消し（Codex round2 R2-G）。このテストは破壊的（TRUNCATE を試す）なので必ず最後に置く ─────
const ALL_TABLES = ["quiz_questions", "quiz_post_log", "quiz_post_attempts", "quiz_reviews", "admin_audit_log"];

test("権限: anon / authenticated / PUBLIC に、書き込み系・TRUNCATE などの不要な権限が全テーブルでない", async () => {
  const r = await db.query<{ grantee: string; table_name: string; privilege_type: string }>(
    "select grantee, table_name, privilege_type from information_schema.role_table_grants where table_schema='public' and table_name = any($1) and grantee in ('PUBLIC','anon','authenticated') and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER') order by 1,2,3",
    [ALL_TABLES],
  );
  assert.deepEqual(r.rows, []);
  // PUBLIC（grantee=0）の権限は information_schema に出ないため、relacl を aclexplode で直接検査する（検証クエリのエラーは握りつぶさず失敗させる）
  const publicAcl = "select c.relname, a.privilege_type from pg_class c, aclexplode(c.relacl) a where c.relnamespace = 'public'::regnamespace and c.relname = any($1) and a.grantee = 0 order by 1,2";
  assert.deepEqual((await db.query(publicAcl, [ALL_TABLES])).rows, [], "PUBLIC に権限が残っていない");
  // 対照実験: PUBLIC に権限を付与した表を検査クエリが検出できること（検査が空振りしていないことの証明）
  await db.exec("create table public.acl_probe (id int); grant select on public.acl_probe to public");
  const detected = (await db.query<{ relname: string }>(publicAcl, ["{acl_probe}"])).rows;
  await db.exec("drop table public.acl_probe");
  assert.deepEqual(detected.map((r) => r.relname), ["acl_probe"], "検査クエリは PUBLIC の付与を検出できる");
});

test("権限: TRUNCATE は anon / authenticated / service_role のいずれでも全テーブルで拒否される", async () => {
  for (const role of ["anon", "authenticated", "service_role"]) {
    for (const t of ALL_TABLES) {
      await asRole(role, { sub: "u1", app_metadata: { role: "admin" } }, async () => {
        await assert.rejects(db.exec("truncate public." + t), /permission denied|append-only/, role + " → " + t);
      });
    }
  }
});

test("権限: 取り消し後も既存の動作は維持（管理者の参照はRLS経由で可、service_role の書き込み、監査ログの追記専用）", async () => {
  await asRole("authenticated", { sub: "u1", app_metadata: { role: "admin" } }, async () => {
    for (const t of ["quiz_reviews", "admin_audit_log", "quiz_post_log", "quiz_post_attempts"]) await db.query("select count(*) from " + t); // 管理者はポリシー経由で参照可
    await assert.rejects(db.exec("insert into quiz_reviews (question_id, kind, reviewer, verdict, content_hash) values ('ok1','ai','x','pass','h')"), /permission denied|row-level security/);
    await assert.rejects(db.exec("delete from quiz_post_log"), /permission denied/);
  });
  await asRole("authenticated", { sub: "u2", app_metadata: {} }, async () => {
    assert.equal((await db.query("select * from quiz_reviews")).rows.length, 0, "一般ユーザーはRLSで0件");
    assert.equal((await db.query("select * from admin_audit_log")).rows.length, 0);
  });
  await asRole("service_role", null, async () => {
    await db.exec("insert into admin_audit_log (actor_id, actor_kind, action, entity, entity_id) values ('svc','system','probe','quiz_question','ok1')");
    assert.ok((await db.query("select * from admin_audit_log")).rows.length >= 1);
    await assert.rejects(db.exec("update admin_audit_log set action='x'"), /append-only/);
    await assert.rejects(db.exec("delete from admin_audit_log"), /append-only/);
    await db.exec("update quiz_questions set category='svc-write' where id='ok1'"); // service_role の通常更新は可能
  });
});

test("002 は、001 時点で承認済み/公開済みだった既存行があっても失敗せず、ハッシュのない旧承認は draft に戻して再承認を要求する", async () => {
  const legacy = new PGlite();
  await legacy.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth;
    create function auth.jwt() returns jsonb language sql stable as $$ select '{}'::jsonb $$;
    grant usage on schema public, auth to anon, authenticated, service_role;
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  `);
  await legacy.exec(mig("001_quiz.sql"));
  const row = (id: string, st: string) =>
    "insert into quiz_questions (id,slug,category,question,choices,correct_answer,explanation,status,approved_by,approved_at,scheduled_at,published_at) values ('" + id + "','s-" + id + "','c','Q?','{\"A\":\"a\",\"B\":\"b\",\"C\":\"c\",\"D\":\"d\"}','B','e','" + st + "','u1',now(),now(),now())";
  await legacy.exec(row("legacy-approved", "approved"));
  await legacy.exec(row("legacy-published", "published"));
  await legacy.exec(mig("002_review_and_audit.sql")); // 既存行があっても例外にならない
  await legacy.exec(mig("003_revoke_unneeded_privileges.sql"));
  const r = await legacy.query<{ id: string; status: string; approved_by: string | null }>("select id,status,approved_by from quiz_questions order by id");
  assert.deepEqual(r.rows.map((x) => [x.id, x.status, x.approved_by]), [["legacy-approved", "draft", null], ["legacy-published", "draft", null]]);
});

// 認証・CSRF・ログアウト・既存CMS API互換・一般公開ページの回帰テスト。
// Supabase は「ローカルのスタブHTTPサーバー」で代替（外部接続なし）。
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { NextRequest } from "next/server";

const USERS: Record<string, { id: string; email: string; app_metadata: object; user_metadata?: object }> = {
  "tok-admin": { id: "admin-uuid", email: "admin@example.test", app_metadata: { role: "admin" } },
  "tok-plain": { id: "plain-uuid", email: "plain@example.test", app_metadata: {} },
  "tok-meta": { id: "meta-uuid", email: "meta@example.test", app_metadata: {}, user_metadata: { role: "admin" } },
  "tok-reviewer": { id: "rev-uuid", email: "rev@example.test", app_metadata: { role: "reviewer" } },
};
const revoked = new Set<string>();
const logoutCalls: string[] = [];
let server: http.Server;
let base = "http://localhost:3000";
const HOST = "localhost:3000";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "auth-test-"));
const storeFile = path.join(dir, "store.json");

// 動的 import（環境変数設定後に読み込む）
let M: {
  admin: typeof import("../lib/auth/admin");
  proxy: typeof import("../proxy");
  session: typeof import("../app/api/auth/session/route");
  adminQuiz: typeof import("../app/api/admin/quiz/route");
  cmsQuestions: typeof import("../app/api/cms/questions/route");
  cmsReview: typeof import("../app/api/cms/approvals/[questionId]/review/route");
  login: typeof import("../app/api/auth/login/route");
  publicLib: typeof import("../lib/quiz/public");
  quizIdx: typeof import("../lib/quiz");
  quizPage: typeof import("../app/quiz/page");
  repoMod: typeof import("../lib/quiz/file-repo");
  seed: typeof import("../lib/quiz/seed");
};

before(async () => {
  server = http.createServer((req, res) => {
    const auth = (req.headers.authorization ?? "").replace("Bearer ", "");
    const url = new URL(req.url!, "http://x");
    const json = (code: number, body: unknown, headers: Record<string, string> = {}) => {
      res.writeHead(code, { "content-type": "application/json", ...headers });
      res.end(JSON.stringify(body));
    };
    if (url.pathname === "/auth/v1/user") {
      const u = USERS[auth];
      if (!u || revoked.has(auth)) return json(401, { code: 401, msg: "invalid JWT" });
      return json(200, { ...u, aud: "authenticated", role: "authenticated", created_at: "2026-01-01T00:00:00Z" });
    }
    if (url.pathname === "/auth/v1/logout") {
      logoutCalls.push(auth);
      revoked.add(auth);
      res.writeHead(204);
      return res.end();
    }
    if (url.pathname === "/rest/v1/questions") {
      if (req.method === "GET") return json(200, [{ id: "q_1", stem: "s", status: "draft" }], { "content-range": "0-0/1" });
      let b = "";
      req.on("data", (c) => (b += c));
      return req.on("end", () => json(201, JSON.parse(b)));
    }
    json(404, {});
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = "http://127.0.0.1:" + (server.address() as { port: number }).port;
  Object.assign(process.env, {
    NEXT_PUBLIC_SUPABASE_URL: base,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key-test",
    SUPABASE_SERVICE_ROLE_KEY: "service-key-test",
    QUIZ_STORE_FILE: storeFile,
    QUIZ_BACKEND: "file",
  });
  delete process.env.ADMIN_DEV_BYPASS;
  M = {
    admin: await import("../lib/auth/admin"),
    proxy: await import("../proxy"),
    session: await import("../app/api/auth/session/route"),
    adminQuiz: await import("../app/api/admin/quiz/route"),
    cmsQuestions: await import("../app/api/cms/questions/route"),
    cmsReview: await import("../app/api/cms/approvals/[questionId]/review/route"),
    login: await import("../app/api/auth/login/route"),
    publicLib: await import("../lib/quiz/public"),
    quizIdx: await import("../lib/quiz"),
    quizPage: await import("../app/quiz/page"),
    repoMod: await import("../lib/quiz/file-repo"),
    seed: await import("../lib/quiz/seed"),
  };
  await new M.repoMod.FileQuizRepository(storeFile).insertIfAbsent(M.seed.seedToQuestions());
});
after(() => server.close());

const req = (p: string, init: { method?: string; cookie?: string; bearer?: string; origin?: string | null; body?: unknown } = {}) => {
  const headers: Record<string, string> = { host: HOST };
  if (init.cookie) headers.cookie = "sb-admin-token=" + init.cookie;
  if (init.bearer !== undefined) headers.authorization = "Bearer " + init.bearer;
  if (init.origin !== null && init.origin !== undefined) headers.origin = init.origin;
  if (init.body) headers["content-type"] = "application/json";
  return new NextRequest("http://" + HOST + p, { method: init.method ?? "GET", headers, body: init.body ? JSON.stringify(init.body) : undefined });
};
const SAME = "http://" + HOST;

// ───── 認可 ─────
test("管理者のみ許可: admin○ / 一般ユーザー× / user_metadata の自己申告× / reviewer×（今回は admin のみ）", async () => {
  assert.equal((await M.admin.authorize(req("/api/admin/quiz", { cookie: "tok-admin" }))).ok, true);
  for (const t of ["tok-plain", "tok-meta", "tok-reviewer", "tok-unknown"]) assert.equal((await M.admin.authorize(req("/api/admin/quiz", { cookie: t }))).ok, false, t);
  assert.equal((await M.admin.authorize(req("/api/admin/quiz"))).ok, false);
});

test("Supabase未設定時は管理操作を全拒否（有効なトークンでも）", async () => {
  const saved = { ...process.env };
  for (const k of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"]) delete process.env[k];
  try {
    assert.equal((await M.admin.authorize(req("/api/admin/quiz", { cookie: "tok-admin" }))).ok, false);
  } finally {
    Object.assign(process.env, saved);
  }
  // プレースホルダ値（.env.local.example / demo）も「未設定」扱い
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://demo.supabase.co";
  try {
    assert.equal((await M.admin.authorize(req("/api/admin/quiz", { cookie: "tok-admin" }))).ok, false);
  } finally {
    process.env.NEXT_PUBLIC_SUPABASE_URL = base;
  }
});

test("開発用バイパスは本番(NODE_ENV=production / VERCEL)では無効", async () => {
  const saved = { ...process.env };
  process.env.ADMIN_DEV_BYPASS = "1";
  assert.equal((await M.admin.authorize(req("/api/admin/quiz"))).ok, true, "開発時のみ有効");
  (process.env as Record<string, string>).NODE_ENV = "production";
  assert.equal((await M.admin.authorize(req("/api/admin/quiz"))).ok, false);
  (process.env as Record<string, string>).NODE_ENV = "test";
  process.env.VERCEL = "1";
  assert.equal((await M.admin.authorize(req("/api/admin/quiz"))).ok, false);
  for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
  Object.assign(process.env, saved);
  delete process.env.ADMIN_DEV_BYPASS;
});

test("空の Bearer ヘッダーは Cookie にフォールバック（旧 localStorage 空トークン対策）", async () => {
  assert.equal((await M.admin.authorize(req("/api/admin/quiz", { cookie: "tok-admin", bearer: "" }))).ok, true);
});

// ───── 未認証アクセス（proxy / ルート両方） ─────
test("未認証ユーザーは管理APIにアクセスできない（proxy・ルート双方で拒否）", async () => {
  for (const p of ["/api/admin/quiz", "/api/cms/questions", "/api/analytics/stats"]) {
    const r = await M.proxy.proxy(req(p));
    assert.equal(r.status, 401, p);
  }
  const g = await M.adminQuiz.GET(req("/api/admin/quiz"));
  assert.equal(g.status, 401);
  const post = await M.adminQuiz.POST(req("/api/admin/quiz", { method: "POST", origin: SAME, body: { action: "approve", id: "q001", confirmed: true, scheduledAt: new Date().toISOString() } }));
  assert.equal(post.status, 401);
  const nonAdmin = await M.adminQuiz.POST(req("/api/admin/quiz", { method: "POST", cookie: "tok-plain", origin: SAME, body: { action: "run" } }));
  assert.equal(nonAdmin.status, 401);
});

test("管理画面ページは未認証なら /admin/login へリダイレクト。ログインページと一般公開ページは対象外", async () => {
  const r = await M.proxy.proxy(req("/admin/quiz"));
  assert.equal(r.status, 307);
  assert.match(r.headers.get("location")!, /\/admin\/login$/);
  assert.notEqual((await M.proxy.proxy(req("/admin/login"))).status, 307);
  assert.equal((await M.proxy.proxy(req("/admin/quiz", { cookie: "tok-admin" }))).headers.get("location"), null);
  const matchers = M.proxy.config.matcher as string[];
  for (const pub of ["/", "/quiz", "/quiz/some-slug", "/api/quiz/image/x", "/api/analytics/events", "/api/cron/publish"]) {
    assert.ok(!matchers.some((m) => new RegExp("^" + m.replace(/:path\*/g, ".*") + "$").test(pub)), "公開パスは proxy 対象外: " + pub);
  }
});

// ───── CSRF ─────
test("CSRF: Cookie認証の状態変更は同一Originのみ。Bearerヘッダー認証は対象外", async () => {
  const body = { action: "run" };
  const noOrigin = await M.adminQuiz.POST(req("/api/admin/quiz", { method: "POST", cookie: "tok-admin", body }));
  assert.equal(noOrigin.status, 403);
  const cross = await M.adminQuiz.POST(req("/api/admin/quiz", { method: "POST", cookie: "tok-admin", origin: "https://evil.example", body }));
  assert.equal(cross.status, 403);
  assert.equal((await M.proxy.proxy(req("/api/admin/quiz", { method: "POST", cookie: "tok-admin", origin: "https://evil.example" }))).status, 403);
  const same = await M.adminQuiz.POST(req("/api/admin/quiz", { method: "POST", cookie: "tok-admin", origin: SAME, body }));
  assert.equal(same.status, 200);
  const viaHeader = await M.adminQuiz.POST(req("/api/admin/quiz", { method: "POST", bearer: "tok-admin", body }));
  assert.equal(viaHeader.status, 200);
  // セッションAPIも同様
  assert.equal((await M.session.DELETE(req("/api/auth/session", { method: "DELETE", cookie: "tok-admin", origin: "https://evil.example" }))).status, 403);
  assert.equal((await M.session.POST(req("/api/auth/session", { method: "POST", origin: "https://evil.example", body: { access_token: "tok-admin" } }))).status, 403);
});

// ───── ログイン / ログアウト ─────
test("ログイン: 管理者のみ HttpOnly Cookie が発行される。旧デモログインは廃止(410)", async () => {
  const ok = await M.session.POST(req("/api/auth/session", { method: "POST", origin: SAME, body: { access_token: "tok-admin" } }));
  assert.equal(ok.status, 200);
  const setCookie = ok.headers.get("set-cookie")!;
  assert.match(setCookie, /sb-admin-token=tok-admin/);
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=lax/i);
  const ng = await M.session.POST(req("/api/auth/session", { method: "POST", origin: SAME, body: { access_token: "tok-plain" } }));
  assert.equal(ng.status, 403);
  assert.equal(ng.headers.get("set-cookie"), null);
  assert.equal((await M.login.POST()).status, 410);
});

test("ログアウト後は管理操作できない（Cookie削除 + サーバー側セッション失効）", async () => {
  USERS["tok-logout"] = { id: "lo-uuid", email: "lo@example.test", app_metadata: { role: "admin" } };
  assert.equal((await M.adminQuiz.GET(req("/api/admin/quiz", { cookie: "tok-logout" }))).status, 200);
  const out = await M.session.DELETE(req("/api/auth/session", { method: "DELETE", cookie: "tok-logout", origin: SAME }));
  assert.equal(out.status, 200);
  assert.deepEqual(await out.json(), { ok: true, revoked: true });
  assert.match(out.headers.get("set-cookie")!, /sb-admin-token=;/);
  assert.ok(logoutCalls.includes("tok-logout"));
  // 盗まれた/残っているトークンを再利用しても拒否される
  assert.equal((await M.adminQuiz.GET(req("/api/admin/quiz", { cookie: "tok-logout" }))).status, 401);
  assert.equal((await M.adminQuiz.POST(req("/api/admin/quiz", { method: "POST", cookie: "tok-logout", origin: SAME, body: { action: "run" } }))).status, 401);
  assert.equal((await M.proxy.proxy(req("/admin/quiz", { cookie: "tok-logout" }))).status, 307);
  // Cookieなしでも管理操作できない
  assert.equal((await M.adminQuiz.GET(req("/api/admin/quiz"))).status, 401);
});

// ───── 管理API（承認） ─────
test("管理API: 承認には確認チェック(confirmed)とAI一次校閲が必須。AIの記録は人間の承認に置き換わらない", async () => {
  const repo = new M.repoMod.FileQuizRepository(storeFile);
  const [q] = await repo.listQuestions();
  const body = { action: "approve", id: q.id, scheduledAt: new Date().toISOString() };
  const noConfirm = await M.adminQuiz.POST(req("/api/admin/quiz", { method: "POST", cookie: "tok-admin", origin: SAME, body }));
  assert.equal(noConfirm.status, 400);
  const noReview = await M.adminQuiz.POST(req("/api/admin/quiz", { method: "POST", cookie: "tok-admin", origin: SAME, body: { ...body, confirmed: true } }));
  assert.equal(noReview.status, 400); // draft（AI一次校閲なし）
  const { recordAiReview } = await import("../lib/quiz/workflow");
  await recordAiReview(repo, q.id, { reviewer: "claude-ai", verdict: "pass", comments: "ok" });
  // 本文ハッシュ（画面で確認した本文）なしの承認は拒否
  const noHash = await M.adminQuiz.POST(req("/api/admin/quiz", { method: "POST", cookie: "tok-admin", origin: SAME, body: { ...body, confirmed: true } }));
  assert.equal(noHash.status, 400);
  const seen = (await (await M.adminQuiz.GET(req("/api/admin/quiz", { cookie: "tok-admin" }))).json()).data.find((r: { id: string }) => r.id === q.id).current_hash as string;
  // 古い画面: 確認後に本文が変わると 409 Conflict で拒否し、状態を変えない
  const { contentHash } = await import("../lib/quiz/hash");
  const orig = (await repo.getQuestion(q.id))!;
  await repo.updateQuestion(q.id, { explanation: orig.explanation + "（別の担当者が変更）" });
  await repo.updateQuestion(q.id, { status: "reviewed" });
  await recordAiReview(repo, q.id, { reviewer: "claude-ai", verdict: "pass", comments: "再校閲" });
  const stale = await M.adminQuiz.POST(req("/api/admin/quiz", { method: "POST", cookie: "tok-admin", origin: SAME, body: { ...body, confirmed: true, expectedHash: seen } }));
  assert.equal(stale.status, 409);
  assert.equal((await stale.json()).code, "APPROVAL_CONFLICT");
  assert.equal((await repo.getQuestion(q.id))!.status, "reviewed");
  assert.notEqual(contentHash((await repo.getQuestion(q.id))!), seen);
  const latest = (await (await M.adminQuiz.GET(req("/api/admin/quiz", { cookie: "tok-admin" }))).json()).data.find((r: { id: string }) => r.id === q.id).current_hash as string;
  const ok = await M.adminQuiz.POST(req("/api/admin/quiz", { method: "POST", cookie: "tok-admin", origin: SAME, body: { ...body, confirmed: true, expectedHash: latest } }));
  assert.equal(ok.status, 200);
  const after = (await repo.getQuestion(q.id))!;
  assert.equal(after.approved_by, "admin-uuid"); // 認証済みユーザーID（クライアント入力ではない）
  const list = await (await M.adminQuiz.GET(req("/api/admin/quiz", { cookie: "tok-admin" }))).json();
  assert.equal(list.connection, "ok");
  const row = list.data.find((r: { id: string }) => r.id === q.id);
  assert.equal(row.hash_ok, true);
  assert.equal(row.ai_review.verdict, "pass");
});

// ───── DB障害 ─────
test("DB障害: 管理APIは 503(DB_UNAVAILABLE) で明示、一般公開ページは500にならず『公開中の問題はありません』", async () => {
  const good = fs.readFileSync(storeFile, "utf8");
  fs.writeFileSync(storeFile, "{ corrupted");
  const errors: string[] = [];
  const orig = console.error;
  console.error = (...a: unknown[]) => void errors.push(a.join(" "));
  try {
    const r = await M.adminQuiz.GET(req("/api/admin/quiz", { cookie: "tok-admin" }));
    assert.equal(r.status, 503);
    assert.equal((await r.json()).error, "DB_UNAVAILABLE");
    const list = await M.publicLib.loadPublicList();
    assert.deepEqual(list, { ok: false, questions: [] });
    const page = JSON.stringify(await M.quizPage.default());
    assert.match(page, /現在、公開中の問題はありません。/);
    assert.ok(errors.some((e) => e.includes("[quiz]")), "サーバーログに障害を記録");
    assert.ok(errors.some((e) => e.includes("[admin/quiz]")));
  } finally {
    console.error = orig;
    fs.writeFileSync(storeFile, good);
  }
});

test("Supabase未設定（QUIZ_BACKEND=supabase）でも一般公開ページは例外を出さず、エラーをログに残す", async () => {
  const saved = { ...process.env };
  for (const k of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"]) delete process.env[k];
  process.env.QUIZ_BACKEND = "supabase";
  M.quizIdx.resetRepositoryForTests();
  const errors: string[] = [];
  const orig = console.error;
  console.error = (...a: unknown[]) => void errors.push(a.join(" "));
  try {
    const page = JSON.stringify(await M.quizPage.default());
    assert.match(page, /現在、公開中の問題はありません。/);
    assert.deepEqual(await M.publicLib.loadPublicOne("x"), { ok: false, question: null });
    assert.ok(errors.length >= 2);
  } finally {
    console.error = orig;
    Object.assign(process.env, saved);
    process.env.QUIZ_BACKEND = "file";
    M.quizIdx.resetRepositoryForTests();
  }
});

test("一般公開: 未承認問題は一覧・個別とも公開されない（正常時）", async () => {
  M.quizIdx.resetRepositoryForTests();
  const list = await M.publicLib.loadPublicList();
  assert.equal(list.ok, true);
  assert.equal(list.questions.length, 0);
  assert.deepEqual(await M.publicLib.loadPublicOne("noticing-hypothesis-k7m2"), { ok: true, question: null });
});

// ───── 既存CMS API の入出力互換 ─────
test("既存CMS API: 認証はSupabase、入出力仕様は従来どおり（401形式・400形式・一覧形式・作成201形式）", async () => {
  const unauth = await M.cmsQuestions.GET(req("/api/cms/questions"));
  assert.equal(unauth.status, 401);
  assert.deepEqual(await unauth.json(), { success: false, error: "Unauthorized" });

  const list = await M.cmsQuestions.GET(req("/api/cms/questions?status=draft&page=1&limit=20", { cookie: "tok-admin" }));
  assert.equal(list.status, 200);
  const lj = await list.json();
  assert.deepEqual(Object.keys(lj).sort(), ["data", "limit", "page", "success", "timestamp", "total"]);
  assert.equal(lj.success, true);
  assert.equal(lj.total, 1);
  assert.equal(lj.page, 1);
  assert.equal(lj.limit, 20);
  assert.ok(Array.isArray(lj.data));

  const bad = await M.cmsQuestions.POST(req("/api/cms/questions", { method: "POST", cookie: "tok-admin", origin: SAME, body: { stem: "x" } }));
  assert.equal(bad.status, 400);
  assert.deepEqual(await bad.json(), { success: false, error: "Missing required fields" });

  const made = await M.cmsQuestions.POST(
    req("/api/cms/questions", { method: "POST", cookie: "tok-admin", origin: SAME, body: { stem: "問", choices: { A: "a", B: "b", C: "c", D: "d" }, correctChoice: "A", explanation: "解" } }),
  );
  assert.equal(made.status, 201);
  const mj = await made.json();
  assert.equal(mj.success, true);
  assert.equal(mj.data.createdBy, "admin-uuid", "createdBy には認証ユーザーIDが入る（従来の userId 相当）");
  assert.equal(mj.data.status, "draft");
  assert.match(mj.data.id, /^q_\d{8}_/);
});

test("既存CMS API: 承認レビュー API の入力検証が従来どおり（admin ロールで到達）、非管理者は 401", async () => {
  const ctx = { params: Promise.resolve({ questionId: "q_1" }) };
  const r = await M.cmsReview.POST(req("/api/cms/approvals/q_1/review", { method: "POST", cookie: "tok-admin", origin: SAME, body: { status: "maybe" } }), ctx);
  assert.equal(r.status, 400);
  assert.deepEqual(await r.json(), { success: false, error: "Status must be 'approved' or 'rejected'" });
  const un = await M.cmsReview.POST(req("/api/cms/approvals/q_1/review", { method: "POST", cookie: "tok-plain", origin: SAME, body: { status: "approved" } }), ctx);
  assert.equal(un.status, 401);
});

test("persistent dry-run blocks Cron and admin publishing before database or SNS calls", async (t) => {
  const saved = { ...process.env };
  t.after(() => { process.env = saved; });
  Object.assign(process.env, {
    CRON_SECRET: "aa", SNS_MODE: "dry-run", QUIZ_BACKEND: "supabase",
    INSTAGRAM_CAROUSEL_ENABLED: "true",
  });
  const actualFetch = globalThis.fetch;
  const calls: string[] = [];
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input);
    calls.push(url);
    assert.equal(url, base + "/auth/v1/user");
    return actualFetch(input, init);
  });
  const cron = await import("../app/api/cron/publish/route");
  const route = "/api/cron/publish";
  assert.equal((await cron.GET(req(route, { bearer: "éa" }))).status, 401);
  assert.deepEqual(await (await cron.GET(req(route, { bearer: "aa" }))).json(),
    { ok: true, mode: "dry-run", state: "disabled" });
  for (const action of ["run", "retry"]) {
    assert.equal((await M.adminQuiz.POST(req("/api/admin/quiz", {
      method: "POST", bearer: "tok-admin", body: { action, id: "q001", platform: "x" },
    }))).status, 409);
  }
  assert.deepEqual(calls, [base + "/auth/v1/user", base + "/auth/v1/user"]);
});

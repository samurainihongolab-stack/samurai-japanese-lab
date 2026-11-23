// scripts/codex-review.mjs の安全性テスト。本物の Codex は呼ばず、偽の codex（シェルスクリプト）を CODEX_BIN で差し込む。
// 検証: 秘密/シンボリックリンクの除外、OSサンドボックスによる読み取り拒否（実測）、正常・異常・シグナル終了時の一時ディレクトリ削除、
//       ラウンド上限の強制、未コミット変更を変えないこと、範囲指定(--files/--context/--since)、チャンク分割、判定不能時の停止。
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";

const SCRIPT = path.join(process.cwd(), "scripts", "codex-review.mjs");
const JWT = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dBjftJeZ4CVPmB92K27uhbUJU1p1r_wW1gFWFOEjXk";
const API_KEY_LITERAL = "SUPERSECRETVALUE1234567890";
const ENV_CANARY = "ENV_FILE_CANARY_DO_NOT_LEAK_98765";
// 鍵ブロックの見出しをリテラルで書かない（このテストファイル自体が「秘密鍵を含む」と判定されて監査対象外になるのを避ける）
const BEGIN = "-----" + "BEGIN";
const END = "-----" + "END";
const LINK_CANARY = "SYMLINK_TARGET_CANARY_55555";

let tmpRoot: string; // スクリプトの os.tmpdir() になる（一時ディレクトリの残留検査用）
let repo: string;
let fake: string;
let fx: string; // 偽 Codex の入出力置き場（CODEX_HOME として許可される）。共有の一時領域(tmpRoot)は Codex から読めない
const probeFile = () => path.join(fx, "probe.json");
const cfgFile = () => path.join(fx, "fake-config");
const sh = (cmd: string, args: string[], cwd = repo) => spawnSync(cmd, args, { cwd, encoding: "utf8" });
const write = (rel: string, body: string) => {
  fs.mkdirSync(path.dirname(path.join(repo, rel)), { recursive: true });
  fs.writeFileSync(path.join(repo, rel), body);
};
const leftovers = () => fs.readdirSync(tmpRoot).filter((d) => d.startsWith("codex-review-"));

function runScript(args: string[], opts: { signalAfterProbe?: NodeJS.Signals } = {}): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn("node", [SCRIPT, ...args], {
      cwd: repo,
      env: { PATH: process.env.PATH!, HOME: path.join(tmpRoot, "home"), TMPDIR: tmpRoot, CODEX_HOME: fx, CODEX_BIN: fake } as unknown as NodeJS.ProcessEnv,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    let probeTimer: ReturnType<typeof setInterval> | undefined;
    if (opts.signalAfterProbe) {
      const t = probeTimer = setInterval(() => {
        if (fs.existsSync(probeFile())) {
          clearInterval(t);
          setTimeout(() => child.kill(opts.signalAfterProbe), 300);
        }
      }, 50);
    }
    child.on("close", (code) => {
      clearInterval(probeTimer);
      resolve({ code, stdout, stderr });
    });
  });
}
const setFake = (cfg: { mode?: string; verdict?: string }) => fs.writeFileSync(cfgFile(), JSON.stringify(cfg));
const resetFakeOutputs = () => {
  fs.rmSync(probeFile(), { force: true });
  for (const f of fs.readdirSync(fx)) if (f.startsWith("captured-")) fs.rmSync(path.join(fx, f));
};
const captured = () => fs.readdirSync(fx).filter((f) => f.startsWith("captured-")).sort().map((f) => fs.readFileSync(path.join(fx, f), "utf8"));
const porcelain = () => sh("git", ["status", "--porcelain=v1", "-uall"]).stdout;

before(() => {
  tmpRoot = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "cr-test-")));
  repo = path.join(tmpRoot, "repo");
  fx = path.join(tmpRoot, "fx");
  fs.mkdirSync(fx);
  fs.mkdirSync(path.join(tmpRoot, "bin"));
  fs.writeFileSync(path.join(tmpRoot, "shared-tmp-canary.txt"), "SHARED_TMP_CANARY\n"); // 共有の一時領域にある他者のファイルを想定
  fs.mkdirSync(repo);
  sh("git", ["init", "-q"]);
  sh("git", ["config", "user.email", "t@example.test"]);
  sh("git", ["config", "user.name", "t"]);
  write(".gitignore", ".env*\n/reviews/\n");
  write("src/app.ts", "export const a = 1;\n".repeat(30));
  write("src/other.ts", "export const o = 1;\n");
  write("lib/helper.ts", "export const helper = () => 42;\n");
  sh("git", ["add", "-A"]);
  sh("git", ["commit", "-q", "-m", "base"]);
  // 未コミットの変更と新規ファイル
  write("src/app.ts", "export const a = 2;\n" + "export const a2 = 1;\n".repeat(30));
  write("src/new.ts", `const token = "${JWT}";\nconst API_KEY = "${API_KEY_LITERAL}";\nexport const x = process.env.SOME_SECRET_KEY;\n`);
  write(".env.local", `SECRET=${ENV_CANARY}\n`);
  write("config/credentials.json", `{"k":"${ENV_CANARY}"}\n`);
  write("keys/server.pem", `${BEGIN} PRIVATE KEY-----\n${ENV_CANARY}\n${END} PRIVATE KEY-----\n`);
  write("notes/privkey.txt", `memo\n${BEGIN} RSA PRIVATE KEY-----\n${ENV_CANARY}\n${END} RSA PRIVATE KEY-----\n`);
  write(".env.link-target", LINK_CANARY + "\n"); // 指す先自体は .env* で除外される。リンク経由でも漏れないことを検証
  fs.symlinkSync(path.join(repo, ".env.local"), path.join(repo, "src", "link.ts")); // 除外されない名前のリンク → .env.local を指す
  fs.symlinkSync(path.join(repo, ".env.link-target"), path.join(repo, "src", "link2.ts"));
  fs.writeFileSync(path.join(repo, "src", "blob.dat"), Buffer.from([0, 1, 2, 3, 0, 255]));

  // 偽の codex。stdin を保存し、サンドボックス内での読み取り/書き込みを試して結果を記録、指定の判定を返す。
  fake = path.join(tmpRoot, "bin", "fake-codex.sh");
  fs.writeFileSync(
    fake,
    `#!/bin/bash
OUT=""
while [ $# -gt 0 ]; do case "$1" in --output-last-message) OUT="$2"; shift 2;; *) shift;; esac; done
FX="$CODEX_HOME"
CFG="$FX/fake-config"
N=$(ls "$FX" | grep -c '^captured-')
cat > "$FX/captured-$N.txt"
MODE=$(python3 -c "import json;print(json.load(open('$CFG')).get('mode','pass'))" 2>/dev/null)
VERDICT=$(python3 -c "import json;print(json.load(open('$CFG')).get('verdict','PASS'))" 2>/dev/null)
ROOT_DIR="${"$"}{FAKE_ROOT}"
PROBE_ROOT=$(cat "$FX/fake-root")
SHARED=$(cat "$FX/shared-canary-path")
r1=ALLOWED; cat "$PROBE_ROOT/.env.local" >/dev/null 2>&1 || r1=DENIED
r2=ALLOWED; cat "$PROBE_ROOT/src/app.ts" >/dev/null 2>&1 || r2=DENIED
r5=ALLOWED; cat "$HOME/.codex-review-test-home-canary" >/dev/null 2>&1 || r5=DENIED
r3=ALLOWED; ( echo x > "$HOME/codex-review-sandbox-write-probe" ) 2>/dev/null || r3=DENIED
rm -f "$HOME/codex-review-sandbox-write-probe"
r4=ALLOWED; ( echo x > "$TMPDIR/ok-write" ) 2>/dev/null || r4=DENIED
r6=ALLOWED; cat "$SHARED" >/dev/null 2>&1 || r6=DENIED
r8=no; [[ "$TMPDIR" == *codex-review-* ]] && r8=yes
r7=ALLOWED; ( echo x > "$(dirname "$SHARED")/shared-tmp-write-probe" ) 2>/dev/null || r7=DENIED
printf '{"read_env":"%s","read_src":"%s","write_home":"%s","write_tmp":"%s","read_home":"%s","read_shared_tmp":"%s","write_shared_tmp":"%s","tmpdir_in_bundle":"%s"}' $r1 $r2 $r3 $r4 $r5 $r6 $r7 $r8 > "$FX/probe.json"
case "$MODE" in
  error) echo "boom" >&2; exit 1;;
  sleep) sleep 6;;
  garbage) printf '指摘なし\\nVERDICT: MAYBE\\n' > "$OUT"; echo "tokens used"; echo "1,234"; exit 0;;
esac
printf '指摘なし\\nVERDICT: %s\\n' "$VERDICT" > "$OUT"
echo "tokens used"; echo "1,234"
`,
    { mode: 0o755 },
  );
  fs.writeFileSync(path.join(fx, "fake-root"), repo);
  fs.writeFileSync(path.join(fx, "shared-canary-path"), path.join(tmpRoot, "shared-tmp-canary.txt"));
  setFake({});
});
after(() => fs.rmSync(tmpRoot, { recursive: true, force: true }));

const resetState = () => {
  fs.rmSync(path.join(repo, "reviews"), { recursive: true, force: true });
  resetFakeOutputs();
};

test("dry-run: 秘密・鍵・認証情報・シンボリックリンク・バイナリは送らず、除外理由が記録される。プロンプトに秘密が含まれない", async () => {
  resetState();
  const before = porcelain();
  const r = await runScript(["--round", "1", "--skip-checks", "--dry-run"]);
  assert.equal(r.code, 0, r.stderr);
  const m = JSON.parse(r.stdout);
  const sent = m.chunks.flatMap((c: { files: string[] }) => c.files);
  assert.ok(sent.includes("src/app.ts") && sent.includes("src/new.ts"), "未コミット変更と新規ファイルを含む");
  for (const bad of [".env.local", "config/credentials.json", "keys/server.pem", "notes/privkey.txt", "src/link.ts", "src/link2.ts", "src/blob.dat"]) assert.ok(!sent.includes(bad), bad + " は送らない");
  const reasons = Object.fromEntries(m.skipped as [string, string][]);
  assert.match(reasons["src/link.ts"], /シンボリックリンク/);
  assert.match(reasons["src/link2.ts"], /シンボリックリンク/);
  assert.match(reasons["keys/server.pem"], /鍵/);
  assert.match(reasons["config/credentials.json"], /認証情報/);
  assert.match(reasons["notes/privkey.txt"], /秘密鍵/);
  const prompt: string = m.promptSample;
  for (const secret of [JWT, API_KEY_LITERAL, ENV_CANARY, LINK_CANARY]) assert.ok(!prompt.includes(secret), "プロンプトに秘密が含まれない: " + secret.slice(0, 12));
  assert.ok(prompt.includes("***REDACTED***"), "リテラルの秘密はマスクされる");
  assert.ok(prompt.includes("process.env.SOME_SECRET_KEY"), "コードの式はマスクしない（監査精度）");
  assert.equal(porcelain(), before, "git の状態を変えない");
  assert.deepEqual(leftovers(), [], "dry-run でも一時ディレクトリを残さない");
});

test("範囲指定: --files で絞り込み（対象外を記録）、--context で関連ファイルを参照専用で添付、--since でコミット範囲を指定", async () => {
  resetState();
  const r = await runScript(["--round", "1", "--skip-checks", "--dry-run", "--files", "src/app.ts", "--context", "lib/helper.ts,.env.local"]);
  assert.equal(r.code, 0, r.stderr);
  const m = JSON.parse(r.stdout);
  assert.deepEqual(m.chunks.flatMap((c: { files: string[] }) => c.files), ["src/app.ts"]);
  assert.ok(m.outOfFocus.includes("src/new.ts"), "対象外が記録される");
  assert.deepEqual(m.context, ["lib/helper.ts"]);
  assert.ok(m.promptSample.includes("CONTEXT(監査対象外・参照のみ): lib/helper.ts"));
  assert.ok(m.skipped.some(([f, why]: [string, string]) => f === ".env.local" && /除外/.test(why)), "機密の文脈指定は拒否される");
  assert.ok(!m.promptSample.includes(ENV_CANARY));
  // --since: 直前コミットを指定して差分の基準が変わる
  sh("git", ["add", "src/other.ts"]);
  fs.appendFileSync(path.join(repo, "src/other.ts"), "export const o2 = 2;\n");
  sh("git", ["add", "src/other.ts"]);
  sh("git", ["commit", "-q", "-m", "second"]);
  const since = await runScript(["--round", "1", "--skip-checks", "--dry-run", "--since", "HEAD~1", "--files", "src/other.ts"]);
  assert.equal(since.code, 0, since.stderr);
  assert.deepEqual(JSON.parse(since.stdout).chunks.flatMap((c: { files: string[] }) => c.files), ["src/other.ts"], "コミット済み差分も範囲指定で対象にできる");
  const bad = await runScript(["--round", "1", "--skip-checks", "--dry-run", "--since", "no-such-rev"]);
  assert.equal(bad.code, 3);
  const evil = await runScript(["--round", "1", "--skip-checks", "--dry-run", "--files", "../etc/passwd"]);
  assert.equal(evil.code, 3, "パス脱出は拒否");
});

before(() => {
  const fixtureHome = path.join(tmpRoot, "home");
  fs.mkdirSync(fixtureHome);
  fs.writeFileSync(path.join(fixtureHome, ".codex-review-test-home-canary"), "HOME_CANARY\n");
});

const sandboxProbe = spawnSync("/usr/bin/sandbox-exec",
  ["-p", "(version 1) (allow default)", "/usr/bin/true"], { encoding: "utf8" });
const sandboxAvailable = sandboxProbe.status === 0;
const sandboxTest = (name: string, fn: () => Promise<void>) => test(name, {
  skip: !sandboxAvailable && process.env.REQUIRE_AUDIT_SANDBOX !== "1"
    ? "sandbox-exec cannot start in this environment" : false,
}, async () => {
  assert.ok(sandboxAvailable, sandboxProbe.stderr || String(sandboxProbe.error));
  await fn();
});

sandboxTest("OSサンドボックス: Codex 側からプロジェクト（.env.local も含む）を読めない・HOME に書けない。一時領域には書ける", async () => {
  resetState();
  setFake({});
  const r = await runScript(["--round", "1", "--skip-checks"]);
  assert.equal(r.code, 0, r.stderr);
  const probe = JSON.parse(fs.readFileSync(probeFile(), "utf8"));
  assert.equal(probe.read_env, "DENIED", ".env.local を読めてはいけない");
  assert.equal(probe.read_src, "DENIED", "プロジェクトのソースも読めない（渡した差分だけが見える）");
  assert.equal(probe.write_home, "DENIED", "HOME への書き込みは拒否");
  assert.equal(probe.write_tmp, "ALLOWED");
  assert.equal(probe.read_shared_tmp, "DENIED", "共有の一時領域にある他者のファイルも読めない（今回の専用ディレクトリのみ許可）");
  assert.equal(probe.write_shared_tmp, "DENIED", "共有の一時領域へ書き込めない");
  assert.equal(probe.tmpdir_in_bundle, "yes", "Codex の TMPDIR は専用ディレクトリ");
  assert.equal(probe.read_home, "DENIED", "ホーム配下の一般ファイル（別プロジェクトの .env 等を想定）も読めない＝読み取りは原則拒否");
});

sandboxTest("正常終了: レポート保存・除外の記録・一時ディレクトリとロックの削除・未コミット変更は不変・秘密はプロンプトに含まれない", async () => {
  resetState();
  setFake({ verdict: "PASS" });
  const before = porcelain();
  const r = await runScript(["--round", "1", "--skip-checks"]);
  assert.equal(r.code, 0, r.stderr);
  const reports = fs.readdirSync(path.join(repo, "reviews")).filter((f) => f.endsWith("-round1.md"));
  assert.equal(reports.length, 1);
  const md = fs.readFileSync(path.join(repo, "reviews", reports[0]), "utf8");
  assert.match(md, /総合判定: \*\*PASS\*\*/);
  assert.match(md, /除外・対象外の記録/);
  assert.match(md, /src\/link\.ts — シンボリックリンク/);
  assert.match(md, /消費トークン合計: 1234/);
  for (const c of captured()) for (const secret of [JWT, API_KEY_LITERAL, ENV_CANARY, LINK_CANARY]) assert.ok(!c.includes(secret), "Codex に送った内容に秘密がない");
  assert.deepEqual(leftovers(), []);
  assert.ok(!fs.existsSync(path.join(repo, "reviews", ".lock")));
  assert.equal(porcelain(), before, "既存の未コミット変更は不変");
  assert.equal(sh("git", ["check-ignore", "-q", "reviews/x.md"]).status, 0, "reviews/ は gitignore 対象");
});

sandboxTest("異常終了: Codex 失敗(exit 1)・判定不能(VERDICT不正)のとき停止し、一時ディレクトリ・ロックを残さない。ラウンドを消費しない", async () => {
  for (const mode of ["error", "garbage"]) {
    resetState();
    setFake({ mode });
    const r = await runScript(["--round", "1", "--skip-checks"]);
    assert.equal(r.code, 3, mode);
    assert.deepEqual(leftovers(), [], mode + ": 一時ディレクトリが残らない");
    assert.ok(!fs.existsSync(path.join(repo, "reviews", ".lock")), mode + ": ロックが残らない");
    assert.ok(!fs.existsSync(path.join(repo, "reviews", ".state.json")), mode + ": 失敗した監査でラウンドを消費しない");
  }
});

sandboxTest("シグナル終了(SIGTERM): 監査中に中断しても一時ディレクトリとロックを削除する", async () => {
  resetState();
  setFake({ mode: "sleep" });
  const r = await runScript(["--round", "1", "--skip-checks"], { signalAfterProbe: "SIGTERM" });
  assert.equal(r.code, 130);
  assert.deepEqual(leftovers(), []);
  assert.ok(!fs.existsSync(path.join(repo, "reviews", ".lock")));
  setFake({});
});

sandboxTest("ラウンド上限: round 1→2 のみ。3は拒否、順序違反も拒否、上限回避の再実行は --new-cycle なしでは不可", async () => {
  resetState();
  setFake({ verdict: "FAIL" });
  const skip2 = await runScript(["--round", "2", "--skip-checks"]);
  assert.equal(skip2.code, 5, "round 1 なしの round 2 は拒否");
  const r1 = await runScript(["--round", "1", "--skip-checks"]);
  assert.equal(r1.code, 1, "FAIL 判定は exit 1");
  const again = await runScript(["--round", "1", "--skip-checks"]);
  assert.equal(again.code, 5, "round 1 の再実行（回避）は拒否");
  const r2 = await runScript(["--round", "2", "--skip-checks"]);
  assert.equal(r2.code, 1);
  const r3 = await runScript(["--round", "3", "--skip-checks"]);
  assert.equal(r3.code, 5, "3ラウンド目は拒否");
  const again2 = await runScript(["--round", "2", "--skip-checks"]);
  assert.equal(again2.code, 5, "round 2 の再実行も拒否");
  const fresh = await runScript(["--round", "1", "--skip-checks", "--new-cycle"]);
  assert.equal(fresh.code, 1, "人間が --new-cycle で明示したときだけ新サイクル");
  assert.deepEqual(leftovers(), []);
  setFake({});
});

sandboxTest("NEEDS_HUMAN は exit 2、チャンク分割（--chunk-kb 小）で複数回呼ばれ、総合判定は最も重いものになる", async () => {
  resetState();
  setFake({ verdict: "NEEDS_HUMAN" });
  const r = await runScript(["--round", "1", "--skip-checks", "--chunk-kb", "1"]);
  assert.equal(r.code, 2);
  assert.ok(captured().length >= 2, "差分が大きいと分割して監査する: " + captured().length);
  const md = fs.readFileSync(path.join(repo, "reviews", fs.readdirSync(path.join(repo, "reviews")).find((f) => f.endsWith("round1.md"))!), "utf8");
  assert.match(md, /NEEDS_HUMAN/);
  assert.match(md, /切り詰め/, "上限超過で切り詰めた場合は記録され NEEDS_HUMAN になる");
  setFake({});
});

test("基準側（過去のコミット）にあった秘密鍵は、削除・置換した差分でも送らない（削除行の漏えい防止）", async () => {
  resetState();
  const keyBody = `${BEGIN} PRIVATE KEY-----\n${ENV_CANARY}_OLDKEY\n${END} PRIVATE KEY-----\n`;
  write("notes/old-key.txt", "memo\n" + keyBody);
  write("notes/old-key-deleted.txt", keyBody);
  sh("git", ["add", "notes/old-key.txt", "notes/old-key-deleted.txt"]);
  sh("git", ["commit", "-q", "-m", "oops: commit a key"]);
  write("notes/old-key.txt", "memo\nkey removed\n"); // 現在の内容は無害（鍵を削除した差分）
  fs.rmSync(path.join(repo, "notes/old-key-deleted.txt")); // ファイルごと削除
  const r = await runScript(["--round", "1", "--skip-checks", "--dry-run"]);
  assert.equal(r.code, 0, r.stderr);
  const m = JSON.parse(r.stdout);
  assert.ok(!m.promptSample.includes(ENV_CANARY + "_OLDKEY"), "削除行の鍵がプロンプトに含まれない");
  const sent = m.chunks.flatMap((c: { files: string[] }) => c.files);
  assert.ok(!sent.includes("notes/old-key.txt") && !sent.includes("notes/old-key-deleted.txt"));
  const reasons = Object.fromEntries(m.skipped as [string, string][]);
  assert.match(reasons["notes/old-key.txt"], /基準.*秘密鍵/);
  assert.match(reasons["notes/old-key-deleted.txt"], /基準.*秘密鍵/);
});

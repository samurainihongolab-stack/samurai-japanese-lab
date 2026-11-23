#!/usr/bin/env node
// Codex 独立監査ランナー（Claude Code = 実装・修正・テスト / Codex = 読み取り専用の独立監査）
//
// 使い方:
//   node scripts/codex-review.mjs --round 1 [--new-cycle] [--files a,b/] [--context x,y] [--since <rev>] [--skip-checks] [--dry-run]
//
//   --round N      修正サイクル内の監査ラウンド（1..2）。順序と上限を state(reviews/.state.json)で強制する
//   --new-cycle    新しい修正サイクルを開始する（round 1 のとき。前サイクルが残っている場合は必須。人間の明示操作）
//   --files        監査対象を絞る（カンマ区切り。完全一致またはディレクトリ接頭辞）。省略時は変更全体
//   --context      監査対象外だが判断に必要な関連ファイル（呼び出し元・テスト・SQL など）を読み取り専用の文脈として添える
//   --since <rev>  この revision からの差分を対象にする（コミット範囲指定。省略時 HEAD。未コミット変更・新規ファイルは常に含む）
//   --skip-checks  テスト/ビルドを省略（既に通した直後のみ）
//   --dry-run      Codex を呼ばず、送信内容のマニフェスト(JSON)を表示
//
// 終了コード: 0=PASS 1=FAIL 2=NEEDS_HUMAN 3=監査/ツール失敗(停止) 4=テスト/ビルド失敗(停止) 5=ラウンド上限/順序違反
//
// 安全設計（強制している順に）:
//  1. OS サンドボックス(sandbox-exec): Codex プロセスからプロジェクト全体・秘密置き場(~/.ssh 等)の読み取りと、ほぼ全域の書き込みを拒否。
//     ※ Codex 自身の read-only サンドボックスは「書き込み」しか防がず、プロジェクト外の読み取りは防げない（実測済み）。
//       また OS サンドボックス下では Codex 自身のシェルが起動できなくなる（実測: sandbox_apply: Operation not permitted）ため、
//       Codex は「プロンプトに含めた内容だけ」を見る純粋なテキスト監査になる。これが意図した挙動（読み取り範囲を差分に限定）。
//     sandbox-exec が使えない環境では停止する（fail-closed）。
//  2. 入力の選別: .env*・鍵・認証情報・バイナリ・lock・生成物・シンボリックリンク・ROOT 外の実体は送らない。除外は全てレポートに記録。
//  3. マスク: 文字列リテラルの秘密（JWT/各種トークン/KEY="..." 等）と秘密鍵ブロックを置換（best-effort。上の 1・2 が本体の防御）。
//  4. 環境変数は最小限のみ Codex に渡す。Codex は --sandbox read-only / --ephemeral / ChatGPT 認証（API キー不使用）。
//  5. git の状態を変更しない（add/stash/reset/commit/push なし）。一時ディレクトリは正常・異常・シグナル終了で削除（SIGKILL は次回起動時に掃除）。
//  6. 最大2ラウンド。テスト/ビルド/Codex 失敗・判定不能時は停止。PASS はマージ・本番公開の許可ではない。
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const MAX_ROUNDS = 2;
const TMP_PREFIX = "codex-review-";
const git = (cwd, args, o = {}) => run("git", args, { cwd, ...o });

// ───────────── 引数 ─────────────
const args = process.argv.slice(2);
const flag = (k) => args.includes(k);
const opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const list = (k) => (opt(k, "") || "").split(",").map((s) => s.trim()).filter(Boolean);
const round = Number(opt("--round", "1"));
const chunkLimit = Number(opt("--chunk-kb", "70")) * 1024;
const contextLimit = Number(opt("--context-kb", "40")) * 1024;
const dryRun = flag("--dry-run");
const CODEX_BIN = process.env.CODEX_BIN || "codex";

// ───────────── 非同期プロセス実行（シグナルで中断・掃除できるよう spawnSync は使わない）─────────────
let currentChild = null;
function run(cmd, a, { input, cwd, env, timeoutMs = 15 * 60_000 } = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, a, { cwd, env, stdio: ["pipe", "pipe", "pipe"], detached: false });
    currentChild = child;
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);
    child.stdout.on("data", (d) => { if (stdout.length < 64 * 1024 * 1024) stdout += d; });
    child.stderr.on("data", (d) => { if (stderr.length < 8 * 1024 * 1024) stderr += d; });
    child.on("error", (e) => { clearTimeout(timer); resolve({ status: -1, stdout, stderr: stderr + String(e), timedOut }); });
    child.on("close", (status) => { clearTimeout(timer); currentChild = null; resolve({ status, stdout, stderr, timedOut }); });
    if (input !== undefined) child.stdin.end(input);
    else child.stdin.end();
  });
}

// ───────────── 後始末（正常・異常・シグナル）─────────────
let bundle = null; // Codex の作業ディレクトリ（空の一時ディレクトリ）
let lockPath = null;
let cleaned = false;
function cleanup() {
  if (cleaned) return;
  cleaned = true;
  try { if (bundle) fs.rmSync(bundle, { recursive: true, force: true }); } catch {}
  try { if (lockPath && fs.readFileSync(lockPath, "utf8") === String(process.pid)) fs.unlinkSync(lockPath); } catch {}
}
process.on("exit", cleanup);
for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(sig, () => {
    try { currentChild?.kill("SIGKILL"); } catch {}
    cleanup();
    process.exit(130);
  });
}
const log = (...m) => console.error("[codex-review]", ...m); // 進捗は stderr（stdout は dry-run の JSON 専用）
function die(code, msg) {
  console.error("[codex-review] 停止:", msg);
  cleanup();
  process.exit(code);
}

// ───────────── 準備 ─────────────
const top = await git(process.cwd(), ["rev-parse", "--show-toplevel"]);
if (top.status !== 0) die(3, "git リポジトリ内で実行してください");
const ROOT = fs.realpathSync(top.stdout.trim());
const REVIEWS = path.join(ROOT, "reviews");
if (!Number.isInteger(round) || round < 1) die(3, "--round は 1 以上の整数");
if (round > MAX_ROUNDS) die(5, `ラウンド上限(${MAX_ROUNDS})超過。人間の判断が必要です (NEEDS_HUMAN)。`);

// 前回 SIGKILL 等で残った一時ディレクトリを掃除（自分が作った接頭辞のみ・1時間以上前）
try {
  for (const d of fs.readdirSync(os.tmpdir())) {
    if (!d.startsWith(TMP_PREFIX)) continue;
    const p = path.join(os.tmpdir(), d);
    if (Date.now() - fs.lstatSync(p).mtimeMs > 3600_000) fs.rmSync(p, { recursive: true, force: true });
  }
} catch {}

fs.mkdirSync(REVIEWS, { recursive: true });
// reviews/ が git 管理対象外になっていることを確認（コード抜粋入りレポートの誤コミット防止）
const ign = await git(ROOT, ["check-ignore", "-q", "reviews/x.md"]);
if (ign.status !== 0) log("警告: reviews/ が .gitignore に入っていません。コードの抜粋を含むため、必ず追加してください。");

// ロック（同時実行防止）
lockPath = path.join(REVIEWS, ".lock");
try {
  const st = fs.statSync(lockPath);
  if (Date.now() - st.mtimeMs < 3600_000) { lockPath = null; die(3, "別の監査が実行中です (reviews/.lock)。"); }
  fs.unlinkSync(lockPath);
} catch (e) { if (e.code !== "ENOENT") throw e; }
fs.writeFileSync(lockPath, String(process.pid), { flag: "wx" });

// ラウンド状態（上限の強制）
const statePath = path.join(REVIEWS, ".state.json");
let state = { cycle: null, roundsDone: 0 };
try { state = JSON.parse(fs.readFileSync(statePath, "utf8")); } catch {}
if (round === 1) {
  if (state.roundsDone >= 1 && !flag("--new-cycle")) die(5, "前の修正サイクルが残っています。新しいサイクルを始める場合は人間の明示操作として --new-cycle を付けてください（上限回避の再実行は不可）。");
  if (flag("--new-cycle") || !state.cycle) state = { cycle: new Date().toISOString(), roundsDone: 0 };
} else if (state.roundsDone !== round - 1) {
  die(5, `ラウンド順序/上限違反: 完了済み ${state.roundsDone} ラウンド。次は round ${state.roundsDone + 1} のみ実行できます（最大${MAX_ROUNDS}）。`);
}

// ───────────── 1. テスト & ビルド ─────────────
if (!flag("--skip-checks") && !dryRun) {
  for (const [name, cmd] of [["test", ["npm", "test"]], ["build", ["npm", "run", "build"]]]) {
    log(`${name} 実行中…`);
    const r = await run(cmd[0], cmd.slice(1), { cwd: ROOT });
    if (r.status !== 0) {
      console.error((r.stdout || "").slice(-3000), (r.stderr || "").slice(-3000));
      die(4, `${name} が失敗。Codex 監査は実行しません。先に修正してください。`);
    }
    log(`${name} OK`);
  }
}

// ───────────── 2. 対象ファイルの収集 ─────────────
let base = "HEAD";
if (opt("--since")) {
  const rev = opt("--since");
  if (rev.startsWith("-")) die(3, "--since の値が不正");
  const v = await git(ROOT, ["rev-parse", "--verify", "--quiet", rev + "^{commit}"]);
  if (v.status !== 0) die(3, `--since の revision が見つかりません: ${rev}`);
  base = v.stdout.trim();
}
const nul = (s) => s.split("\0").filter(Boolean);
const tracked = nul((await git(ROOT, ["diff", base, "--name-only", "-z"])).stdout);
const untracked = nul((await git(ROOT, ["ls-files", "--others", "--exclude-standard", "-z"])).stdout); // .gitignore 済み(.env* 等)は含まれない
let files = [...new Set([...tracked, ...untracked])].sort();

const focus = list("--files");
for (const f of [...focus, ...list("--context")]) if (path.isAbsolute(f) || f.split("/").includes("..")) die(3, `不正なパス指定: ${f}`);
const inFocus = (f) => !focus.length || focus.some((p) => f === p || f.startsWith(p.endsWith("/") ? p : p + "/"));
const outOfFocus = files.filter((f) => !inFocus(f));
files = files.filter(inFocus);

// 機密・バイナリ・生成物の除外（名前ベース。内容ベースの検査は読み込み時）
const DENY = [
  [/(^|\/)\.env/, "環境変数ファイル(.env*)"],
  [/\.(pem|key|p12|pfx|crt|cer)$/i, "鍵/証明書"],
  [/(^|\/)id_(rsa|ed25519|ecdsa)/, "SSH鍵"],
  [/(^|\/)(\.npmrc|\.netrc|\.pypirc|credentials?(\.\w+)?|secrets?(\.\w+)?)$/i, "認証情報ファイル"],
  [/(^|\/)(node_modules|\.next|\.vercel|\.local-data|preview-out|reviews|\.git)\//, "依存/生成物/ローカルデータ/レポート"],
  [/\.(png|jpe?g|gif|webp|ico|zip|tgz|gz|woff2?|ttf|otf|pdf|mp4|mov)$/i, "バイナリ"],
  [/(^|\/)package-lock\.json$/, "lock ファイル"],
];
const skipped = []; // [path, reason]
const MAX_FILE = 400 * 1024;
const PRIVATE_KEY = /-----BEGIN [A-Z ]*PRIVATE KEY-----/;

/** 安全に読めるファイルだけ返す。シンボリックリンク・ROOT 外の実体・巨大/バイナリ・秘密鍵を含むものは null。 */
function safeRead(rel) {
  const hit = DENY.find(([re]) => re.test(rel));
  if (hit) return { skip: hit[1] };
  const abs = path.join(ROOT, rel);
  let st;
  try { st = fs.lstatSync(abs); } catch { return { skip: "存在しない(削除)" }; }
  if (st.isSymbolicLink()) return { skip: "シンボリックリンク(追跡しない)" };
  if (!st.isFile()) return { skip: "通常ファイルではない" };
  let real;
  try { real = fs.realpathSync(abs); } catch { return { skip: "解決不能" }; }
  if (real !== ROOT && !real.startsWith(ROOT + path.sep)) return { skip: "ROOT 外の実体" };
  if (st.size > MAX_FILE) return { skip: "巨大ファイル(>400KB)" };
  const buf = fs.readFileSync(abs);
  if (buf.includes(0)) return { skip: "バイナリ" };
  const text = buf.toString("utf8");
  if (PRIVATE_KEY.test(text)) return { skip: "秘密鍵ブロックを含む" };
  return { text };
}

// ───────────── 3. マスキング（best-effort。本体の防御は除外とOSサンドボックス）─────────────
let redactions = 0;
const PATTERNS = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, // JWT
  /\b(?:sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[abprs]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{16})\b/g,
  // 文字列リテラルとして直書きされた秘密のみ（式やコードロジックはマスクしない＝監査精度を保つ）
  /((?:KEY|SECRET|TOKEN|PASSWORD|PASSWD|PRIVATE)[A-Z0-9_]*["']?\s*[=:]\s*)(["'`])[A-Za-z0-9_\-+/=.]{12,}\2/gi,
];
function redact(text) {
  let out = text;
  for (const re of PATTERNS) {
    out = out.replace(re, (...m) => {
      redactions++;
      return typeof m[1] === "string" && /[=:]\s*$/.test(m[1]) ? `${m[1]}***REDACTED***` : "***REDACTED***";
    });
  }
  return out;
}

// ───────────── 4. 差分セクションの生成 ─────────────
/** 基準リビジョン側の内容も検査する。差分には削除行（過去の内容）が含まれるため、現在の内容が無害でも過去に秘密鍵があれば送れない。 */
async function baseSkip(f) {
  if (untracked.includes(f)) return null; // 基準に存在しない新規ファイル
  const r = await git(ROOT, ["show", `${base}:${f}`]);
  if (r.status !== 0) return null; // 基準に無い（新規追加）
  if (PRIVATE_KEY.test(r.stdout)) return "基準リビジョン側に秘密鍵ブロックを含む（削除・置換の差分でも送らない）";
  return null;
}

const sections = []; // {file, text}
for (const f of files) {
  const bs = await baseSkip(f);
  if (bs) { skipped.push([f, bs]); continue; }
  const r = safeRead(f);
  if (r.skip) {
    // 削除されたファイルは差分として送る（内容は読まない）
    if (r.skip !== "存在しない(削除)" || untracked.includes(f)) { skipped.push([f, r.skip]); continue; }
    const d = await git(ROOT, ["diff", base, "--no-color", "-U12", "--", f]);
    if (d.stdout) sections.push({ file: f, text: redact(d.stdout) });
    continue;
  }
  const d = untracked.includes(f)
    ? await git(ROOT, ["diff", "--no-index", "--no-color", "--", "/dev/null", f]) // 新規ファイル（status 1 は正常）
    : await git(ROOT, ["diff", base, "--no-color", "-U12", "--", f]); // 変更ファイル: 周辺12行の文脈つき
  if (!d.stdout) continue;
  sections.push({ file: f, text: redact(d.stdout) });
}
if (sections.length === 0) die(3, "監査対象の変更がありません。");

// 関連ファイル（監査対象外の文脈）
let contextText = "";
const contextUsed = [];
for (const f of list("--context")) {
  const r = safeRead(f);
  if (r.skip) { skipped.push([f, "文脈指定だが除外: " + r.skip]); continue; }
  const body = `\n===== CONTEXT(監査対象外・参照のみ): ${f} =====\n${redact(r.text)}\n`;
  if (contextText.length + body.length > contextLimit) { skipped.push([f, "文脈の上限(--context-kb)超過"]); continue; }
  contextText += body;
  contextUsed.push(f);
}

// ───────────── 5. チャンク分割 ─────────────
const chunks = [];
let cur = { files: [], text: "" };
let truncated = false;
for (const s of sections) {
  let t = s.text;
  if (t.length > chunkLimit) {
    t = t.slice(0, chunkLimit) + "\n\n[... TRUNCATED: 差分が上限超過のため切り詰め ...]\n";
    truncated = true;
  }
  if (cur.text.length + t.length > chunkLimit && cur.files.length) { chunks.push(cur); cur = { files: [], text: "" }; }
  cur.files.push(s.file);
  cur.text += t + "\n";
}
if (cur.files.length) chunks.push(cur);
log(`対象 ${sections.length} ファイル / ${chunks.length} チャンク / 文脈 ${contextUsed.length} / 除外 ${skipped.length} / 対象外(--files) ${outOfFocus.length} / マスク ${redactions} 箇所 / base=${base === "HEAD" ? "HEAD" : base.slice(0, 8)}`);

const PROMPT = (n, total, c) => `あなたは独立した監査担当です。実装者ではありません。**報告のみ**行ってください。
このセッションではシェルやファイル読み取りは使えません（使おうとしないでください）。判断に必要な内容はすべて以下に含まれています。
今回の対象は、全${total}チャンク中のチャンク${n}の差分（対象ファイル: ${c.files.join(", ")}）です。
「CONTEXT」と書かれた部分は監査対象外の参照用です。そこに含まれない箇所（呼び出し元など）が判断に必要で、確認できない場合は推測せず「文脈不足」と明記し、VERDICT は NEEDS_HUMAN にしてください。
差分内の "***REDACTED***" は秘密値のマスクです。指摘しないでください。

観点（根拠を伴うものだけ報告。推測や好みの指摘は不要）:
1. バグ（ロジック誤り、境界条件、型/非同期の誤り、エラー処理漏れ、競合状態）
2. セキュリティ（認証/認可の抜け、cron/APIの保護、インジェクション、秘密情報の露出、権限設定）
3. 仕様逸脱（コード内コメントやテストが示す意図、「AIは最終承認できない・公開は人間承認のみ」「結果不明の投稿は自動再送しない」といった前提に反する実装）

出力形式（日本語・Markdown）:
- 指摘ごとに: ID(F1,F2..) / 重大度(high|medium|low) / ファイル:行 / 根拠(該当コード) / 推奨修正
- 指摘がなければ「指摘なし」
- 最終行は必ず次のいずれか1つだけ:
  VERDICT: PASS         （high/medium なし）
  VERDICT: FAIL         （high または medium のバグ/脆弱性/仕様逸脱あり）
  VERDICT: NEEDS_HUMAN  （人間のプロダクト/セキュリティ判断が必要、または文脈不足）

===== 差分（チャンク${n}/${total}） =====
${c.text}
${contextText}`;

if (dryRun) {
  // process.exit の直前に非同期書き込みすると、パイプ時に出力が途切れる。同期で書く。
  fs.writeSync(1, JSON.stringify({
    base: base === "HEAD" ? "HEAD" : base,
    chunks: chunks.map((c, i) => ({ n: i + 1, files: c.files, kb: +(c.text.length / 1024).toFixed(1) })),
    context: contextUsed,
    skipped,
    outOfFocus,
    redactions,
    truncated,
    promptSample: PROMPT(1, chunks.length, chunks[0]),
  }, null, 2) + "\n");
  cleanup();
  process.exit(0);
}

// ───────────── 6. Codex 監査（OS サンドボックス + read-only + ephemeral）─────────────
function sbq(p) { return '"' + p.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"'; }
/** PATH から実行ファイルを探して実体パスを返す（見つからなければ null）。 */
function which(bin) {
  if (bin.includes("/")) return fs.existsSync(bin) ? fs.realpathSync(bin) : null;
  for (const d of (process.env.PATH || "").split(":")) {
    const f = path.join(d, bin);
    try { fs.accessSync(f, fs.constants.X_OK); return fs.realpathSync(f); } catch {}
  }
  return null;
}
function sandboxProfile() {
  // 一時領域は「今回の専用ディレクトリ(bundle)」だけを許可する（os.tmpdir() 全体は他プロセスの一時ファイルを含むため許可しない）。
  const tmp = fs.realpathSync(bundle);
  const codexHome = fs.realpathSync(process.env.CODEX_HOME ? process.env.CODEX_HOME : path.join(os.homedir(), ".codex"));
  // Codex の実行に必要な最小限の読み取り許可: 認証/設定(CODEX_HOME)・一時領域(作業ディレクトリ)・Node/Codex のインストール先
  const nodePrefix = path.dirname(path.dirname(fs.realpathSync(process.execPath)));
  const codexReal = which(CODEX_BIN);
  const codexRoot = codexReal ? path.dirname(codexReal) : null;
  const allowRead = [codexHome, tmp, nodePrefix, codexRoot].filter(Boolean);
  // 読み取りは「原則拒否」: /Users・/Volumes 配下（プロジェクト・他プロジェクトの .env・ホーム内の一般ファイル・秘密置き場すべて）を拒否し、
  // 上の許可リストだけ戻す。ROOT が許可リスト内に入っていたら拒否を優先する（最後に再度 deny）。
  // 共有の一時領域（他アプリ・他セッションの一時ファイルがある）も既定で読み取り拒否。専用ディレクトリだけ上の許可で戻す。
  const tmpDeny = ["/private/tmp", "/private/var/folders", "/private/var/tmp", fs.realpathSync(os.tmpdir())].filter((v, i, a) => a.indexOf(v) === i).map((p) => `(subpath ${sbq(p)})`).join(" ");
  const rd = (ps) => ps.map((p) => `(subpath ${sbq(p)})`).join(" ");
  // Node 等は起動時に実行パスの各親ディレクトリを lstat する。親ディレクトリの「存在確認(メタデータ)」だけを許可し、内容の読み取り・一覧は許可しない。
  const ancestors = new Set();
  for (const a of allowRead) for (let d = path.dirname(a); d !== "/" && d !== "."; d = path.dirname(d)) ancestors.add(d);
  const denied = ["/Users", "/Volumes", "/private/tmp", "/private/var/folders", "/private/var/tmp", fs.realpathSync(os.tmpdir())];
  const meta = [...ancestors].filter((d) => denied.some((x) => d === x || d.startsWith(x + "/"))).map((d) => `(literal ${sbq(d)})`).join(" ");
  const allowWrite = [codexHome, tmp, path.join(fs.realpathSync(os.homedir()), ".cache")].map((p) => `(subpath ${sbq(p)})`).join(" ");
  return `(version 1)
(allow default)
(deny file-read* (subpath "/Users") (subpath "/Volumes") ${tmpDeny})
(allow file-read* ${rd(allowRead)})
${meta ? `(allow file-read-metadata ${meta})` : ""}
(deny file-read* (subpath ${sbq(ROOT)}))
(deny file-write*)
(allow file-write* ${allowWrite} (regex #"^/dev/"))`;
}
if (!fs.existsSync("/usr/bin/sandbox-exec")) die(3, "sandbox-exec が見つかりません。OS サンドボックスなしでは Codex に渡せないため停止します（fail-closed）。");
bundle = fs.mkdtempSync(path.join(os.tmpdir(), TMP_PREFIX)); // 空の作業ディレクトリ（0700）。プロジェクトのコピーは置かない
const profile = sandboxProfile();

// Codex には最小限の環境変数のみ（認証は ~/.codex の ChatGPT ログイン。API キーは渡さない）
const keep = ["PATH", "HOME", "USER", "SHELL", "LANG", "LC_ALL", "TMPDIR", "TERM", "CODEX_HOME"];
const env = Object.fromEntries(keep.filter((k) => process.env[k]).map((k) => [k, process.env[k]]));
env.TMPDIR = bundle; // Codex の一時ファイルも専用ディレクトリ内に閉じる（共有の一時領域は読み書き不可）

const results = [];
let tokensTotal = 0;
const started = Date.now();
for (const [i, c] of chunks.entries()) {
  const n = i + 1;
  const outFile = path.join(bundle, `result-${n}.md`);
  log(`Codex 監査 chunk ${n}/${chunks.length} …`);
  const r = await run(
    "/usr/bin/sandbox-exec",
    ["-p", profile, CODEX_BIN, "exec", "--sandbox", "read-only", "--skip-git-repo-check", "--ephemeral", "-C", bundle, "--output-last-message", outFile, "-"],
    { input: PROMPT(n, chunks.length, c), env, cwd: bundle },
  );
  if (r.status !== 0 || !fs.existsSync(outFile)) {
    console.error((r.stderr || "").slice(-1500));
    die(3, `Codex 実行失敗 (chunk ${n}, status=${r.status}${r.timedOut ? ", timeout" : ""})。監査未完了のため停止。`);
  }
  const tk = /tokens used\s*\n?\s*([\d,]+)/i.exec((r.stdout || "") + (r.stderr || ""));
  const tokens = tk ? Number(tk[1].replace(/,/g, "")) : null;
  if (tokens) tokensTotal += tokens;
  const body = fs.readFileSync(outFile, "utf8").trim();
  const v = [...body.matchAll(/^VERDICT:\s*(PASS|FAIL|NEEDS_HUMAN)\s*$/gm)].pop();
  if (!v) die(3, `chunk ${n}: VERDICT 行を解釈できません（監査結果不正）。停止。`);
  results.push({ n, files: c.files, verdict: v[1], body, tokens });
}
const seconds = Math.round((Date.now() - started) / 1000);

// ───────────── 7. 判定と保存 ─────────────
let overall = "PASS";
if (results.some((r) => r.verdict === "FAIL")) overall = "FAIL";
else if (results.some((r) => r.verdict === "NEEDS_HUMAN") || truncated) overall = "NEEDS_HUMAN";

const branch = (await git(ROOT, ["branch", "--show-current"])).stdout.trim();
const head = (await git(ROOT, ["rev-parse", "--short", "HEAD"])).stdout.trim();
const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..*/, "").replace("T", "-");
const reportPath = path.join(REVIEWS, `${stamp}-round${round}.md`);
const md = `# Codex 独立監査レポート（round ${round}/${MAX_ROUNDS}）

- 総合判定: **${overall}**
- サイクル: ${state.cycle} / 実行: ${new Date().toISOString()} / ブランチ: ${branch} / HEAD: ${head}
- 対象: 差分の基準 ${base === "HEAD" ? "HEAD" : base.slice(0, 8)}（未コミット変更 + 新規ファイルを含む）${focus.length ? " / 絞り込み: " + focus.join(", ") : ""}
- 監査ファイル ${sections.length} 件 / ${chunks.length} チャンク / 参照文脈 ${contextUsed.length} 件${contextUsed.length ? "（" + contextUsed.join(", ") + "）" : ""}
- Codex: 読み取り専用 (sandbox=read-only, ephemeral) + OS サンドボックス(読み取りは原則拒否・許可リスト方式) / 消費トークン合計: ${tokensTotal || "不明"} / 所要: ${seconds}秒
- マスクした秘密様文字列: ${redactions} 箇所${truncated ? "\n- ⚠️ 上限超過で切り詰めた差分あり → NEEDS_HUMAN" : ""}

> **注意**: この判定は AI によるものです。PASS でもマージ・本番公開の許可ではありません。公開は人間の承認が必要です。
> 指摘は Claude Code が根拠を検証してから修正します（鵜呑みにしない）。

## チャンク別判定
${results.map((r) => `- chunk ${r.n}: **${r.verdict}** (${r.files.length} files, tokens ${r.tokens ?? "?"})`).join("\n")}

## 除外・対象外の記録
${skipped.length ? skipped.map(([f, why]) => `- ${f} — ${why}`).join("\n") : "- 除外ファイルなし"}
${outOfFocus.length ? `- 対象外(--files で絞り込み) ${outOfFocus.length} 件: ${outOfFocus.slice(0, 100).join(", ")}${outOfFocus.length > 100 ? " …" : ""}` : ""}

${results.map((r) => `## chunk ${r.n} 詳細\n対象: ${r.files.join(", ")}\n\n${r.body}\n`).join("\n")}
`;
fs.writeFileSync(reportPath, md);
fs.writeFileSync(statePath, JSON.stringify({ cycle: state.cycle, roundsDone: round, last: path.basename(reportPath), verdict: overall }, null, 2));
log(`総合判定: ${overall} / 保存: ${path.relative(ROOT, reportPath)} / tokens: ${tokensTotal || "不明"} / ${seconds}秒`);
cleanup();
process.exit({ PASS: 0, FAIL: 1, NEEDS_HUMAN: 2 }[overall]);

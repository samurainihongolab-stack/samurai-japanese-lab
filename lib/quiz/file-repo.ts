import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { AuditEntry, Platform, PostAttempt, PostLog, QuizQuestion, QuizReview } from "./types";
import { withInvalidation } from "./hash";
import { applyResult, decideClaim, nextGeneration, type ClaimConfig, type PostResult } from "./postlog";
import { isPubliclyVisible } from "./validate";
import type { ClaimResult, QuizRepository } from "./repository";

interface Store {
  questions: QuizQuestion[];
  post_logs: PostLog[];
  attempts: PostAttempt[];
  reviews?: QuizReview[];
  audit?: AuditEntry[];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function processAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === "EPERM"; // 権限がなくても存在はする
  }
}

/** ローカル検証用のJSONファイルストア。ディレクトリロックでプロセス間・並行呼び出しを直列化する。 */
export class FileQuizRepository implements QuizRepository {
  readonly backend = "file" as const;
  constructor(private file: string) {}

  private async withLock<T>(fn: () => Promise<T>): Promise<T> {
    const lock = this.file + ".lock";
    const ownerFile = path.join(lock, "owner");
    const token = `${process.pid}:${randomUUID()}`; // 所有者トークン。自分のロックだけを解放する
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    for (let i = 0; ; i++) {
      try {
        await fs.mkdir(lock);
        await fs.writeFile(ownerFile, token);
        break;
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
        // 経過時間だけでは奪わない。「所有プロセスが存在しない」場合だけ放棄ロックとして回収する
        // （所有者の記録が無いロックは、作成直後でないこと=10秒超過を条件にする）。
        const owner = await fs.readFile(ownerFile, "utf8").catch(() => null);
        const st = await fs.stat(lock).catch(() => null);
        const pid = owner ? Number(owner.split(":")[0]) : NaN;
        const dead = owner ? !Number.isInteger(pid) || !processAlive(pid) : !!st && Date.now() - st.mtimeMs > 10_000;
        if (st && dead) {
          // 回収は「確認した所有者のままである」場合に限る（別の新しい所有者のロックを消さない）
          const again = await fs.readFile(ownerFile, "utf8").catch(() => null);
          if (again === owner) await fs.rm(lock, { recursive: true, force: true }).catch(() => {});
        } else if (i > 2000) throw new Error("store lock timeout");
        else await sleep(15);
      }
    }
    try {
      return await fn();
    } finally {
      const cur = await fs.readFile(ownerFile, "utf8").catch(() => null);
      if (cur === token) await fs.rm(lock, { recursive: true, force: true }).catch(() => {}); // 他者に奪われていたら何もしない
    }
  }

  private async read(): Promise<Store> {
    let raw: string;
    try {
      raw = await fs.readFile(this.file, "utf8");
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return { questions: [], post_logs: [], attempts: [] };
      throw e; // 権限エラー等は「空」ではなく障害として扱う
    }
    return JSON.parse(raw) as Store; // 破損JSONは例外（空と誤認して上書きしない）
  }
  private async write(s: Store) {
    const tmp = this.file + ".tmp";
    await fs.writeFile(tmp, JSON.stringify(s, null, 2));
    await fs.rename(tmp, this.file);
  }

  async listQuestions() {
    return (await this.read()).questions;
  }
  async getQuestion(id: string) {
    return (await this.read()).questions.find((q) => q.id === id) ?? null;
  }
  async getPublicBySlug(slug: string, now = new Date()) {
    return (await this.read()).questions.find((q) => q.slug === slug && isPubliclyVisible(q, now)) ?? null;
  }
  async listPublic(now = new Date()) {
    return (await this.read()).questions
      .filter((q) => isPubliclyVisible(q, now))
      .sort((a, b) => (a.scheduled_at! < b.scheduled_at! ? 1 : -1));
  }
  insertIfAbsent(questions: QuizQuestion[]) {
    return this.withLock(async () => {
      const s = await this.read();
      let n = 0;
      for (const q of questions) {
        if (s.questions.some((x) => x.id === q.id || x.slug === q.slug)) continue;
        s.questions.push(q);
        n++;
      }
      await this.write(s);
      return n;
    });
  }
  updateQuestion(id: string, patch: Partial<QuizQuestion>) {
    return this.withLock(async () => {
      const s = await this.read();
      const i = s.questions.findIndex((q) => q.id === id);
      if (i < 0) throw new Error(`question not found: ${id}`);
      s.questions[i] = { ...s.questions[i], ...withInvalidation(s.questions[i], patch), updated_at: new Date().toISOString() };
      await this.write(s);
      return s.questions[i];
    });
  }
  async ping() {
    await this.read();
  }
  addReview(r: QuizReview) {
    return this.withLock(async () => {
      const s = await this.read();
      (s.reviews ??= []).push(r);
      await this.write(s);
    });
  }
  async listReviews(questionId?: string) {
    const r = (await this.read()).reviews ?? [];
    return questionId ? r.filter((x) => x.question_id === questionId) : r;
  }
  addAudit(a: AuditEntry) {
    return this.withLock(async () => {
      const s = await this.read();
      (s.audit ??= []).push(a);
      await this.write(s);
    });
  }
  async listAudit(limit = 100) {
    return ((await this.read()).audit ?? []).slice(-limit).reverse();
  }
  async listPostLogs(questionId?: string) {
    const s = await this.read();
    return questionId ? s.post_logs.filter((l) => l.question_id === questionId) : s.post_logs;
  }
  async listAttempts(questionId?: string) {
    const s = await this.read();
    return questionId ? s.attempts.filter((a) => a.question_id === questionId) : s.attempts;
  }
  claimPost(questionId: string, platform: Platform, now: Date, cfg: ClaimConfig): Promise<ClaimResult> {
    return this.withLock(async () => {
      const s = await this.read();
      const existing = s.post_logs.find((l) => l.question_id === questionId && l.platform === platform) ?? null;
      const d = decideClaim(existing, now, cfg);
      if (d.action === "skip") return { action: "skip", reason: d.reason, log: existing! };
      const ts = now.toISOString();
      let log: PostLog;
      if (!existing) {
        log = { id: randomUUID(), question_id: questionId, platform, status: "sending", attempts: 0, external_id: null, external_url: null, last_error: null, lease_until: null, posted_at: null, next_retry_at: null, created_at: ts, updated_at: ts, ...d.patch };
        s.post_logs.push(log);
      } else {
        log = Object.assign(existing, d.patch, { updated_at: nextGeneration(existing.updated_at, now) });
      }
      await this.write(s);
      return { action: d.action, log: { ...log } };
    });
  }
  requeueFailed(questionId: string, platform: Platform) {
    return this.withLock(async () => {
      const s = await this.read();
      const l = s.post_logs.find((x) => x.question_id === questionId && x.platform === platform);
      if (!l || l.status !== "failed") return false;
      l.next_retry_at = null;
      l.attempts = Math.min(l.attempts, 1);
      l.updated_at = nextGeneration(l.updated_at, new Date());
      await this.write(s);
      return true;
    });
  }
  recordResult(log: PostLog, result: PostResult, now: Date, cfg: ClaimConfig, audit?: AuditEntry) {
    return this.withLock(async () => {
      const s = await this.read();
      const cur = s.post_logs.find((l) => l.id === log.id);
      if (!cur) throw new Error("post log not found");
      // 世代照合(CAS): 結果は「確保/確認した時点の状態」に対してのみ適用する。その後に別の操作（手動解決・再確保・再送）で
      // 状態が進んでいたら、遅れて届いた結果は適用しない。確定済み(succeeded)は終端状態として巻き戻さない。
      if (cur.updated_at !== log.updated_at) return { ...cur };
      if (cur.status === "succeeded" && result.type !== "succeeded" && result.type !== "reconciled_found") return { ...cur };
      const { patch, attempt } = applyResult(cur, result, now, cfg, randomUUID);
      Object.assign(cur, patch, { updated_at: nextGeneration(cur.updated_at, now) });
      s.attempts.push(attempt);
      if (audit) (s.audit ??= []).push(audit);
      await this.write(s);
      return { ...cur };
    });
  }
}

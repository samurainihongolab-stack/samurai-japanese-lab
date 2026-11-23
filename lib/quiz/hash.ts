import { createHash } from "node:crypto";
import { CHOICE_KEYS, type QuizQuestion } from "./types";

export const CONTENT_FIELDS = ["question", "choices", "correct_answer", "explanation"] as const;

/** 承認対象コンテンツ（問題文・選択肢・正答・解説）の正規化ハッシュ。順序・空白差で揺れないよう正規化する。 */
export function contentHash(q: Pick<QuizQuestion, "question" | "choices" | "correct_answer" | "explanation">): string {
  const canonical = JSON.stringify({
    question: q.question,
    choices: CHOICE_KEYS.map((k) => [k, q.choices[k]]),
    correct_answer: q.correct_answer,
    explanation: q.explanation,
  });
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

/**
 * 承認後にコンテンツが変わったら承認を無効化する（リポジトリ層で強制。DB側にも同等のトリガーあり）。
 * draft 以外の問題の本文が変わる更新は、status を draft に戻し承認・公開情報をクリアする。
 */
export function withInvalidation(old: QuizQuestion, patch: Partial<QuizQuestion>): Partial<QuizQuestion> {
  const next = { ...old, ...patch };
  if (old.status !== "draft" && contentHash(next) !== contentHash(old)) {
    return {
      ...patch,
      status: "draft",
      approved_by: null,
      approved_by_email: null,
      approved_at: null,
      content_hash: null,
      published_at: null,
      scheduled_at: null,
    };
  }
  return patch;
}

import type { QuizQuestion } from "../types";
import { FOOTER, HEADER, answerUrl, questionBlock, type SnsContent } from "./common";

export const THREADS_LIMIT = 500;

export function buildThreadsPost(q: QuizQuestion): SnsContent {
  const text = [HEADER, "", questionBlock(q), "", "あなたはどれを選びますか？コメントで教えてください👇", FOOTER, answerUrl(q)].join("\n");
  const length = [...text].length;
  if (length > THREADS_LIMIT) throw new Error(`Threads 文字数超過: ${length}/${THREADS_LIMIT}`);
  return { text, meta: { length, limit: THREADS_LIMIT } };
}

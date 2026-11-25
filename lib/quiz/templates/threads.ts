import type { QuizQuestion } from "../types";
import { answerUrl, textPostBody, type SnsContent } from "./common";

export const THREADS_LIMIT = 500;

export function buildThreadsPost(q: QuizQuestion): SnsContent {
  const text = `${textPostBody(q)}\n${answerUrl(q)}`;
  const length = [...text].length;
  if (length > THREADS_LIMIT) throw new Error(`Threads 文字数超過: ${length}/${THREADS_LIMIT}`);
  return { text, meta: { length, limit: THREADS_LIMIT } };
}

import { CHOICE_KEYS, type QuizQuestion } from "../types";

export const HEADER = "【今日の日本語教員試験クイズ】";
export const FOOTER = "正解と解説は公式サイトで📚";

/** 公開サイトのオリジン。実投稿では https の本番ドメインが必須（SNS_LIVE 時に検証）。 */
export function siteOrigin(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/+$/, "");
}
export const answerUrl = (q: Pick<QuizQuestion, "slug">) => `${siteOrigin()}/quiz/${q.slug}`;
export const choiceNumber = (key: QuizQuestion["correct_answer"]) => CHOICE_KEYS.indexOf(key) + 1;

/** 問題本体（連番・内部ID・正答を含まない）。全媒体で単一データから生成する。 */
export function questionBlock(q: QuizQuestion): string {
  return [q.question, "", ...CHOICE_KEYS.map((k) => `${choiceNumber(k)}．${q.choices[k]}`)].join("\n");
}

export const textPostBody = (q: QuizQuestion) => [HEADER, "", questionBlock(q), "", FOOTER].join("\n");

export interface SnsContent {
  text: string;
  /** 検証メモ（文字数など） */
  meta: Record<string, number | string>;
}

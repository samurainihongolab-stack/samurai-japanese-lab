import type { QuizQuestion } from "../types";
import { HEADER, type SnsContent } from "./common";

export const IG_CAPTION_LIMIT = 2200;
export const IG_MAX_HASHTAGS = 30;
const HASHTAGS = ["#日本語教員試験", "#登録日本語教員", "#日本語教師", "#日本語教育", "#侍日本語ラボ"];

/** キャプション内URLはクリック不可のため、プロフィールのリンクへ誘導する。正答は含めない。 */
export function buildInstagramCaption(q: QuizQuestion): SnsContent {
  const text = [
    HEADER,
    "",
    q.question,
    "",
    "答えは何だと思いますか？コメントで教えてください👇",
    "",
    "正解と詳しい解説は、プロフィールのリンクから公式サイトでチェック📚",
    "",
    HASHTAGS.join(" "),
  ].join("\n");
  const length = [...text].length;
  if (length > IG_CAPTION_LIMIT) throw new Error(`Instagram キャプション超過: ${length}`);
  if (HASHTAGS.length > IG_MAX_HASHTAGS) throw new Error("ハッシュタグ過多");
  if (/https?:\/\//.test(text)) throw new Error("キャプションにURLを含めない");
  return { text, meta: { length, limit: IG_CAPTION_LIMIT } };
}

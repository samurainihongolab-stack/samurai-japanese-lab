import type { QuizQuestion } from "../types";
import { FOOTER, HEADER, answerUrl, questionBlock, type SnsContent } from "./common";

export const X_LIMIT = 280;
const URL_WEIGHT = 23; // t.co 短縮後の固定長

/** X の加重文字数（twitter-text 準拠: 日本語等は1文字=2、URLは一律23）。 */
export function xWeightedLength(textWithoutUrl: string, urlCount: number): number {
  let n = 0;
  for (const ch of textWithoutUrl) {
    const c = ch.codePointAt(0)!;
    const light = c <= 4351 || (c >= 8192 && c <= 8205) || (c >= 8208 && c <= 8223) || (c >= 8242 && c <= 8247);
    n += light ? 1 : 2;
  }
  return n + urlCount * URL_WEIGHT;
}

export function buildXPost(q: QuizQuestion): SnsContent {
  const body = [HEADER, "", questionBlock(q), "", FOOTER].join("\n");
  const text = `${body}\n${answerUrl(q)}`;
  const weighted = xWeightedLength(body + "\n", 1);
  if (weighted > X_LIMIT) throw new Error(`X 文字数超過: ${weighted}/${X_LIMIT}`);
  return { text, meta: { weighted, limit: X_LIMIT } };
}

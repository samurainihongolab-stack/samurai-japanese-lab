// 投稿照合（lookup）の一致判定。「見つからない」ことは「未投稿」の証明ではない（取得範囲が限られるため）。
// ここは「見つかった投稿が、確かにこの問題のものか」を厳密に判定する純粋関数。

/** 媒体から観測した投稿。urls は X の entities.urls[].expanded_url など、媒体が展開した URL。 */
export interface Observed {
  text?: string | null;
  urls?: (string | null | undefined)[];
}

export interface MatchTarget {
  marker: string;
  /** url: 解答ページURL（slug 単位で一意）。text: 投稿本文の全文一致（URL を載せられない Instagram 用）。 */
  matchKind: "url" | "text";
}

const norm = (s: string) => s.replace(/\r\n?/g, "\n").split("\n").map((l) => l.trimEnd()).join("\n").trim();
const SLUG_CHAR = /[A-Za-z0-9_-]/;

/** text の中に url が「境界つき」で含まれるか。slug が前方一致するだけの別問題（…-k7m2 と …-k7m2-extra）は別物。 */
export function urlInText(text: string, url: string): boolean {
  let from = 0;
  for (;;) {
    const i = text.indexOf(url, from);
    if (i < 0) return false;
    const next = text[i + url.length];
    if (next === undefined || !SLUG_CHAR.test(next)) return true;
    from = i + 1;
  }
}

export function matchesContent(c: MatchTarget, o: Observed): boolean {
  if (c.matchKind === "text") return !!o.text && norm(o.text) === norm(c.marker);
  const candidates = [o.text, ...(o.urls ?? [])].filter((x): x is string => typeof x === "string" && x.length > 0);
  return candidates.some((t) => urlInText(t, c.marker));
}

export { norm as normalizeText };

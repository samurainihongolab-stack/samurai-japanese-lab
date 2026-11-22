// サイト共通設定。URLは環境変数で上書きできる（未設定なら正式URLの既定値を使う）。
// Amazon商品URLは正式な商品ページが確定するまで、検索リンクのままにする。
const clean = (v?: string) => (v && v.trim().length > 0 ? v.trim() : "");

export const SITE = {
  name: "侍日本語ラボ",
  instagram: clean(process.env.NEXT_PUBLIC_INSTAGRAM_URL) || "https://instagram.com/samurai.nihongo.lab",
  x: clean(process.env.NEXT_PUBLIC_X_URL) || "https://x.com/samurai_nihongo",
  threads: clean(process.env.NEXT_PUBLIC_THREADS_URL) || "https://threads.net/@samurai.nihongo.lab",
  // 壱ノ巻の正式なAmazon商品URL。未設定の間は、Amazonの検索結果へ誘導する。
  amazonBook1:
    clean(process.env.NEXT_PUBLIC_AMAZON_BOOK1_URL) ||
    "https://www.amazon.co.jp/s?k=" + encodeURIComponent("侍日本語ラボ 応用試験"),
};

export const SOCIAL_LINKS = [
  { key: "x", label: "X", icon: "𝕏", url: SITE.x },
  { key: "instagram", label: "Instagram", icon: "◎", url: SITE.instagram },
  { key: "threads", label: "Threads", icon: "＠", url: SITE.threads },
].filter((s) => s.url);

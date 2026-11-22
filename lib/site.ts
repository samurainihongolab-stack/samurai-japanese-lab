// サイト共通設定。URLは環境変数で上書きでき、未設定のSNS・Amazonは表示しない。
// 正式URLが確認できるまで、X・Threads・Amazon商品URLは空のままにする。
const clean = (v?: string) => (v && v.trim().length > 0 ? v.trim() : "");

export const SITE = {
  name: "侍日本語ラボ",
  instagram: clean(process.env.NEXT_PUBLIC_INSTAGRAM_URL) || "https://www.instagram.com/samurai.nihongo.lab/",
  x: clean(process.env.NEXT_PUBLIC_X_URL),
  threads: clean(process.env.NEXT_PUBLIC_THREADS_URL),
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

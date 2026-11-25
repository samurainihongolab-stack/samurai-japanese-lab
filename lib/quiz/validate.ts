import { CHOICE_KEYS, type QuizQuestion } from "./types";

export interface Issue {
  level: "error" | "warning";
  message: string;
}

const base = (s: string) => s.replace(/[（(].*?[）)]/g, "").trim();
const paren = (s: string) => s.match(/[（(](.*?)[）)]/)?.[1]?.trim();

/** 選択肢が解説中で言及される位置（言及なしは -1）。 */
function mentionIndex(choice: string, explanation: string): number {
  const terms = [choice, base(choice), paren(choice)].filter((t): t is string => !!t && t.length >= 2);
  const idx = terms.map((t) => explanation.indexOf(t)).filter((i) => i >= 0);
  return idx.length ? Math.min(...idx) : -1;
}

/** 問題データの整合性検査。error があれば承認・公開不可。専門内容の正誤は人間が判断する。 */
export function validateQuestion(q: QuizQuestion): Issue[] {
  const issues: Issue[] = [];
  const err = (message: string) => issues.push({ level: "error", message });
  const warn = (message: string) => issues.push({ level: "warning", message });

  if (!q.question.trim()) err("問題文が空です");
  if (!q.explanation.trim()) err("解説が空です");
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(q.slug)) err("slug は英小文字・数字・ハイフンのみ");
  if (/^q?\d+$/i.test(q.slug) || /(^|-)\d{1,3}(-|$)/.test(q.slug)) warn("slug が連番を連想させます");

  const keys = Object.keys(q.choices);
  if (keys.length !== 4 || !CHOICE_KEYS.every((k) => keys.includes(k))) err("選択肢は A〜D の4つ");
  const texts = CHOICE_KEYS.map((k) => (q.choices[k] ?? "").trim());
  if (texts.some((t) => !t)) err("空の選択肢があります");
  if (new Set(texts).size !== texts.length) err("選択肢に重複があります（正答が一意になりません）");
  if (!CHOICE_KEYS.includes(q.correct_answer)) err("正答は A〜D のいずれか");

  // 解説との一致（ヒューリスティック）: 正答の語が解説に出て、他の選択肢より先に言及されること。
  if (CHOICE_KEYS.includes(q.correct_answer) && q.explanation) {
    const pos = Object.fromEntries(
      CHOICE_KEYS.map((k) => [k, mentionIndex(q.choices[k] ?? "", q.explanation)]),
    ) as Record<string, number>;
    if (pos[q.correct_answer] < 0) err("解説に正答の語が含まれていません（正答と解説の不一致の疑い）");
    else {
      const earlier = CHOICE_KEYS.filter((k) => k !== q.correct_answer && pos[k] >= 0 && pos[k] < pos[q.correct_answer]);
      if (earlier.length) warn(`解説で誤答 ${earlier.join(",")} の語が正答より先に出ています。人間が確認してください`);
    }
  }
  return issues;
}

export const hasErrors = (issues: Issue[]) => issues.some((i) => i.level === "error");

/** 公開条件: published かつ予約時刻到達。HP・RLS と同じ判定。 */
export function isPubliclyVisible(q: Pick<QuizQuestion, "status" | "scheduled_at">, now = new Date()): boolean {
  return q.status === "published" && !!q.scheduled_at && new Date(q.scheduled_at).getTime() <= now.getTime();
}

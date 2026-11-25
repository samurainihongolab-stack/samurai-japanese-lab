import type { QuizQuestion } from "./types";

/** MVP検証用の4問（ユーザー提供の本文を一字一句そのまま使用）。すべて draft で登録し、承認は人間が行う。 */
type Seed = Pick<
  QuizQuestion,
  "id" | "slug" | "category" | "question" | "choices" | "correct_answer" | "explanation" | "difficulty"
>;

export const SEED_QUESTIONS: Seed[] = [
  {
    id: "q001",
    slug: "noticing-hypothesis-k7m2",
    category: "第二言語習得",
    question: "学習者が自分の発話と目標言語との違いに気づくことを重視する仮説はどれ？",
    choices: { A: "インプット仮説", B: "気づき仮説", C: "情意フィルター仮説", D: "モニター仮説" },
    correct_answer: "B",
    explanation:
      "シュミットの気づき仮説は、学習者が言語形式に意識的に気づくことが第二言語習得に重要な役割を果たすと考える。",
    difficulty: "中級",
  },
  {
    id: "q002",
    slug: "tblt-basics-p4x9",
    category: "教授法",
    question: "タスクの達成を中心に授業を組み立てる教授法はどれ？",
    choices: {
      A: "オーディオ・リンガル・メソッド",
      B: "文法訳読法",
      C: "タスク中心の言語教授法（TBLT）",
      D: "直接法",
    },
    correct_answer: "C",
    explanation: "TBLTは、意味のあるタスクの遂行を学習活動の中心に据える教授法である。",
    difficulty: "初級",
  },
  {
    id: "q003",
    slug: "test-reliability-r8w3",
    category: "評価",
    question:
      "同じ受験者が、同程度の条件で繰り返し受験したとき、得点が安定していることに最も関係する評価の性質はどれ？",
    choices: { A: "妥当性", B: "信頼性", C: "真正性", D: "波及効果" },
    correct_answer: "B",
    explanation:
      "信頼性は測定結果の一貫性や安定性を指す。妥当性は、得点の解釈や利用が目的に照らして適切かどうかに関係する。",
    difficulty: "中級",
  },
  {
    id: "q004",
    slug: "focus-on-form-t6n5",
    category: "授業設計",
    question:
      "学習者が意味の伝達を主に行う活動中、教師が必要に応じて言語形式へ注意を向けさせる指導はどれ？",
    choices: {
      A: "フォーカス・オン・フォームズ",
      B: "フォーカス・オン・フォーム",
      C: "文法訳読法",
      D: "機械的ドリル",
    },
    correct_answer: "B",
    explanation:
      "フォーカス・オン・フォームは、意味中心のコミュニケーション活動の中で、必要に応じて言語形式へ注意を向ける指導である。",
    difficulty: "上級",
  },
];

export function seedToQuestions(now = new Date()): QuizQuestion[] {
  const ts = now.toISOString();
  return SEED_QUESTIONS.map((s) => ({
    ...s,
    status: "draft" as const,
    scheduled_at: null,
    published_at: null,
    reviewed_by: null,
    approved_by: null,
    approved_at: null,
    approved_by_email: null,
    content_hash: null,
    created_at: ts,
    updated_at: ts,
  }));
}

import { createClient } from "@supabase/supabase-js";

const scheduledAt = Date.parse("2026-11-24T11:37:00+09:00");
const launchQuiz = {
  slug: "formative-assessment",
  question: "教師は作文の初稿を読み、理由が伝わりにくい箇所にコメントを付けた。学習者はそのコメントをもとに作文を書き直した。\n\nこの評価はどれ？",
  choices: { A: "診断的評価", B: "総括的評価", C: "形成的評価", D: "プレースメント評価" },
  category: "評価・テスト",
  difficulty: "初級",
  correct_answer: "C" as const,
  explanation: [
    "C．形成的評価",
    "判断の決め手は、評価の結果を次の学習に生かしていることです。教師のコメントが、学習者にとって作文をどう直すか考える手がかりになっています。",
    "A．診断的評価は、指導を考えるために、学習者が何を理解していて、どこでつまずいているかを把握する評価です。",
    "B．総括的評価は、単元末などに、学習目標にどこまで到達したかをまとめて判断する評価です。",
    "D．プレースメント評価は、学習者に合うクラスやレベルを決めるための評価です。",
    "試験での見分け方",
    "「いつ評価したか」と「結果を何に使ったか」を確認します。同じ小テストでも、結果をもとに次の授業で復習するなら形成的評価として機能し、単元の到達度をまとめて判定するなら総括的評価として機能します。",
  ].join("\n\n"),
};

function quizQuestions() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Public quiz data source is unavailable");

  return createClient(url, key, { auth: { persistSession: false } })
    .from("quiz_questions");
}

export async function loadDailyAnswer(now: Date) {
  const japanTime = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const midnight = new Date(japanTime.toISOString().slice(0, 10) + "T00:00:00+09:00");
  if (now.getTime() >= scheduledAt && midnight.getTime() <= scheduledAt) {
    const { correct_answer, explanation } = launchQuiz;
    return { ok: true, answer: { correct_answer, explanation } };
  }
  try {
    const { data, error } = await quizQuestions()
      .select("correct_answer,explanation")
      .eq("status", "published")
      .lte("scheduled_at", now.toISOString())
      .gte("published_at", midnight.toISOString())
      .lte("published_at", now.toISOString())
      .order("published_at", { ascending: false })
      .order("slug")
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return { ok: true, answer: data };
  } catch {
    console.error("[quiz] Could not read today's published answer");
    return { ok: false, answer: null };
  }
}

export async function loadPublicOne(slug: string) {
  const now = new Date();
  if (slug === launchQuiz.slug) {
    return { ok: true, question: now.getTime() >= scheduledAt ? launchQuiz : null };
  }
  try {
    const { data, error } = await quizQuestions()
      .select("category,difficulty,question,choices,correct_answer,explanation")
      .eq("slug", slug)
      .eq("status", "published")
      .lte("scheduled_at", now.toISOString())
      .lte("published_at", now.toISOString())
      .maybeSingle();
    if (error) throw error;
    return { ok: true, question: data };
  } catch {
    console.error("[quiz] Could not read the published answer");
    return { ok: false, question: null };
  }
}

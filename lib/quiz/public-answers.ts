import { createClient } from "@supabase/supabase-js";

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

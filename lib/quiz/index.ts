import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { FileQuizRepository } from "./file-repo";
import { SupabaseQuizRepository } from "./supabase-repo";
import type { QuizRepository } from "./repository";

let cached: QuizRepository | null = null;

/**
 * 既定はローカルのファイルストア。QUIZ_BACKEND=supabase を明示した時だけ Supabase を使う
 * （.env.local の demo URL を誤って使わないため）。Vercel 上でファイルストアは使えない。
 */
export function getRepository(): QuizRepository {
  if (cached) return cached;
  if (process.env.QUIZ_BACKEND === "supabase") {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const svc = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !anon || !svc) throw new Error("QUIZ_BACKEND=supabase requires Supabase env vars");
    cached = new SupabaseQuizRepository(createClient(url, svc, { auth: { persistSession: false } }), createClient(url, anon, { auth: { persistSession: false } }));
  } else {
    if (process.env.VERCEL) throw new Error("file backend is not available on Vercel; set QUIZ_BACKEND=supabase");
    cached = new FileQuizRepository(process.env.QUIZ_STORE_FILE || path.join(process.cwd(), ".local-data", "quiz-store.json"));
  }
  return cached;
}
export { FileQuizRepository };

/** テスト用: キャッシュ済みリポジトリを破棄する。 */
export function resetRepositoryForTests() {
  cached = null;
}

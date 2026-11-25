import { getRepository } from ".";
import type { QuizQuestion } from "./types";

/**
 * 公開ページ用の読み取り。DB未接続・障害でも例外を投げず、サーバーログに記録して ok=false を返す。
 * （ページは 500 にならず、管理画面側の /api/admin/quiz が 503 で障害を明示する）
 */
export async function loadPublicList(): Promise<{ ok: boolean; questions: QuizQuestion[] }> {
  try {
    return { ok: true, questions: await getRepository().listPublic() };
  } catch (e) {
    console.error("[quiz] 公開問題の取得に失敗（空データではなく接続/設定エラー）:", (e as Error).message);
    return { ok: false, questions: [] };
  }
}

export async function loadPublicOne(slug: string): Promise<{ ok: boolean; question: QuizQuestion | null }> {
  try {
    return { ok: true, question: await getRepository().getPublicBySlug(slug) };
  } catch (e) {
    console.error("[quiz] 公開問題の取得に失敗 slug=" + slug + ":", (e as Error).message);
    return { ok: false, question: null };
  }
}

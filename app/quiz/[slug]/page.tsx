import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SITE } from "@/lib/site";
import { loadPublicOne } from "@/lib/quiz/public-answers";
import { contentHash } from "@/lib/quiz/hash";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { question: q } = await loadPublicOne(slug);
  if (!q) return { title: "ページが見つかりません", robots: { index: false } };
  return { title: "正解と解説 | " + SITE.name, description: "日本語教員試験クイズの正解と解説を掲載しています。" };
}

export default async function QuizAnswer({ params }: Props) {
  const { slug } = await params;
  // 公開条件を満たさない（未承認・未公開・予約前）問題は 404。URL直打ちでも正答・解説は返らない。
  const { ok, question: q } = await loadPublicOne(slug);
  if (!ok) {
    // 接続障害は「存在しない(404)」と区別して案内する（詳細はサーバーログ）
    return (
      <main className="qz-main">
        <div className="qz-empty">ただいま問題を表示できません。しばらくしてからもう一度お試しください。</div>
        <Link href="/#daily-answer" className="qz-back">← 今日の解答へ</Link>
      </main>
    );
  }
  if (!q) notFound();
  return (
    <main className="qz-main">
      <div className="qz-eyebrow">ANSWER</div>
      <div className="qz-tags" style={{ marginTop: 10 }}>
        <span className="qz-tag">{q.category}</span>
        <span className="qz-tag">{q.difficulty}</span>
      </div>
      <article className="qz-card" data-quiz-answer={contentHash(q)}>
        <h1 className="qz-q">正解と解説</h1>
        <div className="qz-answer">
          <p className="qz-ans-title">
            正解：{({ A: "1", B: "2", C: "3", D: "4" } as Record<string, string>)[q.correct_answer] ?? q.correct_answer}
          </p>
          <h2>解説</h2>
          <p style={{ whiteSpace: "pre-line" }}>{q.explanation}</p>
        </div>
      </article>

      <section className="qz-book">
        <h2>書籍で体系的に学ぶ</h2>
        <p>試験範囲を基礎から整理できる侍日本語ラボの書籍です。</p>
        <a href={SITE.amazonBook1} target="_blank" rel="noopener noreferrer">
          書籍の詳細を見る
        </a>
      </section>
      <Link href="/#daily-answer" className="qz-back">
        ← 今日の解答へ
      </Link>
    </main>
  );
}

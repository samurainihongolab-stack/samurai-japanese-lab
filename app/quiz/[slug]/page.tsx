import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SITE } from "@/lib/site";
import { loadPublicList, loadPublicOne } from "@/lib/quiz/public";
import { CHOICE_KEYS } from "@/lib/quiz/types";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { question: q } = await loadPublicOne(slug);
  if (!q) return { title: "ページが見つかりません", robots: { index: false } };
  return { title: q.question.slice(0, 40) + " | 正解と解説 | " + SITE.name, description: q.explanation.slice(0, 110) };
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
        <Link href="/quiz" className="qz-back">← 問題一覧へ</Link>
      </main>
    );
  }
  if (!q) notFound();
  const related = (await loadPublicList()).questions
    .filter((x) => x.slug !== q.slug)
    .sort((a, b) => Number(b.category === q.category) - Number(a.category === q.category))
    .slice(0, 3);

  return (
    <main className="qz-main">
      <div className="qz-eyebrow">ANSWER</div>
      <div className="qz-tags" style={{ marginTop: 10 }}>
        <span className="qz-tag">{q.category}</span>
        <span className="qz-tag">{q.difficulty}</span>
      </div>
      <article className="qz-card">
        <h1 className="qz-q">{q.question}</h1>
        <ul className="qz-choices">
          {CHOICE_KEYS.map((k) => (
            <li key={k} className={"qz-choice" + (k === q.correct_answer ? " correct" : "")}>
              <b>{k}</b>
              <span>{q.choices[k]}</span>
              {k === q.correct_answer && <span className="qz-badge">正解</span>}
            </li>
          ))}
        </ul>
        <div className="qz-answer">
          <p className="qz-ans-title">
            正解は {q.correct_answer}．{q.choices[q.correct_answer]}
          </p>
          <h2>解説</h2>
          <p>{q.explanation}</p>
        </div>
      </article>

      {related.length > 0 && (
        <section className="qz-related">
          <h2>関連問題</h2>
          <ul className="qz-list">
            {related.map((r) => (
              <li key={r.slug}>
                <Link href={"/quiz/" + r.slug} className="qz-item">
                  <div className="qz-tags">
                    <span className="qz-tag">{r.category}</span>
                  </div>
                  <p>{r.question}</p>
                  <span className="qz-more">正解と解説を見る →</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="qz-book">
        <h2>書籍で体系的に学ぶ</h2>
        <p>試験範囲を基礎から整理できる侍日本語ラボの書籍です。</p>
        <a href={SITE.amazonBook1} target="_blank" rel="noopener noreferrer">
          書籍の詳細を見る
        </a>
      </section>
      <Link href="/quiz" className="qz-back">
        ← 問題一覧へ
      </Link>
    </main>
  );
}

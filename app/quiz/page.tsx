import type { Metadata } from "next";
import Link from "next/link";
import { loadPublicList } from "@/lib/quiz/public";

// 公開条件（published かつ予約時刻到達）は毎リクエストで評価する。
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "日本語教員試験クイズ | 侍日本語ラボ",
  description: "登録日本語教員試験対策の4択クイズ。正解と詳しい解説を公開しています。",
};

export default async function QuizIndex() {
  const { questions } = await loadPublicList();
  return (
    <main className="qz-main">
      <div className="qz-eyebrow">QUIZ</div>
      <h1>日本語教員試験クイズ</h1>
      <p className="qz-lead">SNSで出題した4択問題の正解と解説をまとめています。気になる問題から確認しましょう。</p>
      {questions.length === 0 ? (
        <div className="qz-empty">現在、公開中の問題はありません。</div>
      ) : (
        <ul className="qz-list">
          {questions.map((q) => (
            <li key={q.slug}>
              <Link href={"/quiz/" + q.slug} className="qz-item">
                <div className="qz-tags">
                  <span className="qz-tag">{q.category}</span>
                  <span className="qz-tag">{q.difficulty}</span>
                </div>
                <p>{q.question}</p>
                <span className="qz-more">正解と解説を見る →</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

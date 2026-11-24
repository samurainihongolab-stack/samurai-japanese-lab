import { loadDailyAnswer } from "@/lib/quiz/public-answers";

export default async function DailyAnswer() {
  const calendar = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "long", day: "numeric" });
  const now = new Date();
  const today = calendar.format(now);
  const { ok, answer } = await loadDailyAnswer(now);

  return (
    <section className="practice-section" id="daily-answer">
      <h2>今日の問題の解答</h2>
      <div className="qz-card">
        <p>{today}（日本時間）</p>
        {answer ? (
          <div className="qz-answer">
            <p className="qz-ans-title">正解：{answer.correct_answer}</p>
            <h3>解説</h3>
            <p style={{ whiteSpace: "pre-line" }}>{answer.explanation}</p>
          </div>
        ) : <p>{ok ? "本日の解答はまだ公開されていません。" : "ただいま解答を表示できません。"}</p>}
      </div>
    </section>
  );
}

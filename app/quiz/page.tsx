import DailyAnswer from "../daily-answer";

export const dynamic = "force-dynamic";

export default async function QuizIndex() {
  return <main className="qz-main">{await DailyAnswer()}</main>;
}

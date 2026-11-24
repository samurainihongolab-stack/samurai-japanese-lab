import "./home-redesign.css";
import "./quiz/quiz.css";
import Home from "./home";
import DailyAnswer from "./daily-answer";

export const dynamic = "force-dynamic";

export default function HomePage() {
  return <Home dailyAnswer={<DailyAnswer />} />;
}

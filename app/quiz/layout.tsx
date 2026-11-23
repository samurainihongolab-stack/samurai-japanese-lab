import Link from "next/link";
import { SITE } from "@/lib/site";
import "./quiz.css";

export default function QuizLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="qz">
      <header className="qz-header">
        <Link href="/" className="qz-brand">
          <span className="qz-seal">侍</span>
          {SITE.name}
        </Link>
        <nav className="qz-nav">
          <Link href="/quiz">練習問題</Link>
          <a href={SITE.amazonBook1} target="_blank" rel="noopener noreferrer" className="qz-cta">
            書籍を見る
          </a>
        </nav>
      </header>
      {children}
      <footer className="qz-footer">© {SITE.name}</footer>
    </div>
  );
}

"use client";
import "./home-redesign.css";
import { useState } from "react";
import { SITE, SOCIAL_LINKS } from "@/lib/site";

const FEATURES = [
  {
    title: "本番を意識した",
    sub: "実践問題",
    icon: (
      <>
        <path d="M7 3h8l4 4v14H7z" />
        <path d="M15 3v4h4" />
        <path d="M9.5 14l2 2 3.5-4" />
      </>
    ),
  },
  {
    title: "登録日本語教員試験に",
    sub: "特化",
    icon: (
      <>
        <circle cx="12" cy="12" r="8" />
        <circle cx="12" cy="12" r="4" />
        <path d="M12 12l7-7M16 5h3v3" />
      </>
    ),
  },
  {
    title: "CBT方式に対応した",
    sub: "教材",
    icon: (
      <>
        <rect x="3" y="4.5" width="18" height="12" rx="1.6" />
        <path d="M8 20h8M12 16.5V20" />
        <path d="M8 10.5l2.5 2.5L16 8" />
      </>
    ),
  },
  {
    title: "解説で深める",
    sub: "専門知識",
    icon: (
      <>
        <path d="M9 18h6M10 21h4" />
        <path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" />
      </>
    ),
  },
];

const items = [
  {
    cat: "教授法",
    q: "学習者が意味のある課題を達成する過程で、目標言語を使用することを重視する教授アプローチはどれですか。",
    options: ["オーディオリンガル・メソッド", "タスク中心の言語教授法（TBLT）", "文法訳読法", "直接法"],
    answer: 1,
    why: "TBLTは、意味のあるタスクの遂行を中心に学習活動を組み立てます。",
  },
  {
    cat: "評価",
    q: "あるテストが、測定したい能力を適切に測定しているかという観点はどれですか。",
    options: ["信頼性", "実用性", "妥当性", "採点効率"],
    answer: 2,
    why: "妥当性は、テスト得点の解釈や使用が目的に照らして適切かを検討する観点です。",
  },
  {
    cat: "第二言語習得",
    q: "学習者が自分の言語表現と目標言語の表現との違いに気づくことを重視する仮説と関係が深い研究者は誰ですか。",
    options: ["シュミット", "スキナー", "オースベル", "ブルーナー"],
    answer: 0,
    why: "シュミットは「気づき（noticing）」の役割を重視した研究者です。",
  },
];

export default function Home() {
  const [n, setN] = useState(0);
  const [choice, setChoice] = useState<number | null>(null);
  const [menu, setMenu] = useState(false);
  const q = items[n];
  const next = () => {
    setN((n + 1) % items.length);
    setChoice(null);
  };
  const close = () => setMenu(false);

  return (
    <div className="samurai-site" id="top">
      <header className="samurai-header">
        <a className="brand" href="#top">
          <span className="brand-seal">侍</span>
          <span>
            侍日本語ラボ<small>SAMURAI NIHONGO LAB</small>
          </span>
        </a>
        <button className="mobile-menu" onClick={() => setMenu(!menu)} aria-label="メニュー" aria-expanded={menu}>
          ☰
        </button>
        <nav className={menu ? "nav open" : "nav"} aria-label="メインメニュー">
          <a href="#top" onClick={close}>ホーム</a>
          <a href="#books" onClick={close}>書籍シリーズ</a>
          <a href="#practice" onClick={close}>無料演習</a>
          <a href="#guide" onClick={close}>学習ガイド</a>
          <a href="#social" onClick={close}>SNS</a>
          <a className="nav-follow" href={SITE.instagram} target="_blank" rel="noopener noreferrer" onClick={close}>
            Instagramをフォロー
          </a>
        </nav>
        <a className="header-cta" href="#books">書籍を見る ›</a>
      </header>

      <main>
        <section className="approved-visual" aria-label="侍日本語ラボ公式メインビジュアル">
          <h1 className="sr-only">侍日本語ラボ｜登録日本語教員試験対策の問題集と無料演習</h1>
          <img fetchPriority="high" src="/images/brand/approved-hero.webp" alt="富士山と大波、桜、侍日本語ラボのキャラクター5人。登録日本語教員試験対策。日本語教育の学びを、もっと分かりやすく、もっと実戦的に。" />
        </section>

        <section className="hero-actions" aria-label="学習を始める">
          <div>
            <strong>一問から、合格につながる学びへ。</strong>
            <p>無料演習で実力を確認し、問題集で知識を定着させましょう。</p>
          </div>
          <div className="hero-actions-buttons">
            <a className="btn-primary" href="#books">書籍シリーズを見る</a>
            <a className="btn-secondary" href="#practice">無料問題に挑戦する</a>
          </div>
        </section>

        <section className="features-band" aria-label="侍日本語ラボの特長">
          <ul className="features-list">
            {FEATURES.map((f) => (
              <li key={f.title}>
                <span className="feature-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    {f.icon}
                  </svg>
                </span>
                <span className="feature-text">
                  {f.title}
                  <br />
                  {f.sub}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="section" id="books">
          <h2>書籍シリーズ｜侍の学び三部作</h2>
          <div className="cards">
            <article className="card">
              <img className="bookimg" src="/images/brand/book-preview-0.webp" alt="壱ノ巻 応用試験・読解 模擬問題3回分" />
              <span className="tag">壱ノ巻・販売中</span>
              <h3>応用試験・読解 模擬問題3回分</h3>
              <p>全180問・解説付き。CBT方式の操作説明も収録。</p>
              <a className="gold" href={SITE.amazonBook1} target="_blank" rel="noopener noreferrer">Amazonで購入する</a>
            </article>
            <article className="card">
              <img className="bookimg" src="/images/brand/book-preview-1.webp" alt="弐ノ巻 基礎＋応用 総合対策（企画中）" />
              <span className="tag">弐ノ巻・企画中</span>
              <h3>基礎＋応用 総合対策</h3>
              <p>頻出テーマを体系的に整理する教材。</p>
            </article>
            <article className="card">
              <img className="bookimg" src="/images/brand/book-preview-2.webp" alt="参ノ巻 60日で合格力アップ（企画中）" />
              <span className="tag">参ノ巻・企画中</span>
              <h3>60日で合格力アップ</h3>
              <p>計画的な学習と演習を支援する教材。</p>
            </article>
          </div>
          <p className="muted">画像はシリーズのデザインイメージです。</p>
        </section>

        <section className="approved-visual" aria-label="こんな方におすすめ">
          <img src="/images/brand/approved-recommend.webp" alt="こんな方におすすめ。登録日本語教員試験の合格を目指している、独学でも効率的に学習したい、実戦的な問題で試験に慣れておきたい、日本語教育の知識を体系的に学びたい" />
        </section>

        <section className="approved-visual" aria-label="最新情報・学習コラム">
          <img src="/images/brand/approved-articles.webp" alt="最新情報・学習コラム。CBT方式とは、日本語教員試験の効率的な勉強スケジュール、よく出る重要用語10選" />
        </section>

        <section className="practice-section" id="practice">
          <div className="section-eyebrow">FREE PRACTICE</div>
          <h2>無料演習に挑戦</h2>
          <p>登録日本語教員試験の知識を、無料で確認できます。</p>
          <div className="quiz-card">
            <div className="quiz-top"><span>問題 {n + 1} / {items.length}</span><span>{q.cat}</span></div>
            <h3>{q.q}</h3>
            <div className="quiz-options" role="group" aria-label="回答の選択肢">
              {q.options.map((v, i) => (
                <button key={i} onClick={() => setChoice(i)} disabled={choice !== null} aria-pressed={choice === i}
                  className={choice === null ? "" : i === q.answer ? "correct" : i === choice ? "wrong" : ""}>
                  {String.fromCharCode(65 + i)}. {v}
                </button>
              ))}
            </div>
            {choice !== null && (
              <div className="quiz-feedback">
                <strong>{choice === q.answer ? "正解です" : "正解：" + q.options[q.answer]}</strong>
                <p>{q.why}</p>
                <button onClick={next}>次の問題へ →</button>
              </div>
            )}
          </div>
          <p className="follow-note">
            毎日の一問は <a href={SITE.instagram} target="_blank" rel="noopener noreferrer">Instagram</a> でも更新します。
          </p>
        </section>

        <section className="guide-section" id="guide">
          <div className="section-eyebrow">STUDY GUIDE</div>
          <h2>学びを、合格につなげる3ステップ</h2>
          <div className="guide-grid">
            <article><b>01</b><h3>CBT方式を知る</h3><p>試験形式と画面操作を理解し、本番に備える。</p></article>
            <article><b>02</b><h3>問題を解いて復習</h3><p>解説を読み、正解の根拠まで理解する。</p></article>
            <article><b>03</b><h3>弱点を繰り返す</h3><p>苦手分野を整理し、着実に知識を定着させる。</p></article>
          </div>
        </section>

        <section className="social-section" id="social">
          <div className="section-eyebrow">FOLLOW US</div>
          <h2>SNSで毎日の学びを続ける</h2>
          <p>用語・問題・学習のヒントを各SNSで発信します。</p>
          <div className="social-grid" data-count={SOCIAL_LINKS.length}>
            {SOCIAL_LINKS.map((s) => (
              <a key={s.key} href={s.url} target="_blank" rel="noopener noreferrer">
                <strong>{s.icon}</strong><span>{s.label}</span><small>{s.key === "instagram" ? "@samurai.nihongo.lab" : "公式アカウント"}</small>
              </a>
            ))}
          </div>
        </section>

        <section className="approved-visual footer-art" aria-label="侍日本語ラボ 書籍のご案内">
          <img src="/images/brand/approved-footer.webp" alt="侍日本語ラボ。日本語教育の学びを、あなたの合格力に。" />
          <a href={SITE.amazonBook1} target="_blank" rel="noopener noreferrer" aria-label="Amazonで書籍を見る" />
        </section>
      </main>

      <footer className="footer-links">
        <span>© 2026 侍日本語ラボ</span>
        <span>
          <a href="#top">ページ上部へ ↑</a>
          {SOCIAL_LINKS.map((s) => (
            <a key={s.key} href={s.url} target="_blank" rel="noopener noreferrer">{s.label}</a>
          ))}
        </span>
      </footer>
    </div>
  );
}

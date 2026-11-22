"use client";

import { useState, useEffect } from "react";

const questions = [
  {
    category: "教授法",
    question: "学習者が意味のある課題を達成する過程で、目標言語を使用することを重視する教授アプローチはどれですか。",
    options: ["オーディオリンガル・メソッド", "タスク中心の言語教授法（TBLT）", "文法訳読法", "直接法"],
    answer: 1,
    explanation: "TBLTは、意味のあるタスクの遂行を中心に学習活動を組み立てます。"
  },
  {
    category: "評価",
    question: "あるテストが、測定したい能力を適切に測定しているかという観点はどれですか。",
    options: ["信頼性", "実用性", "妥当性", "採点効率"],
    answer: 2,
    explanation: "妥当性は、テスト得点の解釈や使用が目的に照らして適切かを検討する観点です。"
  },
  {
    category: "第二言語習得",
    question: "学習者が自分の言語表現と目標言語の表現との違いに気づくことを重視する仮説と関係が深い研究者は誰ですか。",
    options: ["シュミット", "スキナー", "オースベル", "ブルーナー"],
    answer: 0,
    explanation: "シュミットは「気づき（noticing）」の役割を重視した研究者です。"
  }
];

export default function Home() {
  const [index, setIndex] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [year, setYear] = useState(new Date().getFullYear());

  const q = questions[index];

  const handleChoose = (choiceIndex: number) => {
    if (answered) return;
    setAnswered(true);
    setSelected(choiceIndex);
  };

  const handleNext = () => {
    setIndex((index + 1) % questions.length);
    setAnswered(false);
    setSelected(null);
  };

  const handleMenuClick = () => {
    setMenuOpen(!menuOpen);
  };

  const closeMenu = () => {
    setMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-white text-text">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-6 px-6 py-4 sm:px-8 max-w-[1120px] mx-auto">
          {/* Brand */}
          <a href="#top" className="flex items-center gap-2.5 no-underline text-navy font-black text-lg sm:text-xl whitespace-nowrap leading-tight">
            <img src="/images/brand/logo.png" alt="侍日本語ラボ ロゴ" className="w-13 h-13 object-contain" />
            <span>
              侍日本語ラボ
              <small className="block text-2xs font-black tracking-widest mt-1">SAMURAI NIHONGO LAB</small>
            </span>
          </a>

          {/* Menu Button (Mobile) */}
          <button
            onClick={handleMenuClick}
            aria-label={menuOpen ? "メニューを閉じる" : "メニューを開く"}
            aria-expanded={menuOpen}
            className="text-2xl text-navy border-0 bg-none cursor-pointer sm:hidden"
          >
            ☰
          </button>

          {/* Navigation */}
          <nav
            className={`${
              menuOpen ? "flex" : "hidden"
            } absolute top-[69px] left-0 right-0 bg-white shadow-lg flex-col gap-3.5 p-6 sm:static sm:flex sm:flex-row sm:gap-6 sm:shadow-none sm:bg-transparent sm:p-0`}
          >
            <a href="#books" onClick={closeMenu} className="font-bold text-sm sm:text-xs hover:text-blue">
              教材紹介
            </a>
            <a href="#practice" onClick={closeMenu} className="font-bold text-sm sm:text-xs hover:text-blue">
              無料
            </a>
            <a href="#guide" onClick={closeMenu} className="font-bold text-sm sm:text-xs hover:text-blue">
              学習ガイド
            </a>
            <a href="#about" onClick={closeMenu} className="font-bold text-sm sm:text-xs hover:text-blue">
              ラボについて
            </a>
            <a
              href="#books"
              onClick={closeMenu}
              className="hidden sm:inline-block bg-navy text-white px-4 py-2.5 rounded-lg font-bold text-xs hover:brightness-105"
            >
              教材を見る
            </a>
          </nav>
        </div>
      </header>

      <main id="top">
        {/* Hero Section */}
        <section className="relative h-[570px] bg-blue-900 overflow-hidden">
          <img
            src="/images/brand/hero-bg.png"
            alt="富士山と大波、桜を眺める侍日本語ラボのキャラクター"
            className="w-full h-full object-cover"
          />
          <div
            className="absolute inset-0"
            style={{
              background: "linear-gradient(90deg, rgba(3,22,51,.90), rgba(3,22,51,.73) 34%, rgba(3,22,51,.12) 75%)"
            }}
          ></div>

          <div className="absolute inset-0 flex flex-col justify-center items-start px-6 sm:px-8 max-w-[1120px] mx-auto pointer-events-none">
            <span className="pointer-events-auto inline-block border border-white border-opacity-50 rounded-full px-4 py-1 text-white text-xs font-bold tracking-widest mb-6">
              登録日本語教員試験 対策教材
            </span>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white mb-3 leading-tight pointer-events-auto">
              学ぶ力を、<br />
              <em className="font-black text-yellow not-italic">合格につながる力</em>へ。
            </h1>

            <p className="text-base sm:text-lg text-white font-semibold leading-relaxed mb-6 pointer-events-auto max-w-2xl">
              知識を覚えるだけで終わらせない。<br />
              考え、選び、解き切る力を育てる学習を。
            </p>

            <div className="flex flex-col sm:flex-row gap-3 flex-wrap pointer-events-auto">
              <a
                href="#books"
                className="inline-flex items-center justify-center gap-3.5 bg-yellow text-deep px-6 py-3 rounded-lg font-black text-sm hover:brightness-105 transition"
              >
                教材をチェック <span>→</span>
              </a>
              <button className="inline-flex items-center justify-center border border-white text-white bg-white bg-opacity-10 px-6 py-3 rounded-lg font-black text-sm hover:bg-opacity-20 transition">
                無料問題に挑戦
              </button>
            </div>
          </div>
        </section>

        {/* Intro Section */}
        <section className="px-6 sm:px-8 py-16 sm:py-20 max-w-[1120px] mx-auto">
          <div className="flex flex-col sm:flex-row items-center gap-9">
            <div className="flex-shrink-0 w-28 h-28 bg-navy text-white border-4 border-yellow rounded-full flex items-center justify-center font-black text-5xl">
              侍
            </div>
            <div className="flex-1">
              <span className="text-xs font-black text-blue tracking-widest">WELCOME TO SAMURAI NIHONGO LAB</span>
              <h2 className="text-2xl sm:text-3xl font-black text-deep mb-4 mt-2">
                一問ずつ、確かな実力へ。
              </h2>
              <p className="text-sm sm:text-base text-muted leading-relaxed max-w-3xl mb-0">
                侍日本語ラボは、登録日本語教員試験に挑戦する学習者のための教材ブランドです。模擬試験・解説・無料演習を通じて、試験本番で使える判断力を磨くことを目指します。
              </p>
            </div>
          </div>
        </section>

        {/* Books Section */}
        <section id="books" className="px-6 sm:px-8 py-16 sm:py-20 bg-pale">
          <div className="max-w-[1120px] mx-auto">
            <div className="mb-8">
              <span className="text-xs font-black text-blue tracking-widest">BOOKS & MATERIALS</span>
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 mt-2">
                <h2 className="text-3xl sm:text-4xl font-black text-deep">試験対策教材</h2>
                <p className="text-sm sm:text-base text-muted">目的に合わせて、学び方を選ぶ。</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Book Card 1 */}
              <div className="bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition flex flex-col">
                <div className="relative bg-gradient-to-b from-blue-600 to-navy text-white p-5 h-64 flex flex-col items-center justify-between text-center">
                  <span className="bg-white bg-opacity-25 text-xs font-black px-4 py-1 rounded-full">令和9年度 対応</span>
                  <div>
                    <div className="text-xl sm:text-2xl font-black leading-snug">応用試験・読解<br /><strong className="text-yellow text-2xl sm:text-3xl">模擬問題 3回分</strong></div>
                    <div className="text-lg sm:text-xl font-black text-yellow mt-2">全180問</div>
                  </div>
                  <span className="text-sm font-bold">侍日本語ラボ</span>
                  <span className="absolute bottom-5 right-0 text-9xl font-black opacity-10">侍</span>
                </div>
                <div className="p-6 flex flex-col flex-1">
                  <span className="inline-block text-xs font-black text-blue bg-pale rounded-full px-3 py-1 w-fit mb-3">Aシリーズ</span>
                  <h3 className="text-lg font-black text-navy mb-2">応用試験・読解 模擬問題3回分</h3>
                  <p className="text-sm text-muted mb-4 flex-1">本番を意識した60問×3回の演習。解説を読みながら、知識と問題への対応力を確認できます。</p>
                  <div className="flex flex-wrap gap-2 mb-4 text-xs bg-gray-100 p-2 rounded">
                    <span>紙書籍</span>
                    <span>CBT操作・画面説明つき</span>
                  </div>
                  <button className="w-full bg-navy text-white py-2.5 rounded-lg font-black text-sm hover:brightness-110 transition">
                    Amazonで詳細を見る →
                  </button>
                  <small className="text-xs text-gray-500 mt-2">販売ページURLを設定するとリンクが有効になります。</small>
                </div>
              </div>

              {/* Book Card 2 */}
              <div className="bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition flex flex-col">
                <div className="relative bg-gradient-to-b from-green-700 to-green-900 text-white p-5 h-64 flex flex-col items-center justify-between text-center">
                  <span className="bg-white bg-opacity-25 text-xs font-black px-4 py-1 rounded-full">企画中</span>
                  <div>
                    <div className="text-xl sm:text-2xl font-black leading-snug">基礎＋応用<br /><strong className="text-yellow text-2xl sm:text-3xl">総合対策</strong></div>
                  </div>
                  <span className="text-sm font-bold">侍日本語ラボ</span>
                  <span className="absolute bottom-5 right-0 text-9xl font-black opacity-10">侍</span>
                </div>
                <div className="p-6 flex flex-col flex-1">
                  <span className="inline-block text-xs font-black text-gray-600 bg-gray-200 rounded-full px-3 py-1 w-fit mb-3">Bシリーズ・企画中</span>
                  <h3 className="text-lg font-black text-navy mb-2">基礎＋応用 総合対策</h3>
                  <p className="text-sm text-muted mb-4 flex-1">試験範囲の体系的な理解を支援する総合教材を構想しています。</p>
                  <span className="text-sm font-black text-gray-500">準備中</span>
                </div>
              </div>

              {/* Book Card 3 */}
              <div className="bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition flex flex-col">
                <div className="relative bg-gradient-to-b from-orange-500 to-red-700 text-white p-5 h-64 flex flex-col items-center justify-between text-center">
                  <span className="bg-white bg-opacity-25 text-xs font-black px-4 py-1 rounded-full">企画中</span>
                  <div>
                    <div className="text-xl sm:text-2xl font-black leading-snug"><strong className="text-yellow text-2xl sm:text-3xl">60日で</strong><br />合格力アップ</div>
                  </div>
                  <span className="text-sm font-bold">侍日本語ラボ</span>
                  <span className="absolute bottom-5 right-0 text-9xl font-black opacity-10">侍</span>
                </div>
                <div className="p-6 flex flex-col flex-1">
                  <span className="inline-block text-xs font-black text-gray-600 bg-gray-200 rounded-full px-3 py-1 w-fit mb-3">Cシリーズ・企画中</span>
                  <h3 className="text-lg font-black text-navy mb-2">60日ステップアップ教材</h3>
                  <p className="text-sm text-muted mb-4 flex-1">毎日の学習を積み重ねるための段階式教材を構想しています。</p>
                  <span className="text-sm font-black text-gray-500">準備中</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Practice Section */}
        <section id="practice" className="px-6 sm:px-8 py-16 sm:py-20">
          <div className="max-w-[1120px] mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-20 items-start">
              {/* Left side text */}
              <div>
                <span className="text-xs font-black text-blue tracking-widest">FREE PRACTICE</span>
                <h2 className="text-3xl sm:text-4xl font-black text-deep mt-2 mb-4 leading-tight">
                  まずは無料で、<br />一問に挑戦。
                </h2>
                <p className="text-sm sm:text-base text-muted mb-6">
                  登録日本語教員試験の学習領域をもとにしたオリジナル練習問題です。選択肢を選ぶと解説を確認できます。
                </p>
                <div className="flex flex-wrap gap-2">
                  {["教授法", "評価", "第二言語習得"].map((tag) => (
                    <span key={tag} className="text-xs font-black text-navy bg-pale px-3 py-1.5 rounded-full">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Quiz Card */}
              <div className="border border-blue-200 rounded-2xl p-7 bg-white shadow-lg">
                <div className="flex justify-between items-center text-xs font-black text-navy mb-6">
                  <span>無料お試し問題</span>
                  <span id="counter">{index + 1} / {questions.length}</span>
                </div>

                <div className="text-blue text-xs font-black mb-4">{q.category}</div>

                <h3 className="text-lg sm:text-xl font-black text-navy mb-6 leading-relaxed">
                  {q.question}
                </h3>

                <div className="space-y-2.5 mb-6">
                  {q.options.map((option, i) => (
                    <button
                      key={i}
                      onClick={() => handleChoose(i)}
                      disabled={answered}
                      className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition border ${
                        !answered
                          ? "bg-white border-blue-100 hover:bg-blue-50 hover:border-blue cursor-pointer"
                          : i === q.answer
                          ? "bg-green-100 border-green-400 cursor-default"
                          : i === selected
                          ? "bg-red-100 border-red-400 cursor-default"
                          : "bg-gray-50 border-gray-200 cursor-default"
                      }`}
                    >
                      {i + 1}. {option}
                    </button>
                  ))}
                </div>

                {answered && (
                  <div className="bg-blue-50 p-4 rounded-lg mb-6 text-sm text-navy">
                    <strong className="font-black block mb-2">
                      {selected === q.answer ? "正解です。" : "不正解です。"}
                    </strong>
                    {q.explanation}
                  </div>
                )}

                {answered && (
                  <button
                    onClick={handleNext}
                    className="w-full bg-navy text-white py-3 rounded-lg font-black text-sm hover:brightness-110 transition"
                  >
                    {index === questions.length - 1 ? "もう一度挑戦 ↻" : "次の問題へ →"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Guide Section */}
        <section id="guide" className="px-6 sm:px-8 py-16 sm:py-20 bg-pale">
          <div className="max-w-[1120px] mx-auto">
            <span className="text-xs font-black text-blue tracking-widest">STUDY GUIDE</span>
            <h2 className="text-3xl sm:text-4xl font-black text-deep mt-2 mb-12">学習ガイド</h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              {[
                { icon: "01", title: "CBT方式の準備", desc: "画面上で問題を読み、選択する形式を想定して、時間配分と操作の流れを事前に確認しましょう。" },
                { icon: "02", title: "解説を使った復習", desc: "正解だけでなく、不正解の選択肢がなぜ適切でないかまで確認することで、理解を深めます。" },
                { icon: "03", title: "弱点の見える化", desc: "教授法・文法・評価などの分野ごとに間違いを記録し、次の演習に生かしましょう。" }
              ].map((item, i) => (
                <div key={i} className="bg-white rounded-xl p-7 shadow-sm hover:shadow-md transition">
                  <div className="text-3xl font-black text-blue mb-3">{item.icon}</div>
                  <h3 className="text-lg font-black text-navy mb-3">{item.title}</h3>
                  <p className="text-sm text-muted leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>

            <p className="text-xs text-gray-500 mt-8">
              ※ 試験制度や実施方式の最新情報は、必ず公式発表をご確認ください。当サイトは試験実施機関の公式サイトではありません。
            </p>
          </div>
        </section>

        {/* About Section */}
        <section id="about" className="px-6 sm:px-8 py-16 sm:py-20">
          <div className="max-w-[1120px] mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 lg:gap-20 items-start">
              <div className="bg-pale rounded-3xl p-8 flex items-center justify-center min-h-80">
                <img src="/images/brand/logo.png" alt="侍日本語ラボのブランドロゴ" className="w-full max-w-xs" loading="lazy" />
              </div>
              <div>
                <span className="text-xs font-black text-blue tracking-widest">ABOUT THE LAB</span>
                <h2 className="text-3xl sm:text-4xl font-black text-deep mt-2 mb-6 leading-tight">
                  学びに、情熱と工夫を。
                </h2>
                <p className="text-sm sm:text-base text-muted leading-relaxed mb-4">
                  侍日本語ラボは、登録日本語教員を目指す人が、学びを継続し、知識を実践的な力へ変えていける教材づくりを目指しています。
                </p>
                <p className="text-sm sm:text-base text-muted leading-relaxed mb-6">
                  問題演習を通して「なぜその答えになるのか」を考えられることを大切にしています。今後は書籍に加え、無料学習コンテンツやWeb学習サービスへの展開も検討しています。
                </p>
                <a href="#books" className="font-black text-navy hover:text-blue transition">
                  教材一覧を見る →
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Closing Section */}
        <section className="px-6 sm:px-8 py-16 sm:py-20 bg-navy text-white text-center">
          <div className="max-w-[1120px] mx-auto">
            <span className="text-xs font-black text-yellow tracking-widest">START YOUR NEXT STEP</span>
            <h2 className="text-3xl sm:text-4xl font-black text-white mt-4 mb-4">
              今日の一問が、明日の自信になる。
            </h2>
            <p className="text-sm sm:text-base mb-8 opacity-90">
              まずは無料演習から、学習を始めてみませんか。
            </p>
            <a
              href="#practice"
              className="inline-flex items-center justify-center gap-3 bg-yellow text-navy px-6 py-3 rounded-lg font-black text-sm hover:brightness-110 transition"
            >
              無料問題に挑戦 →
            </a>
          </div>
        </section>
      </main>

      {/* SNS Section */}
      <section className="px-6 sm:px-8 py-16 bg-white border-t border-pale">
        <div className="max-w-[1120px] mx-auto">
          <h2 className="text-2xl sm:text-3xl font-black text-deep mb-8 text-center">
            SNS で学びを続ける
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Twitter/X */}
            <div className="text-center">
              <h3 className="text-xl font-black text-navy mb-3">𝕏 (Twitter)</h3>
              <p className="text-sm text-muted mb-4">
                最新の教材情報と試験トレンドをリアルタイムで配信
              </p>
              <a
                href="https://x.com/samurai_nihongo"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block bg-navy text-white px-5 py-2 rounded-lg font-bold text-sm hover:brightness-110 transition"
              >
                @samurai_nihongo を フォロー
              </a>
            </div>

            {/* Instagram */}
            <div className="text-center">
              <h3 className="text-xl font-black text-navy mb-3">📸 Instagram</h3>
              <p className="text-sm text-muted mb-4">
                学習のコツと日本語教育に関する詳細情報を毎日シェア
              </p>
              <a
                href="https://instagram.com/samurai.nihongo.lab"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block bg-navy text-white px-5 py-2 rounded-lg font-bold text-sm hover:brightness-110 transition"
              >
                @samurai.nihongo.lab をフォロー
              </a>
            </div>

            {/* Threads */}
            <div className="text-center">
              <h3 className="text-xl font-black text-navy mb-3">💬 Threads</h3>
              <p className="text-sm text-muted mb-4">
                教育現場の知見と深い議論をコミュニティで展開
              </p>
              <a
                href="https://threads.net/@samurai.nihongo.lab"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block bg-navy text-white px-5 py-2 rounded-lg font-bold text-sm hover:brightness-110 transition"
              >
                コミュニティに参加する
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-deep text-blue-100 px-6 sm:px-8 py-12">
        <div className="max-w-[1120px] mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mb-8">
            <div>
              <strong className="text-lg text-white">侍日本語ラボ</strong>
              <small className="block text-xs tracking-widest mt-1">SAMURAI NIHONGO LAB</small>
              <p className="text-xs mt-2">登録日本語教員試験対策のための教材ブランド</p>
            </div>
            <div className="sm:text-center">
              <div className="flex flex-col gap-2 text-xs sm:justify-center">
                <a href="#books" className="hover:text-white transition">
                  教材紹介
                </a>
                <a href="#practice" className="hover:text-white transition">
                  無料演習
                </a>
                <a href="#guide" className="hover:text-white transition">
                  学習ガイド
                </a>
                <a href="#about" className="hover:text-white transition">
                  ブランド紹介
                </a>
              </div>
            </div>
            <div className="sm:text-right">
              <div className="flex flex-col gap-2 text-xs sm:items-end">
                <a href="https://x.com/samurai_nihongo" target="_blank" rel="noopener noreferrer" className="hover:text-white transition">
                  𝕏 (Twitter)
                </a>
                <a href="https://instagram.com/samurai.nihongo.lab" target="_blank" rel="noopener noreferrer" className="hover:text-white transition">
                  Instagram
                </a>
                <a href="https://threads.net/@samurai.nihongo.lab" target="_blank" rel="noopener noreferrer" className="hover:text-white transition">
                  Threads
                </a>
              </div>
            </div>
          </div>
          <div className="border-t border-white border-opacity-20 pt-4 text-center text-xs opacity-80">
            © <span id="year">{year}</span> 侍日本語ラボ. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}

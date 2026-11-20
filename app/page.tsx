"use client";

export default function Home() {
  const amazonLink = "https://www.amazon.co.jp/dp/B0HS55WB3D";
  const instagramLink = "https://instagram.com/samurai.nihongo.lab";
  const xLink = "https://x.com/samurai_nihongo";
  const threadsLink = "https://threads.net/@samurai.nihongo.lab";

  return (
    <div className="min-h-screen bg-white">
      {/* Header/Navigation */}
      <header className="sticky top-0 z-50 bg-samurai-navy text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <img
                src="/images/brand/logo.png"
                alt="侍日本語ラボ"
                className="h-14 w-auto"
              />
            </div>
            <nav className="hidden sm:flex gap-8 text-sm">
              <a href="#home" className="hover:text-samurai-gold transition">
                ホーム
              </a>
              <a href="#books" className="hover:text-samurai-gold transition">
                書籍シリーズ
              </a>
              <a href="#guides" className="hover:text-samurai-gold transition">
                学習ガイド
              </a>
              <a href="#blog" className="hover:text-samurai-gold transition">
                ブログ
              </a>
              <a href="#about" className="hover:text-samurai-gold transition">
                選書について
              </a>
            </nav>
            <div className="flex items-center gap-4">
              <button className="text-white hover:text-samurai-gold">🔍</button>
              <a
                href={amazonLink}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-samurai-gold text-black px-4 py-2 rounded-lg font-bold hover:opacity-90 transition text-sm"
              >
                🛒 Amazonで購入
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section
        className="relative bg-cover bg-center bg-no-repeat overflow-hidden"
        style={{
          backgroundImage: "url(/images/brand/hero-bg.png)",
          minHeight: "500px"
        }}
      >
        {/* オーバーレイ（テキスト読みやすさ用） */}
        <div className="absolute inset-0 bg-black/30"></div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-32">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            {/* 左側：テキストコンテンツ */}
            <div className="text-white">
              <div className="mb-4 inline-block bg-samurai-gold text-black px-4 py-2 rounded-full font-bold text-sm">
                登録日本語教員試験対策
              </div>
              <h1 className="text-4xl sm:text-5xl font-bold mb-6">
                侍日本語ラボ
              </h1>
              <p className="text-lg sm:text-xl text-white mb-8 leading-relaxed max-w-lg font-medium">
                日本語教の学びを、<br />
                もっと分かりやすく、もっと実践的に。
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <a
                  href="#books"
                  className="inline-block bg-samurai-gold text-black px-8 py-3 rounded-lg font-bold hover:opacity-90 transition text-center"
                >
                  書籍シリーズを見る
                </a>
                <a
                  href="#guides"
                  className="inline-block bg-white/90 text-samurai-navy px-8 py-3 rounded-lg font-bold hover:opacity-90 transition text-center"
                >
                  学習ガイド
                </a>
              </div>
            </div>

            {/* 右側：リョウのキャラクター */}
            <div className="flex justify-center">
              <img
                src="/images/brand/character-ryo.png"
                alt="主人公リョウ"
                className="h-96 w-auto object-contain"
              />
            </div>
          </div>
        </div>
      </section>

      {/* 4つの特徴セクション */}
      <section className="py-16 sm:py-24 bg-gradient-to-b from-white to-blue-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: "📖", title: "試験に直結する実践的問題", desc: "最新の試験傾向を反映" },
              { icon: "🎯", title: "基礎から応用まで体系的に学ぶ", desc: "段階的な学習ロードマップ" },
              { icon: "📅", title: "スケジュールで計画的に学習", desc: "1日30分で着実に進める" },
              { icon: "📊", title: "合格力を効果的にアップ", desc: "データ化された進捗管理" }
            ].map((item, idx) => (
              <div key={idx} className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition text-center">
                <div className="text-4xl mb-3">{item.icon}</div>
                <h3 className="font-bold text-samurai-navy mb-2">{item.title}</h3>
                <p className="text-sm text-gray-600">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 書籍シリーズセクション */}
      <section id="books" className="py-16 sm:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold text-samurai-navy mb-4">
              📚 書籍シリーズ | 侍の学び三部作
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">基礎から応用まで、体系的に学べる教材</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                title: "壱ノ巻",
                subtitle: "応用試験・読解／模擬問題3回分／全180問",
                badge: "販売中",
                badgeColor: "bg-samurai-gold",
                features: ["✓ CBT対応", "✓ 本番レベルの模試試験", "✓ 詳しい解説つき"],
                icon: "🌊",
                status: "published"
              },
              {
                title: "弐ノ巻",
                subtitle: "基礎＋応用／総合対策",
                badge: "企画中",
                badgeColor: "bg-green-600",
                features: ["✓ 基礎から応用まで網羅", "✓ 頻出テーマで体系整理", "✓ 演習問題で定着"],
                icon: "🍃",
                status: "coming"
              },
              {
                title: "参ノ巻",
                subtitle: "60日で合格力アップ",
                badge: "企画中",
                badgeColor: "bg-orange-600",
                features: ["✓ 60日の学習プラン", "✓ 重要ポイントの解説", "✓ 実績・機械問題つき"],
                icon: "🍂",
                status: "coming"
              }
            ].map((book, idx) => (
              <div key={idx} className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg overflow-hidden shadow-md hover:shadow-xl transition">
                <div className="bg-gradient-to-r from-samurai-navy to-blue-700 text-white p-6 relative">
                  <span className={`${book.badgeColor} text-white text-xs font-bold px-3 py-1 rounded-full absolute top-4 right-4`}>
                    {book.badge}
                  </span>
                  <div className="text-6xl mb-4">{book.icon}</div>
                  <h3 className="text-2xl font-bold">{book.title}</h3>
                  <p className="text-blue-100 text-sm">{book.subtitle}</p>
                </div>
                <div className="p-6">
                  {book.features.map((feature, fidx) => (
                    <p key={fidx} className="text-sm text-gray-700 mb-2">{feature}</p>
                  ))}
                  {book.status === "published" && (
                    <a
                      href={amazonLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-4 w-full block bg-samurai-gold text-black font-bold py-2 rounded text-center hover:opacity-90 transition"
                    >
                      詳しく見る
                    </a>
                  )}
                  {book.status === "coming" && (
                    <div className="mt-4 w-full text-center text-gray-500 py-2 text-sm">
                      近日公開予定
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Daily Problem Section */}
      <section id="guides" className="py-16 sm:py-24 bg-samurai-light">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-samurai-navy mb-12 text-center">
            📖 毎日の問題
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-lg shadow-md">
              <h3 className="text-xl font-bold text-samurai-navy mb-4">
                📸 Instagram
              </h3>
              <div className="bg-samurai-light p-6 rounded mb-4 min-h-[150px] flex items-center justify-center">
                <p className="text-gray-600 text-center">
                  毎日10:00に問題を配信します。<br />
                  写真で分かりやすく学べます。
                </p>
              </div>
              <a
                href={instagramLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-samurai-navy font-bold hover:text-samurai-gold transition"
              >
                → @samurai.nihongo.lab
              </a>
            </div>
            <div className="bg-white p-8 rounded-lg shadow-md">
              <h3 className="text-xl font-bold text-samurai-navy mb-4">
                𝕏 X
              </h3>
              <div className="bg-samurai-light p-6 rounded mb-4 min-h-[150px] flex items-center justify-center">
                <p className="text-gray-600 text-center">
                  毎日20:00に回答と詳細な解説を配信。<br />
                  スレッドで深掘り解説。
                </p>
              </div>
              <a
                href={xLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-samurai-navy font-bold hover:text-samurai-gold transition"
              >
                → @samurai_nihongo
              </a>
            </div>
            <div className="bg-white p-8 rounded-lg shadow-md">
              <h3 className="text-xl font-bold text-samurai-navy mb-4">
                🧵 Threads
              </h3>
              <div className="bg-samurai-light p-6 rounded mb-4 min-h-[150px] flex items-center justify-center">
                <p className="text-gray-600 text-center">
                  コミュニティで質問・相談。<br />
                  他の学習者と交流できます。
                </p>
              </div>
              <a
                href={threadsLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-samurai-navy font-bold hover:text-samurai-gold transition"
              >
                → Threads で交流
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* 「こんな方におすすめ！」セクション */}
      <section className="py-16 sm:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-samurai-navy mb-4">こんな方におすすめ！</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {[
              "✓ 登録日本語教員試験の合格を目指している",
              "✓ 独学でも効率的に学習したい",
              "✓ 実践的な問題で試験に備えておきたい",
              "✓ 日本語教育の知識を体系的に学びたい"
            ].map((item, idx) => (
              <div key={idx} className="flex items-start gap-4 p-4 bg-blue-50 rounded-lg">
                <span className="text-2xl flex-shrink-0">✅</span>
                <p className="text-gray-700 font-medium">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Book Info Section */}
      <section className="py-16 sm:py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-samurai-navy mb-12 text-center">
            📚 書籍について
          </h2>
          <div className="bg-gradient-to-r from-samurai-navy to-samurai-navy/80 text-white p-12 rounded-lg shadow-lg">
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div>
                <h3 className="text-2xl font-bold mb-4">
                  日本語教員試験対策テキスト
                </h3>
                <p className="text-lg mb-6 leading-8">
                  応用試験・読解問題集をAmazonで販売中。
                  基礎知識から応用問題まで、体系的に学べます。
                </p>
                <ul className="space-y-2 mb-8">
                  <li className="flex items-center gap-2">
                    <span className="text-samurai-gold">✓</span> 詳細な解説付き
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-samurai-gold">✓</span> 試験頻出問題
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-samurai-gold">✓</span> SNSでの追加情報
                  </li>
                </ul>
                <a
                  href={amazonLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block bg-samurai-gold text-black px-8 py-3 rounded-lg font-bold hover:opacity-90 transition"
                >
                  Amazonで購入
                </a>
              </div>
              <div className="bg-white/10 p-8 rounded-lg text-center">
                <div className="text-6xl mb-4">📖</div>
                <p className="text-sm opacity-80">
                  クリックでAmazonへ移動します
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ブログ記事セクション */}
      <section id="blog" className="py-16 sm:py-24 bg-gradient-to-b from-white to-blue-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-samurai-navy mb-4">📖 最新情報・学習コラム</h2>
            <p className="text-gray-600">試験対策に役立つ情報を随時更新</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                title: "[試験対策] CBT方式とは?",
                desc: "新しい試験形式を詳しく解説。メリット・デメリット、対策ポイントまで。",
                date: "2026.11.15",
                badge: "試験対策"
              },
              {
                title: "[学習法] 日本語教員試験の効率的な勉強スケジュール",
                desc: "限られた時間で確実に力をつけるための学習方法とは。",
                date: "2026.11.12",
                badge: "学習法"
              },
              {
                title: "[用語解説] よく出る重要用語10選",
                desc: "SLA・CEFR・Can-do など、頻出キーワードを解説。",
                date: "2026.11.10",
                badge: "用語解説"
              }
            ].map((article, idx) => (
              <div key={idx} className="bg-white rounded-lg shadow-md hover:shadow-lg transition overflow-hidden">
                <div className="bg-gradient-to-r from-samurai-navy to-blue-700 text-white p-4">
                  <span className="bg-samurai-gold text-black text-xs font-bold px-2 py-1 rounded inline-block mb-2">
                    {article.badge}
                  </span>
                </div>
                <div className="p-6">
                  <h3 className="font-bold text-samurai-navy mb-2 line-clamp-2">{article.title}</h3>
                  <p className="text-sm text-gray-600 mb-4">{article.desc}</p>
                  <div className="text-xs text-gray-500">{article.date}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-12">
            <a href="#blog" className="text-samurai-navy font-bold hover:text-samurai-gold transition">
              ブログ一覧を見る →
            </a>
          </div>
        </div>
      </section>

      {/* SNS Section */}
      <section id="sns" className="py-16 sm:py-24 bg-samurai-light">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-samurai-navy mb-12 text-center">
            📱 SNSをフォロー
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <a
              href={instagramLink}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white p-8 rounded-lg shadow-md hover:shadow-lg transition text-center"
            >
              <div className="text-5xl mb-4">📸</div>
              <h3 className="text-xl font-bold text-samurai-navy mb-2">
                Instagram
              </h3>
              <p className="text-gray-600 mb-4 text-sm">
                日々の問題・学習情報
              </p>
              <div className="text-sm text-samurai-gold font-bold">
                @samurai.nihongo.lab
              </div>
            </a>

            <a
              href={xLink}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white p-8 rounded-lg shadow-md hover:shadow-lg transition text-center"
            >
              <div className="text-5xl mb-4">𝕏</div>
              <h3 className="text-xl font-bold text-samurai-navy mb-2">X</h3>
              <p className="text-gray-600 mb-4 text-sm">
                リアルタイム情報・トレンド
              </p>
              <div className="text-sm text-samurai-gold font-bold">
                @samurai_nihongo
              </div>
            </a>

            <a
              href={threadsLink}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white p-8 rounded-lg shadow-md hover:shadow-lg transition text-center"
            >
              <div className="text-5xl mb-4">🧵</div>
              <h3 className="text-xl font-bold text-samurai-navy mb-2">
                Threads
              </h3>
              <p className="text-gray-600 mb-4 text-sm">
                深い議論・コミュニティ
              </p>
              <div className="text-sm text-samurai-gold font-bold">
                詳細情報共有
              </div>
            </a>
          </div>

          <div className="mt-12 bg-white p-8 rounded-lg shadow-md text-center">
            <p className="text-gray-700 mb-4">
              失敗させない日本語学習へ。📚
            </p>
            <p className="text-gray-600 text-sm leading-8">
              📖 書籍で基礎を学ぶ<br />
              📱 SNS × アプリで毎日成長<br />
              💪 共に励ましあえるコミュニティ
            </p>
          </div>
        </div>
      </section>

      {/* 7. Contact/Footer Section */}
      <footer
        id="contact"
        className="bg-samurai-navy text-white py-12 sm:py-16"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8 mb-12">
            <div>
              <h4 className="text-lg font-bold mb-4">侍日本語ラボ</h4>
              <p className="text-sm opacity-80">
                失敗させない日本語学習プラットフォーム
              </p>
            </div>
            <div>
              <h4 className="text-lg font-bold mb-4">リンク</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <a
                    href="#about"
                    className="opacity-80 hover:opacity-100 transition"
                  >
                    About
                  </a>
                </li>
                <li>
                  <a
                    href="#books"
                    className="opacity-80 hover:opacity-100 transition"
                  >
                    書籍
                  </a>
                </li>
                <li>
                  <a
                    href={amazonLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="opacity-80 hover:opacity-100 transition"
                  >
                    Amazon
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-lg font-bold mb-4">SNS</h4>
              <div className="flex gap-4">
                <a
                  href={instagramLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="opacity-80 hover:opacity-100 transition"
                >
                  Instagram
                </a>
                <a
                  href={xLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="opacity-80 hover:opacity-100 transition"
                >
                  X
                </a>
              </div>
            </div>
          </div>

          <div className="border-t border-white/20 pt-8 text-center text-sm opacity-80">
            <p>
              &copy; 2026 侍日本語ラボ. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

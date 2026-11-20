"use client";

export default function Home() {
  const amazonLink = "https://www.amazon.co.jp/dp/B0HS55WB3D";
  const instagramLink = "https://instagram.com/samurai.nihongo.lab";
  const xLink = "https://x.com/samurai_nihongo";
  const threadsLink = "https://threads.net/@samurai.nihongo.lab";

  return (
    <div className="min-h-screen bg-white">
      {/* 1. Header/Navigation */}
      <header className="sticky top-0 z-50 bg-samurai-navy text-white shadow-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="text-2xl font-bold">🥋 侍日本語ラボ</div>
            <nav className="hidden sm:flex gap-8 text-sm">
              <a href="#about" className="hover:text-samurai-gold transition">
                About
              </a>
              <a href="#problem" className="hover:text-samurai-gold transition">
                Daily問題
              </a>
              <a href="#books" className="hover:text-samurai-gold transition">
                書籍
              </a>
              <a href="#sns" className="hover:text-samurai-gold transition">
                SNS
              </a>
              <a href="#contact" className="hover:text-samurai-gold transition">
                Contact
              </a>
            </nav>
          </div>
        </div>
      </header>

      {/* 2. Hero Section */}
      <section className="bg-gradient-to-b from-samurai-light to-white py-16 sm:py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="text-5xl sm:text-6xl font-bold mb-6">
              <span className="text-samurai-navy">失敗させない</span>
              <br />
              <span className="text-samurai-gold">日本語学習へ。</span>
            </div>
            <p className="text-lg sm:text-xl text-gray-700 mb-8 max-w-2xl mx-auto">
              日本語教員試験対策から登録日本語教員まで。<br />
              皆さんの背中を後押しします。
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href={amazonLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block bg-samurai-red text-white px-8 py-3 rounded-lg font-bold hover:opacity-90 transition"
              >
                📚 書籍を見る
              </a>
              <a
                href="#sns"
                className="inline-block bg-samurai-navy text-white px-8 py-3 rounded-lg font-bold hover:opacity-90 transition"
              >
                SNSをフォロー
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* 3. About Section */}
      <section id="about" className="py-16 sm:py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-samurai-navy mb-12 text-center">
            About 侍日本語ラボ
          </h2>
          <div className="grid md:grid-cols-2 gap-12">
            <div>
              <h3 className="text-2xl font-bold text-samurai-gold mb-4">
                ミッション
              </h3>
              <p className="text-gray-700 leading-8">
                書籍とSNS、アプリを通じて、日本語学習者が「失敗させない」学習環境を提供します。
              </p>
            </div>
            <div>
              <h3 className="text-2xl font-bold text-samurai-gold mb-4">
                コンセプト
              </h3>
              <p className="text-gray-700 leading-8">
                背中を後押し。これからの日本語教員も、既に登録された日本語教員も。
                情報発信で、一緒に成長しましょう。
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Daily Problem Section */}
      <section id="problem" className="py-16 sm:py-24 bg-samurai-light">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-samurai-navy mb-12 text-center">
            📖 毎日の問題
          </h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white p-8 rounded-lg shadow-md">
              <h3 className="text-xl font-bold text-samurai-navy mb-4">
                今日の問題
              </h3>
              <div className="bg-samurai-light p-6 rounded mb-4 min-h-[150px] flex items-center justify-center">
                <p className="text-gray-600 text-center">
                  毎日10:00に問題を配信します。<br />
                  SNSとホームページで同時配信。
                </p>
              </div>
              <a
                href={instagramLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-samurai-navy font-bold hover:text-samurai-gold transition"
              >
                → Instagramで確認
              </a>
            </div>
            <div className="bg-white p-8 rounded-lg shadow-md">
              <h3 className="text-xl font-bold text-samurai-navy mb-4">
                回答・解説
              </h3>
              <div className="bg-samurai-light p-6 rounded mb-4 min-h-[150px] flex items-center justify-center">
                <p className="text-gray-600 text-center">
                  毎日20:00に回答と詳細な解説を配信。<br />
                  詳しく学べる内容で力がつきます。
                </p>
              </div>
              <a
                href={xLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-samurai-navy font-bold hover:text-samurai-gold transition"
              >
                → Xで確認
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Book Section */}
      <section id="books" className="py-16 sm:py-24 bg-white">
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

      {/* 6. SNS Embed Section */}
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

"use client";

import { useState } from "react";

interface PreviewData {
  instagram?: {
    image: string;
    caption: string;
    dimensions: string;
  };
  x?: {
    tweets: { text: string; characterCount: number }[];
    totalCharacters: number;
  };
  hp?: {
    html: string;
    urlFull: string;
  };
}

export default function PreviewPage() {
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [selectedTab, setSelectedTab] = useState<"instagram" | "x" | "hp">("instagram");
  const [loading, setLoading] = useState(false);
  const [questionId, setQuestionId] = useState("q_20261120_001");

  const fetchPreview = async (platform: "instagram" | "x" | "hp") => {
    setLoading(true);
    try {
      const response = await fetch(`/api/cms/preview/${platform}/${questionId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
        },
      });
      const data = await response.json();
      if (data.success) {
        setPreviewData((prev) => ({ ...prev, [platform]: data.data }));
      }
    } catch (err) {
      console.error(`Failed to fetch ${platform} preview:`, err);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateAll = async () => {
    setLoading(true);
    await Promise.all(["instagram", "x", "hp"].map((p) => fetchPreview(p as any)));
    setLoading(false);
  };

  return (
    <div>
      <h1 className="text-4xl font-bold text-samurai-navy mb-8">SNS プレビュー生成</h1>

      {/* 設定エリア */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="mb-4">
          <label className="block text-sm font-bold text-gray-900 mb-2">
            問題 ID
          </label>
          <input
            type="text"
            value={questionId}
            onChange={(e) => setQuestionId(e.target.value)}
            placeholder="q_20261120_001"
            className="w-full p-2 border border-gray-300 rounded-lg"
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => fetchPreview("instagram")}
            disabled={loading}
            className="flex-1 bg-pink-600 text-white font-bold py-2 rounded-lg hover:bg-pink-700 disabled:opacity-50 transition"
          >
            📸 Instagram
          </button>
          <button
            onClick={() => fetchPreview("x")}
            disabled={loading}
            className="flex-1 bg-black text-white font-bold py-2 rounded-lg hover:opacity-90 disabled:opacity-50 transition"
          >
            𝕏 X
          </button>
          <button
            onClick={() => fetchPreview("hp")}
            disabled={loading}
            className="flex-1 bg-blue-600 text-white font-bold py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
          >
            🌐 HP
          </button>
          <button
            onClick={handleGenerateAll}
            disabled={loading}
            className="bg-samurai-gold text-black font-bold px-6 rounded-lg hover:opacity-90 disabled:opacity-50 transition"
          >
            {loading ? "生成中..." : "✨ すべて生成"}
          </button>
        </div>
      </div>

      {/* プレビュータブ */}
      <div className="flex gap-2 mb-6">
        {["instagram", "x", "hp"].map((tab) => (
          <button
            key={tab}
            onClick={() => setSelectedTab(tab as any)}
            className={`px-4 py-2 rounded-lg font-bold transition ${
              selectedTab === tab
                ? "bg-samurai-navy text-white"
                : "bg-white text-gray-900 border border-gray-200 hover:border-samurai-navy"
            }`}
          >
            {tab === "instagram"
              ? "📸 Instagram"
              : tab === "x"
                ? "𝕏 X"
                : "🌐 ホームページ"}
          </button>
        ))}
      </div>

      {/* Instagram プレビュー */}
      {selectedTab === "instagram" && previewData?.instagram && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-bold text-samurai-navy mb-4">📸 Instagram プレビュー</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex justify-center">
              <div
                className="w-80 aspect-[9/13.5] border-8 border-black rounded-3xl overflow-hidden shadow-2xl"
                style={{
                  backgroundImage: `url('${previewData.instagram.image}')`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 mb-2">キャプション</h3>
              <p className="text-gray-700 whitespace-pre-wrap mb-4">{previewData.instagram.caption}</p>
              <p className="text-sm text-gray-600">
                サイズ: {previewData.instagram.dimensions}
              </p>
              <div className="mt-4 flex gap-2">
                <a
                  href={previewData.instagram.image}
                  download="instagram-preview.png"
                  className="flex-1 bg-pink-600 text-white font-bold py-2 rounded-lg text-center hover:bg-pink-700 transition"
                >
                  ⬇️ ダウンロード
                </a>
                <button className="flex-1 bg-gray-200 text-gray-900 font-bold py-2 rounded-lg hover:bg-gray-300 transition">
                  📋 コピー
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* X プレビュー */}
      {selectedTab === "x" && previewData?.x && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-bold text-samurai-navy mb-4">𝕏 スレッド プレビュー</h2>
          <div className="space-y-4">
            {previewData.x.tweets.map((tweet, idx) => (
              <div key={idx} className="p-4 border border-gray-300 rounded-lg bg-gray-50">
                <p className="text-sm text-gray-600 mb-2">
                  ツイート {idx + 1}/{previewData.x!.tweets.length}
                </p>
                <p className="text-gray-900 mb-2 whitespace-pre-wrap">{tweet.text}</p>
                <p className="text-xs text-gray-500">
                  文字数: {tweet.characterCount}/280
                </p>
              </div>
            ))}
            <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-900">
                合計文字数: {previewData.x.totalCharacters} / {previewData.x.tweets.length * 280}
              </p>
            </div>
            <button className="w-full bg-black text-white font-bold py-2 rounded-lg hover:opacity-90 transition">
              📋 スレッドをコピー
            </button>
          </div>
        </div>
      )}

      {/* HP プレビュー */}
      {selectedTab === "hp" && previewData?.hp && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-samurai-navy mb-4">🌐 ホームページ プレビュー</h2>
          <div className="mb-4">
            <p className="text-sm text-gray-600 mb-2">URL</p>
            <p className="text-gray-900 font-mono bg-gray-50 p-3 rounded-lg break-all">
              {previewData.hp.urlFull}
            </p>
          </div>
          <div className="border border-gray-300 rounded-lg overflow-hidden mb-4">
            <div className="bg-gray-50 p-1 border-b border-gray-300 flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
            </div>
            <iframe
              srcDoc={previewData.hp.html}
              className="w-full h-96"
              title="HP Preview"
            />
          </div>
          <div className="flex gap-2">
            <a
              href={previewData.hp.urlFull}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 bg-blue-600 text-white font-bold py-2 rounded-lg text-center hover:bg-blue-700 transition"
            >
              🔗 リンクを開く
            </a>
            <button className="flex-1 bg-gray-200 text-gray-900 font-bold py-2 rounded-lg hover:bg-gray-300 transition">
              📋 URLをコピー
            </button>
          </div>
        </div>
      )}

      {/* 注意メッセージ */}
      <div className="mt-8 bg-yellow-50 border border-yellow-300 rounded-lg p-4">
        <p className="text-sm text-yellow-800">
          <strong>⚠️ 注意:</strong> このページはプロトタイプです。実際の配信前にプレビューを確認してください。
        </p>
      </div>
    </div>
  );
}

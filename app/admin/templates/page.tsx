"use client";

import { useState } from "react";

interface Template {
  id: string;
  name: string;
  platform: "instagram" | "x" | "hp";
  isDefault: boolean;
}

const mockTemplates: Template[] = [
  { id: "tpl_ig_default", name: "デフォルト", platform: "instagram", isDefault: true },
  { id: "tpl_ig_dark", name: "ダークモード", platform: "instagram", isDefault: false },
  { id: "tpl_x_default", name: "デフォルト", platform: "x", isDefault: true },
  { id: "tpl_x_casual", name: "カジュアル", platform: "x", isDefault: false },
  { id: "tpl_hp_default", name: "デフォルト", platform: "hp", isDefault: true },
];

export default function TemplatesPage() {
  const [templates] = useState<Template[]>(mockTemplates);
  const [selectedPlatform, setSelectedPlatform] = useState<"all" | "instagram" | "x" | "hp">(
    "all"
  );
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [editMode, setEditMode] = useState(false);

  const filteredTemplates =
    selectedPlatform === "all"
      ? templates
      : templates.filter((t) => t.platform === selectedPlatform);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-4xl font-bold text-samurai-navy">テンプレート管理</h1>
        <button className="bg-samurai-gold text-black font-bold py-2 px-6 rounded-lg hover:opacity-90 transition">
          ➕ 新規作成
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* テンプレート一覧 */}
        <div className="lg:col-span-1 bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-samurai-navy mb-4">テンプレート一覧</h2>

          {/* フィルター */}
          <div className="flex gap-2 mb-4">
            {["all", "instagram", "x", "hp"].map((platform) => (
              <button
                key={platform}
                onClick={() => setSelectedPlatform(platform as any)}
                className={`px-3 py-1 rounded text-xs font-bold transition ${
                  selectedPlatform === platform
                    ? "bg-samurai-navy text-white"
                    : "bg-gray-200 text-gray-900 hover:bg-gray-300"
                }`}
              >
                {platform === "all"
                  ? "すべて"
                  : platform === "instagram"
                    ? "📸"
                    : platform === "x"
                      ? "𝕏"
                      : "🌐"}
              </button>
            ))}
          </div>

          {/* テンプレート一覧 */}
          <div className="space-y-2">
            {filteredTemplates.map((template) => (
              <div
                key={template.id}
                onClick={() => {
                  setSelectedTemplate(template);
                  setEditMode(false);
                }}
                className={`p-3 rounded-lg border-2 cursor-pointer transition ${
                  selectedTemplate?.id === template.id
                    ? "border-samurai-navy bg-blue-50"
                    : "border-gray-200 hover:border-samurai-navy bg-white"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-gray-900 text-sm">{template.name}</p>
                    <p className="text-xs text-gray-600 capitalize">
                      {template.platform === "hp" ? "ホームページ" : template.platform}
                    </p>
                  </div>
                  {template.isDefault && (
                    <span className="text-xs bg-blue-200 text-blue-800 px-2 py-1 rounded-full font-bold">
                      デフォルト
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* テンプレートエディター */}
        <div className="lg:col-span-2">
          {selectedTemplate ? (
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-samurai-navy">{selectedTemplate.name}</h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditMode(!editMode)}
                    className="bg-samurai-navy text-white font-bold py-2 px-4 rounded-lg hover:opacity-90 transition"
                  >
                    {editMode ? "✅ 完了" : "✏️ 編集"}
                  </button>
                  {!selectedTemplate.isDefault && (
                    <button className="bg-red-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-red-700 transition">
                      🗑️ 削除
                    </button>
                  )}
                </div>
              </div>

              {/* Instagram テンプレート設定 */}
              {selectedTemplate.platform === "instagram" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-900 mb-2">
                        背景色
                      </label>
                      <input
                        type="color"
                        defaultValue="#ffffff"
                        disabled={!editMode}
                        className="w-full h-10 rounded-lg cursor-pointer"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-900 mb-2">
                        テキスト色
                      </label>
                      <input
                        type="color"
                        defaultValue="#082D6B"
                        disabled={!editMode}
                        className="w-full h-10 rounded-lg cursor-pointer"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-900 mb-2">
                        アクセント色
                      </label>
                      <input
                        type="color"
                        defaultValue="#FFD600"
                        disabled={!editMode}
                        className="w-full h-10 rounded-lg cursor-pointer"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-900 mb-2">
                        ヘッダーテキスト
                      </label>
                      <input
                        type="text"
                        defaultValue="🥋 侍日本語ラボ"
                        disabled={!editMode}
                        className="w-full p-2 border border-gray-300 rounded-lg disabled:bg-gray-100"
                      />
                    </div>
                  </div>

                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h3 className="font-bold text-gray-900 mb-3">プレビュー</h3>
                    <div className="bg-white border-4 border-black rounded-2xl w-48 h-72 mx-auto bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
                      <div className="text-center text-gray-500 text-sm">
                        <p>プレビュー</p>
                        <p className="text-xs mt-2">(実装中)</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* X テンプレート設定 */}
              {selectedTemplate.platform === "x" && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-900 mb-2">
                      ツイート 1 フォーマット
                    </label>
                    <textarea
                      defaultValue="🥋 本日の日本語問題..."
                      disabled={!editMode}
                      className="w-full p-2 border border-gray-300 rounded-lg h-20 disabled:bg-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-900 mb-2">
                      ハッシュタグ
                    </label>
                    <input
                      type="text"
                      defaultValue="#日本語学習 #日本語"
                      disabled={!editMode}
                      className="w-full p-2 border border-gray-300 rounded-lg disabled:bg-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-900 mb-2">
                      スタイル
                    </label>
                    <select disabled={!editMode} className="w-full p-2 border border-gray-300 rounded-lg disabled:bg-gray-100">
                      <option>フォーマル</option>
                      <option>カジュアル</option>
                      <option>絵文字多用</option>
                    </select>
                  </div>
                </div>
              )}

              {/* HP テンプレート設定 */}
              {selectedTemplate.platform === "hp" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-900 mb-2">
                        背景色
                      </label>
                      <input
                        type="color"
                        defaultValue="#ffffff"
                        disabled={!editMode}
                        className="w-full h-10 rounded-lg cursor-pointer"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-900 mb-2">
                        最大幅 (px)
                      </label>
                      <input
                        type="number"
                        defaultValue={800}
                        disabled={!editMode}
                        className="w-full p-2 border border-gray-300 rounded-lg disabled:bg-gray-100"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-900 mb-2">
                      ボタンスタイル
                    </label>
                    <select disabled={!editMode} className="w-full p-2 border border-gray-300 rounded-lg disabled:bg-gray-100">
                      <option>プライマリ</option>
                      <option>セカンダリ</option>
                      <option>アウトライン</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow p-6 flex items-center justify-center h-96">
              <div className="text-center text-gray-500">
                <p className="text-lg mb-2">テンプレートを選択してください</p>
                <p className="text-sm">左からテンプレートを選択して、設定を編集できます</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 注意メッセージ */}
      <div className="mt-8 bg-yellow-50 border border-yellow-300 rounded-lg p-4">
        <p className="text-sm text-yellow-800">
          <strong>⚠️ 注意:</strong>
          このページはプロトタイプです。実際のテンプレート保存は API
          連携で実装予定です。
        </p>
      </div>
    </div>
  );
}

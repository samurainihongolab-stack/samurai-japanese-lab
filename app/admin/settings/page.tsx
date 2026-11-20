"use client";

import { useState } from "react";

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    instagramEnabled: true,
    xEnabled: true,
    hpEnabled: true,
    requiredApprovals: 2,
    rateLimitPerMinute: 100,
    notificationsEnabled: true,
  });

  const handleToggle = (key: keyof typeof settings) => {
    setSettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  return (
    <div>
      <h1 className="text-4xl font-bold text-samurai-navy mb-8">設定</h1>

      <div className="max-w-2xl">
        {/* プラットフォーム設定 */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-bold text-samurai-navy mb-6">配信プラットフォーム設定</h2>

          <div className="space-y-4">
            {[
              { key: "instagramEnabled", label: "📸 Instagram", description: "Instagram Graph API" },
              { key: "xEnabled", label: "𝕏 X", description: "X (Twitter) API" },
              { key: "hpEnabled", label: "🌐 ホームページ", description: "独自サイト配信" },
            ].map((platform) => (
              <div key={platform.key} className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-bold text-gray-900">{platform.label}</p>
                  <p className="text-sm text-gray-600">{platform.description}</p>
                </div>
                <button
                  onClick={() => handleToggle(platform.key as keyof typeof settings)}
                  className={`w-12 h-6 rounded-full transition ${
                    settings[platform.key as keyof typeof settings]
                      ? "bg-green-500"
                      : "bg-gray-300"
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white transition transform ${
                      settings[platform.key as keyof typeof settings] ? "translate-x-6" : "translate-x-1"
                    }`}
                  ></div>
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* 承認フロー設定 */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-bold text-samurai-navy mb-6">承認フロー設定</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-900 mb-2">
                必要な承認者数
              </label>
              <select
                value={settings.requiredApprovals}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    requiredApprovals: parseInt(e.target.value),
                  }))
                }
                className="w-full p-2 border border-gray-300 rounded-lg"
              >
                <option value={1}>1人</option>
                <option value={2}>2人</option>
                <option value={3}>3人</option>
              </select>
              <p className="text-xs text-gray-600 mt-1">
                現在: {settings.requiredApprovals}人の承認が必要です
              </p>
            </div>
          </div>
        </div>

        {/* API 設定 */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-bold text-samurai-navy mb-6">API 設定</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-900 mb-2">
                レート制限 (リクエスト/分)
              </label>
              <input
                type="number"
                value={settings.rateLimitPerMinute}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    rateLimitPerMinute: parseInt(e.target.value),
                  }))
                }
                className="w-full p-2 border border-gray-300 rounded-lg"
              />
              <p className="text-xs text-gray-600 mt-1">
                現在: {settings.rateLimitPerMinute} リクエスト/分
              </p>
            </div>
          </div>
        </div>

        {/* 通知設定 */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-bold text-samurai-navy mb-6">通知設定</h2>

          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <p className="font-bold text-gray-900">📧 メール通知</p>
              <p className="text-sm text-gray-600">承認が必要な時にメール通知を受け取る</p>
            </div>
            <button
              onClick={() => handleToggle("notificationsEnabled")}
              className={`w-12 h-6 rounded-full transition ${
                settings.notificationsEnabled ? "bg-green-500" : "bg-gray-300"
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white transition transform ${
                  settings.notificationsEnabled ? "translate-x-6" : "translate-x-1"
                }`}
              ></div>
            </button>
          </div>
        </div>

        {/* 保存ボタン */}
        <div className="flex gap-2">
          <button className="flex-1 bg-samurai-navy text-white font-bold py-2 rounded-lg hover:opacity-90 transition">
            💾 保存
          </button>
          <button className="flex-1 bg-gray-200 text-gray-900 font-bold py-2 rounded-lg hover:opacity-90 transition">
            ↺ リセット
          </button>
        </div>
      </div>

      {/* 注意メッセージ */}
      <div className="mt-8 bg-yellow-50 border border-yellow-300 rounded-lg p-4">
        <p className="text-sm text-yellow-800">
          <strong>⚠️ 注意:</strong> このページはプロトタイプです。実際の設定保存は API 連携で実装予定です。
        </p>
      </div>
    </div>
  );
}

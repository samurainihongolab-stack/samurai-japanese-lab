"use client";

import { useState, useEffect } from "react";

interface StatsData {
  views: number;
  clicks: number;
  quizStarts: number;
  quizCompletions: number;
  explanationViews: number;
  bookViews: number;
  amazonClicks: number;
  ctr: number;
  completionRate: number;
  sourceBreakdown: Record<string, number>;
  eventBreakdown: Record<string, number>;
  hourlyData: Record<string, number>;
  totalEvents: number;
}

export default function AnalyticsPage() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [questionId, setQuestionId] = useState("q_20261120_001");
  const [dateRange, setDateRange] = useState({ start: "2026-11-13", end: "2026-11-20" });

  const fetchStats = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/analytics/stats?questionId=${questionId}&startDate=${dateRange.start}&endDate=${dateRange.end}`,
        { credentials: "same-origin" }
      );
      const data = await response.json();
      if (data.success) {
        setStats(data.data);
      }
    } catch (err) {
      console.error("Failed to fetch stats:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Load mock data on component mount
    setStats({
      views: 1250,
      clicks: 125,
      quizStarts: 450,
      quizCompletions: 290,
      explanationViews: 215,
      bookViews: 85,
      amazonClicks: 15,
      ctr: 0.1,
      completionRate: 0.64,
      sourceBreakdown: { instagram: 450, x: 300, hp: 250, direct: 250 },
      eventBreakdown: {
        page_view: 1250,
        quiz_start: 450,
        quiz_submit: 290,
        explanation_view: 215,
        amazon_outbound_click: 15,
      },
      hourlyData: {
        "2026-11-20T00": 50,
        "2026-11-20T01": 45,
        "2026-11-20T02": 30,
        "2026-11-20T03": 25,
        "2026-11-20T04": 35,
        "2026-11-20T05": 55,
      },
      totalEvents: 2555,
    });
  }, []);

  return (
    <div>
      <h1 className="text-4xl font-bold text-samurai-navy mb-8">分析</h1>

      {/* 検索フォーム */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-bold text-gray-900 mb-2">問題 ID</label>
            <input
              type="text"
              value={questionId}
              onChange={(e) => setQuestionId(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-900 mb-2">開始日</label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange((prev) => ({ ...prev, start: e.target.value }))}
              className="w-full p-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-900 mb-2">終了日</label>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange((prev) => ({ ...prev, end: e.target.value }))}
              className="w-full p-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={fetchStats}
              disabled={loading}
              className="w-full bg-samurai-navy text-white font-bold py-2 rounded-lg hover:opacity-90 disabled:opacity-50 transition"
            >
              {loading ? "読み込み中..." : "🔍 検索"}
            </button>
          </div>
        </div>
      </div>

      {stats && (
        <>
          {/* KPI カード */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            {[
              { label: "ページビュー", value: stats.views.toLocaleString(), icon: "👁️" },
              {
                label: "クリック率",
                value: `${(stats.ctr * 100).toFixed(1)}%`,
                icon: "🔗",
              },
              {
                label: "クイズ開始",
                value: stats.quizStarts.toLocaleString(),
                icon: "🎯",
              },
              {
                label: "完了率",
                value: `${(stats.completionRate * 100).toFixed(1)}%`,
                icon: "✅",
              },
            ].map((kpi, idx) => (
              <div key={idx} className="bg-white rounded-lg shadow p-6">
                <p className="text-3xl mb-2">{kpi.icon}</p>
                <p className="text-gray-600 text-sm">{kpi.label}</p>
                <p className="text-3xl font-bold text-samurai-navy mt-2">{kpi.value}</p>
              </div>
            ))}
          </div>

          {/* グラフエリア */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* 配信元別 */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-samurai-navy mb-4">配信元別トラフィック</h2>
              <div className="space-y-3">
                {Object.entries(stats.sourceBreakdown)
                  .sort(([, a], [, b]) => b - a)
                  .map(([source, count]) => {
                    const total = Object.values(stats.sourceBreakdown).reduce((a, b) => a + b, 0);
                    const percentage = ((count / total) * 100).toFixed(1);
                    return (
                      <div key={source}>
                        <div className="flex justify-between mb-1">
                          <p className="text-sm font-medium text-gray-900 capitalize">
                            {source === "hp" ? "ホームページ" : source === "x" ? "X" : source}
                          </p>
                          <p className="text-sm font-bold text-gray-900">{percentage}%</p>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-samurai-gold h-2 rounded-full transition"
                            style={{ width: `${percentage}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* イベント分布 */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-samurai-navy mb-4">イベント分布</h2>
              <div className="space-y-2">
                {[
                  { name: "page_view", label: "ページビュー", icon: "👁️", value: stats.views },
                  { name: "quiz_start", label: "クイズ開始", icon: "🎯", value: stats.quizStarts },
                  {
                    name: "quiz_submit",
                    label: "クイズ完了",
                    icon: "✅",
                    value: stats.quizCompletions,
                  },
                  {
                    name: "explanation_view",
                    label: "解説表示",
                    icon: "📖",
                    value: stats.explanationViews,
                  },
                ].map((event) => (
                  <div key={event.name} className="flex items-center justify-between p-2">
                    <span className="text-sm font-medium text-gray-900">
                      {event.icon} {event.label}
                    </span>
                    <span className="font-bold text-samurai-navy">{event.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 詳細メトリクス */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-bold text-samurai-navy mb-4">詳細メトリクス</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "総クリック", value: stats.clicks, icon: "🔗" },
                { label: "解説表示", value: stats.explanationViews, icon: "📖" },
                { label: "書籍表示", value: stats.bookViews, icon: "📚" },
                { label: "Amazon クリック", value: stats.amazonClicks, icon: "🛒" },
              ].map((metric, idx) => (
                <div
                  key={idx}
                  className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg"
                >
                  <p className="text-2xl mb-2">{metric.icon}</p>
                  <p className="text-xs text-gray-600">{metric.label}</p>
                  <p className="text-2xl font-bold text-samurai-navy">{metric.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 統計情報 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-samurai-navy mb-4">統計情報</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">総イベント数</p>
                <p className="text-3xl font-bold text-samurai-navy mt-2">{stats.totalEvents}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">ユニークユーザー</p>
                <p className="text-3xl font-bold text-samurai-navy mt-2">
                  {Math.ceil(stats.totalEvents * 0.7)}
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* 注意メッセージ */}
      <div className="mt-8 bg-yellow-50 border border-yellow-300 rounded-lg p-4">
        <p className="text-sm text-yellow-800">
          <strong>⚠️ 注意:</strong> このページはプロトタイプです。実際の Analytics API
          との統合は実装予定です。
        </p>
      </div>
    </div>
  );
}

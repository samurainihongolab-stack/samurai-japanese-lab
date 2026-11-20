"use client";

export default function AnalyticsPage() {
  return (
    <div>
      <h1 className="text-4xl font-bold text-samurai-navy mb-8">分析</h1>

      {/* KPI カード */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        {[
          { label: "総ページビュー", value: "12.5k", change: "+15%" },
          { label: "総クリック数", value: "1.2k", change: "+8%" },
          { label: "クイズ開始", value: "450", change: "+22%" },
          { label: "完了率", value: "65%", change: "+5%" },
        ].map((kpi, idx) => (
          <div key={idx} className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600 text-sm">{kpi.label}</p>
            <p className="text-3xl font-bold text-samurai-navy mt-2">{kpi.value}</p>
            <p className="text-green-600 text-sm mt-2">{kpi.change}</p>
          </div>
        ))}
      </div>

      {/* グラフエリア */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-samurai-navy mb-4">ページビュー (7日間)</h2>
          <div className="bg-gray-50 rounded-lg p-8 text-center text-gray-600 h-64 flex items-center justify-center">
            グラフ表示（開発中）
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-samurai-navy mb-4">配信元別トラフィック</h2>
          <div className="space-y-3">
            {[
              { source: "Instagram", percentage: 45 },
              { source: "X", percentage: 30 },
              { source: "HP", percentage: 20 },
              { source: "Direct", percentage: 5 },
            ].map((item) => (
              <div key={item.source}>
                <div className="flex justify-between mb-1">
                  <p className="text-sm font-medium text-gray-900">{item.source}</p>
                  <p className="text-sm font-bold text-gray-900">{item.percentage}%</p>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-samurai-gold h-2 rounded-full"
                    style={{ width: `${item.percentage}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* イベント一覧 */}
      <div className="mt-6 bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-samurai-navy mb-4">最近のイベント</h2>
        <div className="space-y-2">
          {[
            "👁️ ページビュー: 150",
            "🔗 クリック: 12",
            "🎯 クイズ開始: 5",
            "✅ クイズ完了: 3",
            "📖 解説表示: 2",
          ].map((event, idx) => (
            <div key={idx} className="p-3 bg-gray-50 rounded-lg text-sm text-gray-700">
              {event}
            </div>
          ))}
        </div>
      </div>

      {/* 注意メッセージ */}
      <div className="mt-8 bg-yellow-50 border border-yellow-300 rounded-lg p-4">
        <p className="text-sm text-yellow-800">
          <strong>⚠️ 注意:</strong> このページはプロトタイプです。実際の分析データは Phase 2e で実装予定です。
        </p>
      </div>
    </div>
  );
}

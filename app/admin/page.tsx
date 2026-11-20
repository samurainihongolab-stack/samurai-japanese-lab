"use client";

export default function AdminDashboard() {
  return (
    <div>
      <h1 className="text-4xl font-bold text-samurai-navy mb-8">ダッシュボード</h1>

      {/* KPI カード */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        {[
          { label: "今月の配信済み", value: "12", icon: "📤" },
          { label: "保留中の承認", value: "3", icon: "⏳" },
          { label: "下書き中", value: "7", icon: "✍️" },
          { label: "総アクセス数", value: "2.3k", icon: "👁️" },
        ].map((kpi, idx) => (
          <div key={idx} className="bg-white rounded-lg shadow p-6">
            <div className="text-3xl mb-2">{kpi.icon}</div>
            <p className="text-gray-600 text-sm">{kpi.label}</p>
            <p className="text-3xl font-bold text-samurai-navy">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* 最近の活動 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* 最近の下書き */}
        <div className="bg-white rounded-lg shadow p-6 lg:col-span-2">
          <h2 className="text-xl font-bold text-samurai-navy mb-4">最近の下書き</h2>
          <div className="space-y-3">
            {[
              { title: "文法: 敬語の使い分け", status: "draft", date: "11/20" },
              { title: "読解: ビジネス文書の読み方", status: "in_review", date: "11/19" },
              { title: "聴解: 講演のポイント抽出", status: "draft", date: "11/18" },
            ].map((item, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">{item.title}</p>
                  <p className="text-sm text-gray-500">{item.date}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                  item.status === "draft" ? "bg-gray-200 text-gray-800" : "bg-yellow-200 text-yellow-800"
                }`}>
                  {item.status === "draft" ? "下書き" : "確認中"}
                </span>
              </div>
            ))}
          </div>
          <a href="/admin/questions" className="mt-4 inline-block text-samurai-navy font-bold hover:text-samurai-gold">
            → すべての問題を見る
          </a>
        </div>

        {/* 承認が必要 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-samurai-navy mb-4">承認が必要</h2>
          <div className="space-y-3">
            {[
              { author: "編集者 A", time: "2時間前" },
              { author: "編集者 B", time: "5時間前" },
              { author: "編集者 C", time: "1日前" },
            ].map((item, idx) => (
              <div key={idx} className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <p className="font-medium text-sm">{item.author}</p>
                <p className="text-xs text-gray-600">{item.time}</p>
              </div>
            ))}
          </div>
          <button className="w-full mt-4 bg-samurai-gold text-black font-bold py-2 rounded-lg hover:opacity-90 transition">
            承認ページへ
          </button>
        </div>
      </div>

      {/* 予定された配信 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-samurai-navy mb-4">予定された配信</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4 font-bold">問題</th>
                <th className="text-left py-3 px-4 font-bold">配信先</th>
                <th className="text-left py-3 px-4 font-bold">予定時刻</th>
                <th className="text-left py-3 px-4 font-bold">ステータス</th>
              </tr>
            </thead>
            <tbody>
              {[
                { problem: "敬語の使い分け", channels: "Instagram, X", time: "明日 10:00", status: "pending" },
                { problem: "ビジネス文書", channels: "HP, Instagram", time: "明日 20:00", status: "pending" },
                { problem: "講演のポイント", channels: "X", time: "2日後 10:00", status: "scheduled" },
              ].map((row, idx) => (
                <tr key={idx} className="border-b hover:bg-gray-50">
                  <td className="py-3 px-4">{row.problem}</td>
                  <td className="py-3 px-4 text-sm">{row.channels}</td>
                  <td className="py-3 px-4">{row.time}</td>
                  <td className="py-3 px-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      row.status === "pending" ? "bg-blue-200 text-blue-800" : "bg-green-200 text-green-800"
                    }`}>
                      {row.status === "pending" ? "待機中" : "スケジュール済み"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 注意メッセージ */}
      <div className="mt-8 bg-yellow-50 border border-yellow-300 rounded-lg p-4">
        <p className="text-sm text-yellow-800">
          <strong>⚠️ 注意:</strong> このダッシュボードはプロトタイプです。実際のデータベース接続とAPI連携は Phase 2b で実装予定です。
        </p>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";

interface PublicationJob {
  id: string;
  question: string;
  channels: string[];
  scheduledTime: string;
  status: "pending" | "publishing" | "completed" | "failed";
}

const mockJobs: PublicationJob[] = [
  {
    id: "job_001",
    question: "文法: 敬語の使い分け",
    channels: ["Instagram", "X"],
    scheduledTime: "明日 10:00",
    status: "pending",
  },
  {
    id: "job_002",
    question: "読解: ビジネス文書",
    channels: ["HP", "Instagram"],
    scheduledTime: "明日 20:00",
    status: "pending",
  },
  {
    id: "job_003",
    question: "聴解: 講演のポイント",
    channels: ["X"],
    scheduledTime: "2日後 10:00",
    status: "pending",
  },
  {
    id: "job_004",
    question: "文法: 因果関係の表現",
    channels: ["Instagram", "X", "HP"],
    scheduledTime: "11/19 15:00",
    status: "completed",
  },
];

export default function SchedulePage() {
  const [jobs] = useState<PublicationJob[]>(mockJobs);

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-blue-200 text-blue-800",
      publishing: "bg-yellow-200 text-yellow-800",
      completed: "bg-green-200 text-green-800",
      failed: "bg-red-200 text-red-800",
    };
    const labels: Record<string, string> = {
      pending: "待機中",
      publishing: "配信中",
      completed: "完了",
      failed: "失敗",
    };
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-bold ${colors[status] || "bg-gray-200"}`}>
        {labels[status] || status}
      </span>
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-4xl font-bold text-samurai-navy">配信スケジュール</h1>
        <button className="bg-samurai-gold text-black font-bold py-2 px-6 rounded-lg hover:opacity-90 transition">
          📅 新規スケジュール
        </button>
      </div>

      {/* 予定一覧 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left py-4 px-6 font-bold text-gray-900">問題</th>
              <th className="text-left py-4 px-6 font-bold text-gray-900">配信先</th>
              <th className="text-left py-4 px-6 font-bold text-gray-900">予定時刻</th>
              <th className="text-left py-4 px-6 font-bold text-gray-900">ステータス</th>
              <th className="text-left py-4 px-6 font-bold text-gray-900">アクション</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {jobs.map((job) => (
              <tr key={job.id} className="hover:bg-gray-50 transition">
                <td className="py-4 px-6 font-medium text-gray-900">{job.question}</td>
                <td className="py-4 px-6">
                  <div className="flex flex-wrap gap-2">
                    {job.channels.map((channel) => (
                      <span key={channel} className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-bold">
                        {channel}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="py-4 px-6 text-gray-600">{job.scheduledTime}</td>
                <td className="py-4 px-6">{getStatusBadge(job.status)}</td>
                <td className="py-4 px-6">
                  {job.status === "pending" && (
                    <div className="flex gap-2">
                      <button className="text-green-600 font-bold hover:text-green-700 transition">
                        ▶️ 実行
                      </button>
                      <button className="text-red-600 font-bold hover:text-red-700 transition">
                        ⏹️ キャンセル
                      </button>
                    </div>
                  )}
                  {job.status === "completed" && (
                    <button className="text-blue-600 font-bold hover:text-blue-700 transition">
                      📊 詳細
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* カレンダー表示 */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-samurai-navy mb-4">配信カレンダー</h2>
          <div className="bg-gray-50 rounded-lg p-4 text-center text-gray-600">
            カレンダー表示（開発中）
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-samurai-navy mb-4">統計</h2>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-gray-600">待機中</p>
              <p className="text-3xl font-bold text-blue-600">3</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">配信済み</p>
              <p className="text-3xl font-bold text-green-600">1</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">失敗</p>
              <p className="text-3xl font-bold text-red-600">0</p>
            </div>
          </div>
        </div>
      </div>

      {/* 注意メッセージ */}
      <div className="mt-8 bg-yellow-50 border border-yellow-300 rounded-lg p-4">
        <p className="text-sm text-yellow-800">
          <strong>⚠️ 注意:</strong> このページはプロトタイプです。実際の配信機能は Phase 2d で実装予定です。
        </p>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";

interface ApprovalItem {
  id: string;
  title: string;
  author: string;
  submittedAt: string;
  status: "pending" | "approved" | "rejected";
  approvals: number;
  requiredApprovals: number;
}

const mockApprovals: ApprovalItem[] = [
  {
    id: "q_001",
    title: "文法: 敬語の使い分け",
    author: "編集者 A",
    submittedAt: "11/20 10:30",
    status: "pending",
    approvals: 1,
    requiredApprovals: 2,
  },
  {
    id: "q_002",
    title: "読解: ビジネス文書の読み方",
    author: "編集者 B",
    submittedAt: "11/19 15:45",
    status: "pending",
    approvals: 0,
    requiredApprovals: 2,
  },
  {
    id: "q_003",
    title: "聴解: 講演のポイント抽出",
    author: "編集者 C",
    submittedAt: "11/18 09:15",
    status: "approved",
    approvals: 2,
    requiredApprovals: 2,
  },
];

export default function ApprovalFlowPage() {
  const [approvals] = useState<ApprovalItem[]>(mockApprovals);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const getStatusBadge = (status: string, approvals: number, required: number) => {
    if (status === "approved") {
      return <span className="px-3 py-1 rounded-full text-xs font-bold bg-green-200 text-green-800">承認済み</span>;
    }
    if (status === "rejected") {
      return <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-200 text-red-800">却下</span>;
    }
    return (
      <span className="px-3 py-1 rounded-full text-xs font-bold bg-yellow-200 text-yellow-800">
        {approvals}/{required} 承認
      </span>
    );
  };

  return (
    <div>
      <h1 className="text-4xl font-bold text-samurai-navy mb-8">承認フロー</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 承認キュー */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-samurai-navy mb-4">待機中の確認</h2>
          <div className="space-y-3">
            {approvals.map((item) => (
              <div
                key={item.id}
                onClick={() => setSelectedId(item.id)}
                className={`p-4 border rounded-lg cursor-pointer transition ${
                  selectedId === item.id
                    ? "border-samurai-navy bg-blue-50"
                    : "border-gray-200 hover:border-samurai-navy"
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-bold text-gray-900">{item.title}</p>
                    <p className="text-sm text-gray-600">
                      {item.author} · {item.submittedAt}
                    </p>
                  </div>
                  {getStatusBadge(item.status, item.approvals, item.requiredApprovals)}
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-samurai-gold h-2 rounded-full transition"
                    style={{
                      width: `${(item.approvals / item.requiredApprovals) * 100}%`,
                    }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 詳細ビュー */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-samurai-navy mb-4">詳細</h2>
          {selectedId ? (
            (() => {
              const item = approvals.find((a) => a.id === selectedId);
              return item ? (
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-gray-600 mb-1">タイトル</p>
                    <p className="font-bold text-gray-900">{item.title}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 mb-1">作成者</p>
                    <p className="text-gray-900">{item.author}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 mb-1">提出日時</p>
                    <p className="text-gray-900">{item.submittedAt}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 mb-2">承認進捗</p>
                    <div className="text-2xl font-bold text-samurai-navy mb-2">
                      {item.approvals}/{item.requiredApprovals}
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className="bg-samurai-gold h-3 rounded-full"
                        style={{
                          width: `${(item.approvals / item.requiredApprovals) * 100}%`,
                        }}
                      ></div>
                    </div>
                  </div>

                  {item.status === "pending" && (
                    <div className="flex gap-2 mt-6">
                      <button className="flex-1 bg-green-600 text-white font-bold py-2 rounded-lg hover:bg-green-700 transition">
                        ✅ 承認
                      </button>
                      <button className="flex-1 bg-red-600 text-white font-bold py-2 rounded-lg hover:bg-red-700 transition">
                        ❌ 却下
                      </button>
                    </div>
                  )}
                  {item.status === "approved" && (
                    <div className="mt-6 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-sm text-green-800">✅ すべての承認が完了しました</p>
                    </div>
                  )}
                </div>
              ) : null;
            })()
          ) : (
            <p className="text-gray-500 text-sm">項目を選択してください</p>
          )}
        </div>
      </div>

      {/* 注意メッセージ */}
      <div className="mt-8 bg-yellow-50 border border-yellow-300 rounded-lg p-4">
        <p className="text-sm text-yellow-800">
          <strong>⚠️ 注意:</strong> このページはプロトタイプです。実際の承認処理は API 連携で実装予定です。
        </p>
      </div>
    </div>
  );
}

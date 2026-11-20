"use client";

import { useState } from "react";

interface Question {
  id: string;
  title: string;
  author: string;
  createdAt: string;
  status: "draft" | "in_review" | "approved" | "published";
  difficulty: string;
}

const mockQuestions: Question[] = [
  {
    id: "q_001",
    title: "文法: 敬語の使い分け",
    author: "編集者 A",
    createdAt: "11/20",
    status: "in_review",
    difficulty: "初級",
  },
  {
    id: "q_002",
    title: "読解: ビジネス文書の読み方",
    author: "編集者 B",
    createdAt: "11/19",
    status: "draft",
    difficulty: "中級",
  },
  {
    id: "q_003",
    title: "聴解: 講演のポイント抽出",
    author: "編集者 C",
    createdAt: "11/18",
    status: "approved",
    difficulty: "上級",
  },
  {
    id: "q_004",
    title: "文法: 因果関係の表現",
    author: "編集者 A",
    createdAt: "11/17",
    status: "published",
    difficulty: "中級",
  },
];

export default function QuestionsPage() {
  const [questions] = useState<Question[]>(mockQuestions);
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const filteredQuestions =
    filterStatus === "all" ? questions : questions.filter((q) => q.status === filterStatus);

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: "bg-gray-200 text-gray-800",
      in_review: "bg-yellow-200 text-yellow-800",
      approved: "bg-green-200 text-green-800",
      published: "bg-blue-200 text-blue-800",
    };
    return colors[status] || "bg-gray-200 text-gray-800";
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      draft: "下書き",
      in_review: "確認中",
      approved: "承認済み",
      published: "配信済み",
    };
    return labels[status] || status;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-4xl font-bold text-samurai-navy">問題管理</h1>
        <button className="bg-samurai-gold text-black font-bold py-2 px-6 rounded-lg hover:opacity-90 transition">
          ➕ 新しい問題を作成
        </button>
      </div>

      {/* フィルター */}
      <div className="flex gap-2 mb-6">
        {["all", "draft", "in_review", "approved", "published"].map((status) => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            className={`px-4 py-2 rounded-lg font-bold transition ${
              filterStatus === status
                ? "bg-samurai-navy text-white"
                : "bg-white text-gray-900 border border-gray-200 hover:border-samurai-navy"
            }`}
          >
            {status === "all"
              ? "すべて"
              : status === "draft"
                ? "下書き"
                : status === "in_review"
                  ? "確認中"
                  : status === "approved"
                    ? "承認済み"
                    : "配信済み"}
          </button>
        ))}
      </div>

      {/* 問題一覧テーブル */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left py-4 px-6 font-bold text-gray-900">タイトル</th>
              <th className="text-left py-4 px-6 font-bold text-gray-900">作成者</th>
              <th className="text-left py-4 px-6 font-bold text-gray-900">難易度</th>
              <th className="text-left py-4 px-6 font-bold text-gray-900">作成日</th>
              <th className="text-left py-4 px-6 font-bold text-gray-900">ステータス</th>
              <th className="text-left py-4 px-6 font-bold text-gray-900">アクション</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredQuestions.map((question) => (
              <tr key={question.id} className="hover:bg-gray-50 transition">
                <td className="py-4 px-6 font-medium text-gray-900">{question.title}</td>
                <td className="py-4 px-6 text-gray-600">{question.author}</td>
                <td className="py-4 px-6 text-gray-600">{question.difficulty}</td>
                <td className="py-4 px-6 text-gray-600">{question.createdAt}</td>
                <td className="py-4 px-6">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusColor(question.status)}`}>
                    {getStatusLabel(question.status)}
                  </span>
                </td>
                <td className="py-4 px-6">
                  <button className="text-samurai-navy font-bold hover:text-samurai-gold transition">
                    ✏️ 編集
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 注意メッセージ */}
      <div className="mt-8 bg-yellow-50 border border-yellow-300 rounded-lg p-4">
        <p className="text-sm text-yellow-800">
          <strong>⚠️ 注意:</strong> このページはプロトタイプです。実際のデータ表示は API 連携で実装予定です。
        </p>
      </div>
    </div>
  );
}

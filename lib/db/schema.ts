/**
 * CMS Database Schema
 * 問題・承認・配信・分析のデータベーススキーマ定義
 */

// 問題テーブル
export interface Question {
  id: string; // q_YYYYMMDD_001 形式
  stem: string; // 問題文
  choices: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  correctChoice: "A" | "B" | "C" | "D"; // 正解
  explanation: string; // 解説
  tags: string[]; // カテゴリ: ["文法", "読解", "聴解"] など
  difficulty: "初級" | "中級" | "上級"; // 難易度
  source?: string; // 出典
  sourceNotes?: string; // 備考
  status: "draft" | "in_review" | "approved" | "scheduled" | "published" | "failed";
  createdAt: Date;
  createdBy: string; // 編集者ID
  reviewedBy?: string; // 校閲者ID
  reviewedAt?: Date;
  approvedBy?: string; // 承認者ID
  approvedAt?: Date;
  publishAt?: Date; // 予約配信時刻
  timezone: string; // "Asia/Tokyo"
  canonicalUrl?: string; // ホームページURL
}

// 質問バージョン管理（編集履歴）
export interface QuestionVersion {
  id: string;
  questionId: string;
  version: number;
  stem: string;
  choices: Question["choices"];
  correctChoice: string;
  explanation: string;
  tags: string[];
  difficulty: string;
  status: Question["status"];
  createdAt: Date;
  createdBy: string;
  changeLog: string; // 変更内容
}

// 配信チャネル設定
export interface PublicationChannel {
  id: string;
  name: "instagram" | "x" | "hp"; // プラットフォーム
  enabled: boolean;
  config: {
    // Instagram の場合
    instagramAccountId?: string;
    instagramAccessToken?: string;

    // X の場合
    xApiKey?: string;
    xApiSecret?: string;
    xAccessToken?: string;
    xAccessTokenSecret?: string;

    // HP の場合
    siteUrl?: string;
    apiEndpoint?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

// 配信ジョブ
export interface PublicationJob {
  id: string; // job_YYYYMMDD_HHMM
  questionId: string;
  channels: ("instagram" | "x" | "hp")[]; // 配信先
  scheduledAt: Date; // 予約時刻
  status: "pending" | "publishing" | "completed" | "failed";
  idempotencyKey: string; // 二重投稿防止用
  retryCount: number;
  maxRetries: number;
  error?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

// 配信試行ログ
export interface PublicationAttempt {
  id: string;
  jobId: string;
  channel: "instagram" | "x" | "hp";
  status: "success" | "failed" | "retrying";
  externalId?: string; // Instagram Post ID, Tweet ID など
  error?: string;
  responsePayload?: Record<string, unknown>;
  attemptedAt: Date;
}

// 承認フロー
export interface Approval {
  id: string;
  questionId: string;
  version: number;
  status: "pending" | "approved" | "rejected";
  reviewedBy: string;
  reviewNotes?: string;
  reviewedAt?: Date;
  requiredApprovals: number; // 承認者数の要件
  currentApprovals: number; // 現在の承認数
}

// SNS 画像アセット
export interface PublicationAsset {
  id: string;
  questionId: string;
  channel: "instagram" | "x" | "hp";
  contentType: "image/png" | "image/jpeg";
  url: string; // ストレージURL
  uploadedAt: Date;
  createdBy: string;
}

// 分析イベント
export interface AnalyticsEvent {
  id: string;
  eventName:
    | "page_view"
    | "social_outbound_click"
    | "quiz_start"
    | "quiz_submit"
    | "explanation_view"
    | "book_view"
    | "amazon_outbound_click";
  questionId?: string;
  source: "instagram" | "x" | "hp" | "direct";
  userId: string; // アノニマスID
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

// 監査ログ
export interface AuditLog {
  id: string;
  action:
    | "create"
    | "update"
    | "delete"
    | "approve"
    | "reject"
    | "publish"
    | "schedule";
  entity: "question" | "approval" | "job";
  entityId: string;
  userId: string;
  changes?: Record<string, { before: unknown; after: unknown }>;
  timestamp: Date;
  ipAddress?: string;
}

// API レスポンス型
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: Date;
}

# CMS API エンドポイント設計

## 認証
すべてのエンドポイントは JWT トークン認証が必須

```
Authorization: Bearer <jwt_token>
```

---

## 問題管理 API

### 1. 問題一覧取得
```
GET /api/cms/questions
Query: ?status=draft&tags=文法&page=1&limit=20
Response: { success: true, data: Question[], total: 100 }
```

### 2. 問題作成
```
POST /api/cms/questions
Body: {
  stem: "問題文...",
  choices: { A: "...", B: "...", C: "...", D: "..." },
  correctChoice: "A",
  explanation: "解説...",
  tags: ["文法"],
  difficulty: "初級",
  source: "試験2024年"
}
Response: { success: true, data: Question }
```

### 3. 問題更新（下書き編集）
```
PUT /api/cms/questions/:id
Body: { stem: "...", ... }
Response: { success: true, data: Question }
注: status=approved の場合は編集不可
```

### 4. 問題削除（下書きのみ）
```
DELETE /api/cms/questions/:id
Response: { success: true }
```

---

## 承認フロー API

### 1. 校閲用提出
```
POST /api/cms/questions/:id/submit-review
Body: { version: 1 }
Response: { success: true, data: { status: "in_review" } }
```

### 2. 承認/却下
```
POST /api/cms/approvals/:questionId/review
Body: {
  status: "approved" | "rejected",
  reviewNotes: "適切です" | "修正が必要です"
}
Response: { success: true, data: Approval }
```

### 3. 承認状況確認
```
GET /api/cms/questions/:id/approval-status
Response: {
  success: true,
  data: {
    status: "pending" | "approved" | "rejected",
    requiredApprovals: 2,
    currentApprovals: 1,
    reviewers: [{ name, status, reviewedAt }]
  }
}
```

---

## 配信スケジュール API

### 1. 配信予約
```
POST /api/cms/jobs/schedule
Body: {
  questionId: "q_20261120_001",
  channels: ["instagram", "x", "hp"],
  scheduledAt: "2026-11-21T10:00:00Z",
  timezone: "Asia/Tokyo"
}
Response: { success: true, data: PublicationJob }
```

### 2. 配信ジョブ一覧
```
GET /api/cms/jobs
Query: ?status=pending&startDate=2026-11-20&endDate=2026-12-20
Response: { success: true, data: PublicationJob[] }
```

### 3. 配信実行（手動トリガー）
```
POST /api/cms/jobs/:id/publish
Response: { success: true, data: { status: "publishing" } }
```

### 4. 配信キャンセル
```
POST /api/cms/jobs/:id/cancel
Response: { success: true }
注: status=pending の場合のみ
```

---

## プレビュー API

### 1. Instagram プレビュー
```
GET /api/cms/preview/instagram/:questionId
Response: {
  success: true,
  data: {
    image: "data:image/png;base64,...",
    caption: "投稿文",
    dimensions: "1080x1350"
  }
}
```

### 2. X プレビュー
```
GET /api/cms/preview/x/:questionId
Response: {
  success: true,
  data: {
    text: "スレッド文...",
    images: ["data:image/png;base64,..."],
    characterCount: 280
  }
}
```

### 3. ホームページプレビュー
```
GET /api/cms/preview/hp/:questionId
Response: {
  success: true,
  data: {
    html: "<div>...</div>",
    url: "/questions/q_20261120_001"
  }
}
```

---

## 分析 API

### 1. イベント記録
```
POST /api/analytics/events
Body: {
  eventName: "quiz_start",
  questionId: "q_20261120_001",
  source: "instagram",
  userId: "anonymous_xyz"
}
Response: { success: true }
```

### 2. 統計データ取得
```
GET /api/analytics/stats
Query: ?questionId=q_20261120_001&startDate=2026-11-20&endDate=2026-11-27
Response: {
  success: true,
  data: {
    views: 1500,
    clicks: 150,
    quizStarts: 50,
    quizCompletions: 30,
    explanationViews: 25,
    amazonClicks: 5,
    ctr: 0.10,
    completionRate: 0.60
  }
}
```

---

## 画像生成 API

### 1. Instagram 画像生成
```
POST /api/cms/assets/generate/instagram
Body: {
  questionId: "q_20261120_001",
  style: "light" | "dark"
}
Response: {
  success: true,
  data: {
    url: "https://assets.samurai-japanese-lab.vercel.app/...",
    assetId: "ast_xxx"
  }
}
```

### 2. X 画像生成
```
POST /api/cms/assets/generate/x
Body: { questionId: "q_20261120_001" }
Response: { success: true, data: { urls: [...] } }
```

---

## エラーハンドリング

### 400 Bad Request
```json
{
  "success": false,
  "error": "Invalid question format"
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "error": "Invalid or expired token"
}
```

### 403 Forbidden
```json
{
  "success": false,
  "error": "Approved questions cannot be edited"
}
```

### 429 Too Many Requests
```json
{
  "success": false,
  "error": "Rate limit exceeded",
  "retryAfter": 60
}
```

### 500 Server Error
```json
{
  "success": false,
  "error": "Internal server error",
  "requestId": "req_xyz"
}
```

---

## セキュリティ要件

- すべてのエンドポイントは HTTPS のみ
- API キーは環境変数で管理
- レート制限: 100 req/min（IP単位）
- CORS: 許可ドメインのみ
- 監査ログ: すべての変更を記録
- SQL インジェクション対策: パラメータ化クエリ

"use client";

import { useCallback, useEffect, useState } from "react";

type Log = { platform: string; status: string; attempts: number; external_url: string | null; last_error: string | null; next_retry_at: string | null } | null;
type Row = {
  id: string;
  slug: string;
  category: string;
  question: string;
  status: string;
  correct_answer: string;
  current_hash: string;
  choices?: Record<string, string>;
  explanation?: string;
  text_post?: { text: string | null; error: string | null };
  scheduled_at: string | null;
  reviewed_by: string | null;
  approved_by: string | null;
  issues: { level: string; message: string }[];
  ai_review: { verdict: string; reviewer: string; comments: string; at: string } | null;
  hash_ok: boolean | null;
  posts: Log[];
  errors: { platform: string; at: string; error: string | null; outcome: string }[];
};

const PLATFORM_LABEL: Record<string, string> = { threads: "Threads", x: "X", instagram: "Instagram" };
const PLATFORMS = ["threads", "x", "instagram"];
const STATUS_COLOR: Record<string, string> = {
  draft: "bg-gray-200 text-gray-800",
  reviewed: "bg-yellow-200 text-yellow-800",
  approved: "bg-blue-200 text-blue-800",
  published: "bg-green-200 text-green-800",
  succeeded: "bg-green-200 text-green-800",
  failed: "bg-red-200 text-red-800",
  unknown: "bg-orange-200 text-orange-800",
  sending: "bg-blue-200 text-blue-800",
};

export default function AdminQuizPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [mode, setMode] = useState("");
  const [msg, setMsg] = useState("");
  const [dbError, setDbError] = useState("");
  const [who, setWho] = useState("");
  const [confirmed, setConfirmed] = useState<Record<string, boolean>>({});
  const [sched, setSched] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/quiz");
    if (r.status === 401) return void (window.location.href = "/admin/login");
    const j = await r.json();
    if (r.status === 503) {
      setDbError(j.detail ?? "データベースに接続できません");
      setRows([]);
      return;
    }
    setDbError("");
    setRows(j.data ?? []);
    setMode(j.mode ?? "");
    setWho(j.user?.email ?? "");
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function act(body: Record<string, unknown>) {
    setMsg("");
    const r = await fetch("/api/admin/quiz", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json();
    setMsg(j.success ? (j.report?.note ?? (j.report ? "配信結果を更新しました。媒体別の状態を確認してください。" : "完了しました")) : r.status === 409 ? "⚠ 本文が変更されています。最新の内容を再表示しました。確認し直してから承認してください。" : "エラー: " + j.error);
    load();
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">SNSクイズ配信</h1>
      <p className="mb-4 text-sm">
        投稿モード: <span className={"px-2 py-0.5 rounded font-bold " + (mode === "live" ? "bg-red-600 text-white" : "bg-gray-300")}>{mode === "live" ? "LIVE（実投稿）" : "DRY RUN（模擬）"}</span>
        {msg && <span className="ml-4 text-blue-700">{msg}</span>}
      </p>
      {dbError && (
        <div className="mb-4 rounded border-2 border-red-600 bg-red-50 p-3 text-red-700 font-bold">⚠ データベース接続障害: {dbError}（問題が0件に見えている場合は「空」ではなく「取得失敗」です）</div>
      )}
      <div className="space-y-4">
        {rows.map((q) => (
          <div key={q.id} className="bg-white rounded-lg shadow p-4">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className={"px-2 py-0.5 rounded text-xs font-bold " + STATUS_COLOR[q.status]}>{q.status}</span>
              <span className="text-xs text-gray-500">{q.category}</span>
              <span className="text-xs text-gray-500">予約: {q.scheduled_at ? new Date(q.scheduled_at).toLocaleString("ja-JP") : "未設定"}</span>
              <span className="text-xs text-gray-500">校閲: {q.reviewed_by ?? "-"} / 承認: {q.approved_by ?? "-"}</span>
            </div>
            <p className="font-bold mb-2">{q.question}</p>
            <p className="text-xs mb-1">
              AI一次校閲:{" "}
              {q.ai_review ? (
                <span className={q.ai_review.verdict === "pass" ? "text-green-700 font-bold" : "text-red-600 font-bold"}>
                  {q.ai_review.verdict}（{q.ai_review.reviewer}）{q.ai_review.comments}
                </span>
              ) : (
                <span className="text-gray-500">未実施または本文変更により無効</span>
              )}
              {q.hash_ok === false && <span className="ml-2 text-red-600 font-bold">⚠ 承認時ハッシュ不一致</span>}
            </p>
            {q.issues.map((i, k) => (
              <p key={k} className={"text-xs " + (i.level === "error" ? "text-red-600" : "text-yellow-700")}>
                {i.level === "error" ? "✖" : "⚠"} {i.message}
              </p>
            ))}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 my-3">
              {PLATFORMS.map((p, idx) => {
                const l = q.posts[idx];
                return (
                  <div key={p} className="border rounded p-2 text-sm">
                    <div className="flex justify-between items-center">
                      <b>{PLATFORM_LABEL[p]}</b>
                      <span className={"px-2 py-0.5 rounded text-xs font-bold " + (l ? STATUS_COLOR[l.status] : "bg-gray-100")}>{l ? l.status : "未投稿"}</span>
                    </div>
                    {l?.external_url && (
                      <a className="text-blue-600 underline text-xs break-all" href={l.external_url} target="_blank" rel="noopener noreferrer">
                        {l.external_url}
                      </a>
                    )}
                    {l?.last_error && <p className="text-xs text-red-600 mt-1">{l.last_error}</p>}
                    {l && <p className="text-xs text-gray-500">試行 {l.attempts} 回</p>}
                    {l?.status === "failed" && (
                      <button className="mt-1 text-xs bg-samurai-navy text-white rounded px-2 py-1" onClick={() => act({ action: "retry", id: q.id, platform: p })}>
                        再試行
                      </button>
                    )}
                    {l?.status === "unknown" && (
                      <div className="mt-1 rounded border-2 border-orange-500 bg-orange-50 p-2 text-xs text-orange-800">
                        <p className="font-bold">⚠ 手動照合が必要です（自動再送はしません）</p>
                        <p>送信結果が不明です。自動照合で見つからなくても「未投稿」の証明にはなりません。{PLATFORM_LABEL[p]} の投稿一覧を直接確認してください。確認が済むまでこの問題以降の配信は止まります。</p>
                        <div className="flex gap-2 mt-1">
                          <button
                            className="bg-green-700 text-white rounded px-2 py-1"
                            onClick={() => {
                              const id = window.prompt("媒体側の投稿IDまたは投稿URLを入力（投稿済みとして記録し、再送しません）");
                              if (id) act({ action: "resolve_unknown", id: q.id, platform: p, resolution: "posted", externalId: id, url: id.startsWith("http") ? id : undefined });
                            }}
                          >
                            投稿済みを確認
                          </button>
                          <button
                            className="bg-red-700 text-white rounded px-2 py-1"
                            onClick={() => {
                              if (window.confirm(PLATFORM_LABEL[p] + " に本当に投稿されていないことを確認しましたか？ OKで再送が許可されます（二重投稿に注意）")) act({ action: "resolve_unknown", id: q.id, platform: p, resolution: "not_posted" });
                            }}
                          >
                            未投稿を確認（再送を許可）
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {q.errors.length > 0 && (
              <details className="text-xs mb-2">
                <summary className="cursor-pointer">エラー履歴 ({q.errors.length})</summary>
                {q.errors.map((e, i) => (
                  <p key={i}>
                    {new Date(e.at).toLocaleString("ja-JP")} [{e.platform}] {e.outcome}: {e.error}
                  </p>
                ))}
              </details>
            )}
            <div className="flex flex-wrap gap-2 items-center">
              {q.status === "draft" && <p className="text-xs text-gray-500">AI一次校閲待ち（校閲が pass になると承認待ちになります）</p>}
              {q.status === "reviewed" && (
                <div className="w-full border-t pt-2">
                  <div className="text-xs mb-2 rounded bg-gray-50 p-2 space-y-1">
                    <p className="font-bold">問題: {q.question}</p>
                    <ul>
                      {["A", "B", "C", "D"].map((k) => (
                        <li key={k} className={k === q.correct_answer ? "font-bold text-green-700" : ""}>
                          {k}. {q.choices?.[k] ?? "（選択肢なし）"}
                          {k === q.correct_answer ? "  ← 正答" : ""}
                        </li>
                      ))}
                    </ul>
                    <p>解説: {q.explanation ?? "（解説なし）"}</p>
                  </div>
                  {q.text_post?.text && (
                    <details className="text-xs mb-2">
                      <summary className="cursor-pointer">X・Threads共通の投稿プレビュー</summary>
                      <p className="mt-1 whitespace-pre-wrap">{q.text_post.text}</p>
                    </details>
                  )}
                  {q.text_post?.error && <p role="alert" className="text-xs text-red-700 mb-2">{q.text_post.error}</p>}
                  <p className="text-xs mb-1">最終承認（{who || "管理者"}）: 正答は <b>{q.correct_answer}</b>。上の本文・解説・AI校閲を確認してください。</p>
                  <label className="text-xs flex items-center gap-2 mb-1">
                    <input type="checkbox" checked={!!confirmed[q.id + ":" + q.current_hash]} onChange={(e) => setConfirmed({ ...confirmed, [q.id + ":" + q.current_hash]: e.target.checked })} />
                    正答が {q.correct_answer} であること、解説の内容が正しいことを確認した
                  </label>
                  <input type="datetime-local" className="border rounded px-2 py-1 text-sm" value={sched[q.id] ?? ""} onChange={(e) => setSched({ ...sched, [q.id]: e.target.value })} />
                  <button
                    className="ml-2 bg-green-600 text-white rounded px-3 py-1 text-sm disabled:opacity-40"
                    disabled={!sched[q.id] || !confirmed[q.id + ":" + q.current_hash] || !!q.text_post?.error}
                    onClick={() => act({ action: "approve", id: q.id, confirmed: true, expectedHash: q.current_hash, scheduledAt: new Date(sched[q.id]).toISOString() })}
                  >
                    承認して予約
                  </button>
                </div>
              )}
              {mode === "live" && (q.status === "approved" || q.status === "published") &&
                q.scheduled_at && new Date(q.scheduled_at).getTime() <= Date.now() && (
                  <button className="bg-blue-700 text-white rounded px-3 py-1 text-sm"
                    onClick={() => void act({ action: "run", id: q.id })}>
                    この問題を配信
                  </button>
                )}
              {(q.status === "approved" || q.status === "published") && (
                <button className="text-xs underline text-red-700" onClick={() => confirm("承認を取り消して下書きに戻します") && act({ action: "revoke", id: q.id, reason: "manual" })}>
                  承認を取り消す
                </button>
              )}
            </div>
          </div>
        ))}
        {rows.length === 0 && <p className="text-gray-500">問題がありません。</p>}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { Carousel } from "@/lib/instagram/service";

const endpoint = "/api/admin/instagram";
const labels: Record<string, string> = {
  draft: "下書き", approved: "承認済み", sending: "送信中", accepted: "Buffer受付済み",
  published: "公開済み", unknown: "結果不明・要確認", failed: "公開失敗",
};

async function api(body?: FormData | Record<string, unknown>) {
  const response = await fetch(endpoint, body instanceof FormData
    ? { method: "POST", body }
    : body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {});
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "処理に失敗しました");
  return result;
}

export default function InstagramAdmin() {
  const [editing, setEditing] = useState<Carousel | null>(null);
  const [rows, setRows] = useState<Carousel[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [visible, setVisible] = useState<Record<string, boolean>>({});
  const [loaded, setLoaded] = useState<Record<string, boolean>>({});
  const [confirmed, setConfirmed] = useState<Record<string, boolean>>({});

  useEffect(() => { void api().then(({ data }) => setRows(data)).catch((e) => setError(e.message)); }, []);

  async function perform(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
      setRows((await api()).data);
      setConfirmed({});
      setLoaded({});
      setVisible({});
    } catch (e) {
      setError(e instanceof Error ? e.message : "処理に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void perform(async () => {
      const files = form.getAll("images").filter((file) => file instanceof File && file.size > 0);
      if (files.length !== 6 && !(editing && files.length === 0)) throw new Error("投稿順にJPEGを6枚選んでください");
      const images = files.length ? [] : [...editing!.snapshot.images];
      for (const file of files) {
        const upload = new FormData();
        upload.set("file", file);
        images.push((await api(upload)).image);
      }
      await api({ action: "save", id: editing?.id, previousHash: editing?.hash, images, caption: form.get("caption"),
        scheduledAt: String(form.get("scheduledAt")) + ":00+07:00" });
      setEditing(null);
    });
  }

  return (
    <main className="mx-auto max-w-5xl space-y-7 p-5">
      <h1 className="text-2xl font-bold">Instagramカルーセル</h1>
      {error && <p role="alert" className="text-red-700">{error}</p>}
      <form key={editing?.id ?? "new"} onSubmit={save} className="grid gap-3 rounded border p-4">
        <label>画像6枚（選択順、各4 MB以下のJPEG）<br /><input name="images" type="file" accept="image/jpeg" multiple required={!editing} /></label>
        <label>キャプション<textarea className="block w-full border p-2" name="caption" defaultValue={editing?.snapshot.caption} maxLength={2200} rows={4} /></label>
        <label>予約日時（バンコク）<br /><input type="datetime-local" name="scheduledAt" defaultValue={editing ? new Date(Date.parse(editing.scheduled_at) + 7 * 3600_000).toISOString().slice(0, 16) : undefined} required /></label>
        <button className="w-fit rounded bg-slate-800 px-4 py-2 text-white" disabled={busy}>{editing ? "差し替えて下書きに戻す" : "下書きを保存"}</button>
        {editing && <button type="button" className="w-fit underline" onClick={() => setEditing(null)}>編集をやめる</button>}
      </form>
      {rows.map((row) => (
        <article key={row.id} className="space-y-3 rounded border p-4">
          <p>{labels[row.state] ?? row.state} · {new Date(row.scheduled_at).toLocaleString("ja-JP", { timeZone: "Asia/Bangkok" })}（バンコク）</p>
          <p>投稿先 {row.snapshot.channelId}</p>
          <p className="whitespace-pre-wrap">{row.snapshot.caption}</p>
          {row.buffer_post_id && <p>Buffer投稿ID {row.buffer_post_id}</p>}
          {row.permalink && <a href={row.permalink} className="underline">Instagram投稿を開く</a>}
          <button className="underline" onClick={() => setVisible({ ...visible, [row.id]: !visible[row.id] })}>
            {visible[row.id] ? "画像を閉じる" : "画像6枚を確認"}
          </button>
          {visible[row.id] && <>
            <ol className="flex snap-x gap-3 overflow-x-auto">
              {row.snapshot.images.map(({ digest }, index) => (
                <li className="w-[80%] max-w-sm shrink-0 snap-start" key={index}>
                  <img className="w-full" src={endpoint + "?image=" + digest} alt={`画像 ${index + 1} / 6`}
                    onLoad={() => setLoaded((previous) => ({ ...previous, [row.hash + ":" + index]: true }))}
                    onError={() => setLoaded((previous) => ({ ...previous, [row.hash + ":" + index]: false }))} />
                  <p>{index + 1} / 6</p>
                </li>
              ))}
            </ol>
            {row.state === "draft" && row.snapshot.images.every((_, index) => loaded[row.hash + ":" + index]) && (
              <label><input type="checkbox" checked={!!confirmed[row.id]} onChange={(event) => setConfirmed({ ...confirmed, [row.id]: event.target.checked })} /> 最終画像6枚・文章・投稿先・日時を確認した</label>
            )}
          </>}
          {row.state === "draft" && visible[row.id] && <button className="block underline"
            disabled={busy || !confirmed[row.id] || !row.snapshot.images.every((_, index) => loaded[row.hash + ":" + index])}
            onClick={() => void perform(async () => { await api({ action: "approve", id: row.id, hash: row.hash, confirmed: true }); })}>承認して予約</button>}
          {["draft", "approved"].includes(row.state) && <button className="block underline" disabled={busy}
            onClick={() => { setEditing(row); window.scrollTo({ top: 0, behavior: "smooth" }); }}>下書きを編集</button>}
          {row.state === "approved" && <button className="block underline" disabled={busy}
            onClick={() => void perform(async () => { await api({ action: "revoke", id: row.id, hash: row.hash }); })}>承認を取り消す</button>}
        </article>
      ))}
    </main>
  );
}

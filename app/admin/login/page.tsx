"use client";

import { useState } from "react";
import { createClient } from "@supabase/supabase-js";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anon) return setError("認証サービスが未設定です");
    const sb = createClient(url, anon, { auth: { persistSession: false } });
    const { data, error: err } = await sb.auth.signInWithPassword({ email, password });
    if (err || !data.session) return setError("ログインに失敗しました");
    const r = await fetch("/api/auth/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ access_token: data.session.access_token }) });
    if (!r.ok) return setError("このアカウントには管理権限がありません");
    window.location.href = "/admin/quiz";
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <form onSubmit={submit} className="bg-white p-8 rounded-lg shadow w-full max-w-sm space-y-4">
        <h1 className="text-xl font-bold text-samurai-navy">CMS 管理ログイン</h1>
        <input className="w-full border rounded px-3 py-2" type="email" placeholder="メールアドレス" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" />
        <input className="w-full border rounded px-3 py-2" type="password" placeholder="パスワード" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button className="w-full bg-samurai-navy text-white rounded py-2 font-bold">ログイン</button>
      </form>
    </div>
  );
}

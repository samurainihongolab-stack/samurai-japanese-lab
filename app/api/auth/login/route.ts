import { NextResponse } from "next/server";

// 旧デモ認証（任意のメール/パスワードでトークン発行）は廃止。ログインは Supabase Auth + /api/auth/session。
export async function POST() {
  return NextResponse.json({ success: false, error: "This endpoint has been removed. Use Supabase Auth." }, { status: 410 });
}

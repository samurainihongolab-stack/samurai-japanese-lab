import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, tokenFromRequest, verifyAdminToken } from "@/lib/auth/admin";
import { isSupabaseConfigured, supabaseEnv } from "@/lib/supabase-config";

const sameOrigin = (req: NextRequest) => {
  const origin = req.headers.get("origin");
  try {
    return !!origin && new URL(origin).host === req.headers.get("host");
  } catch {
    return false;
  }
};
const cookieOpts = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/" };

// ログイン: Supabase Auth のアクセストークンを検証し、管理者のみ HttpOnly Cookie に保存する。
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ ok: false, error: "Cross-origin request rejected" }, { status: 403 });
  const { access_token } = (await req.json().catch(() => ({}))) as { access_token?: string };
  const user = await verifyAdminToken(access_token);
  if (!user || !access_token) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  const res = NextResponse.json({ ok: true, user: { email: user.email, role: user.role } });
  res.cookies.set(ADMIN_COOKIE, access_token, { ...cookieOpts, maxAge: 60 * 60 });
  return res;
}

// 現在のログイン状態
export async function GET(req: NextRequest) {
  const user = await verifyAdminToken(tokenFromRequest(req));
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json({ ok: true, user: { email: user.email, role: user.role } });
}

// ログアウト: Cookie を削除し、Supabase 側のセッションも失効させる（盗まれたトークンを無効化）。
export async function DELETE(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ ok: false, error: "Cross-origin request rejected" }, { status: 403 });
  const token = tokenFromRequest(req);
  let revoked = false;
  if (token && isSupabaseConfigured()) {
    const { url, service } = supabaseEnv();
    const { error } = await createClient(url, service, { auth: { persistSession: false } }).auth.admin.signOut(token, "local");
    revoked = !error;
    if (error) console.error("[auth] session revoke failed:", error.message);
  }
  const res = NextResponse.json({ ok: true, revoked });
  res.cookies.set(ADMIN_COOKIE, "", { ...cookieOpts, maxAge: 0 });
  return res;
}

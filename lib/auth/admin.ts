import { createClient } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabaseEnv } from "../supabase-config";

export const ADMIN_COOKIE = "sb-admin-token";

/** 権限。将来 reviewer を足す場合は ROLE_PERMISSIONS に1行追加するだけでよい。 */
export type Role = "admin" | "reviewer";
export type Permission = "read" | "edit" | "approve" | "publish_ops";
const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: ["read", "edit", "approve", "publish_ops"],
  reviewer: [], // 未使用（今回は admin のみ）。追加時にここへ許可を書く。
};
export const can = (role: Role, p: Permission) => ROLE_PERMISSIONS[role].includes(p);

export interface AdminUser {
  id: string;
  email: string;
  role: Role;
}

/** ローカル開発専用のバイパス。本番(NODE_ENV=production / Vercel)では常に無効。 */
function devBypass(): AdminUser | null {
  if (process.env.ADMIN_DEV_BYPASS === "1" && process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
    return { id: "dev-local", email: "dev@localhost", role: "admin" };
  }
  return null;
}

/** Supabase Auth のアクセストークンを検証する。未設定なら常に null（管理操作は全拒否 = fail closed）。 */
export async function verifyAdminToken(token: string | null | undefined, perm: Permission = "read"): Promise<AdminUser | null> {
  const bypass = devBypass();
  if (bypass) return bypass;
  if (!token || !isSupabaseConfigured()) return null;
  const { url, anon } = supabaseEnv();
  const { data, error } = await createClient(url, anon, { auth: { persistSession: false } }).auth.getUser(token);
  if (error || !data.user) return null;
  // app_metadata はユーザー自身が書き換えられない（service_role のみ）ので権限の根拠にできる
  const role = data.user.app_metadata?.role as Role | undefined;
  if (!role || !(role in ROLE_PERMISSIONS) || !can(role, perm)) return null;
  return { id: data.user.id, email: data.user.email ?? "", role };
}

type Req = Request & { cookies?: { get(n: string): { value: string } | undefined } };

function bearer(req: Req): string | null {
  const h = req.headers.get("authorization");
  if (!h?.startsWith("Bearer ")) return null;
  return h.slice(7).trim() || null; // 空の Bearer は「なし」と同じ扱い（Cookie にフォールバック）
}
export const tokenFromRequest = (req: Req): string | null => bearer(req) ?? req.cookies?.get(ADMIN_COOKIE)?.value ?? parseCookie(req.headers.get("cookie"), ADMIN_COOKIE);

function parseCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

export type AuthResult = { ok: true; user: AdminUser } | { ok: false; status: 401 | 403; error: string };

/**
 * 管理操作の認可（管理画面・管理API・既存CMS API 共通の唯一の入口）。
 * CSRF: Cookie 認証の状態変更リクエストは、同一オリジンの Origin ヘッダーを必須とする。
 *       Authorization ヘッダー(Bearer)認証はブラウザが自動付与しないため対象外。
 */
export async function authorize(req: Req, perm: Permission = "read"): Promise<AuthResult> {
  const viaHeader = bearer(req) !== null;
  const mutating = !["GET", "HEAD", "OPTIONS"].includes(req.method);
  if (mutating && !viaHeader) {
    const origin = req.headers.get("origin");
    const host = req.headers.get("host");
    let same = false;
    try {
      same = !!origin && !!host && new URL(origin).host === host;
    } catch {
      same = false;
    }
    if (!same) return { ok: false, status: 403, error: "Cross-origin request rejected" };
  }
  const user = await verifyAdminToken(tokenFromRequest(req), perm);
  if (!user) return { ok: false, status: 401, error: "Unauthorized" };
  return { ok: true, user };
}

export async function requireAdmin(req: Req, perm: Permission = "read"): Promise<AdminUser | null> {
  const r = await authorize(req, perm);
  return r.ok ? r.user : null;
}

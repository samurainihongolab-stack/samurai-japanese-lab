import type { NextRequest } from "next/server";
import { requireAdmin } from "./admin";

/**
 * 既存CMS API 互換アダプタ。旧 verifyRequest が返していた形 ({ userId, email, role }) を維持し、
 * 検証だけを Supabase Auth（lib/auth/admin.ts）に統一する。未認証は null（=各ルートが従来どおり 401）。
 */
export async function legacyUser(request: NextRequest): Promise<{ userId: string; email: string; role: "editor" | "reviewer" | "admin" } | null> {
  const u = await requireAdmin(request);
  return u ? { userId: u.id, email: u.email, role: u.role } : null;
}

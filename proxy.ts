import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { authorize } from "@/lib/auth/admin";

/** 管理画面・管理APIを認可必須にする。各 Route Handler でも再度検証する（多層防御）。一般公開ページは対象外。 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/admin/login") return NextResponse.next();

  const r = await authorize(request);
  if (r.ok) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ success: false, error: r.error }, { status: r.status });
  }
  const url = request.nextUrl.clone();
  url.pathname = "/admin/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*", "/api/cms/:path*", "/api/analytics/stats"],
};

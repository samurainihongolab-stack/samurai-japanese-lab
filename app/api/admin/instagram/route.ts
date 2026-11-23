import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/auth/admin";
import { instagramService } from "@/lib/instagram/service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await authorize(req, "read");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    const service = instagramService();
    const digest = req.nextUrl.searchParams.get("image");
    if (digest) {
      const bytes = await service.readImage(digest + ".jpg", digest);
      return new NextResponse(new Uint8Array(bytes), {
        headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
      });
    }
    return NextResponse.json({ data: await service.list() }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Instagramデータを取得できません" }, { status: 503 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await authorize(req, "approve");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    const service = instagramService();
    if (req.headers.get("content-type")?.startsWith("multipart/form-data")) {
      const file = (await req.formData()).get("file");
      if (!(file instanceof File)) throw new Error("画像が必要です");
      return NextResponse.json({ image: await service.upload(file) });
    }
    const body = await req.json();
    if (body.action === "save") {
      if (!await service.save(body, auth.user)) {
        return NextResponse.json({ error: "状態またはハッシュが変わりました。再読み込みしてください" }, { status: 409 });
      }
      return NextResponse.json({ ok: true }, { status: 201 });
    }
    if ((body.action === "approve" && body.confirmed === true) || body.action === "revoke") {
      const changed = await service.review(body.id, body.hash, body.action === "approve", auth.user);
      if (changed) return NextResponse.json({ ok: true });
      return NextResponse.json({ error: "状態またはハッシュが変わりました。再読み込みしてください" }, { status: 409 });
    }
    throw new Error("操作が不正です");
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "処理に失敗しました" }, { status: 400 });
  }
}

import sharp from "sharp";
import { contentHash } from "@/lib/quiz/hash";
import { NextResponse } from "next/server";
import { getRepository } from "@/lib/quiz";
import { renderQuestionImage } from "@/lib/quiz/image";

export const dynamic = "force-dynamic";

// 公開済みで予約時刻に達した問題だけ配信する。正答は画像に含めない。
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const url = new URL(req.url);
  const revision = url.searchParams.get("revision");
  const repo = getRepository();
  const now = new Date();
  const visible = await repo.getPublicBySlug(slug, now);
  if (!visible) return new NextResponse("Not found", { status: 404 });
  if (revision !== null) {
    const q = await repo.getQuestion(visible.id);
    if (!q || q.status !== "published" || !q.scheduled_at || new Date(q.scheduled_at) > now || !q.content_hash || revision !== q.content_hash || revision !== contentHash(q)) {
      return new NextResponse("Not found", { status: 404 });
    }
    const { png } = await renderQuestionImage(q);
    const jpeg = await sharp(png).jpeg({ quality: 90 }).toBuffer();
    return new NextResponse(new Uint8Array(jpeg), {
      headers: { "Content-Type": "image/jpeg", "Cache-Control": "no-store" },
    });
  }
  const { png } = await renderQuestionImage(visible);
  return new NextResponse(new Uint8Array(png), { headers: { "Content-Type": "image/png", "Cache-Control": "no-store" } });
}

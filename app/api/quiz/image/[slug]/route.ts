import sharp from "sharp";
import { contentHash } from "@/lib/quiz/hash";
import { NextResponse } from "next/server";
import { getRepository } from "@/lib/quiz";
import { renderQuestionImage } from "@/lib/quiz/image";

export const dynamic = "force-dynamic";

// Instagram が取得する問題画像。承認済み(approved/published)のみ生成し、正答は画像に含めない。
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const url = new URL(req.url);
  const revision = url.searchParams.get("revision");
  if (revision !== null) {
    const repo = getRepository();
    const visible = await repo.getPublicBySlug(slug, new Date());
    const q = visible ? await repo.getQuestion(visible.id) : null;
    if (!q || q.status !== "published" || !q.scheduled_at || new Date(q.scheduled_at) > new Date() || !q.content_hash || revision !== q.content_hash || revision !== contentHash(q)) {
      return new NextResponse("Not found", { status: 404 });
    }
    const { png } = await renderQuestionImage(q);
    const jpeg = await sharp(png).jpeg({ quality: 90 }).toBuffer();
    return new NextResponse(new Uint8Array(jpeg), {
      headers: { "Content-Type": "image/jpeg", "Cache-Control": "no-store" },
    });
  }
  const q = (await getRepository().listQuestions()).find((x) => x.slug === slug);
  if (!q || (q.status !== "approved" && q.status !== "published")) return new NextResponse("Not found", { status: 404 });
  const { png } = await renderQuestionImage(q);
  return new NextResponse(new Uint8Array(png), { headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=300" } });
}

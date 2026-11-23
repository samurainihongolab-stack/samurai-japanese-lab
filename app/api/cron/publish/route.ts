import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { instagramService } from "@/lib/instagram/service";
import { getRepository } from "@/lib/quiz";
import { createPublishers, publicationMode } from "@/lib/publishers";
import { runPublishCycle } from "@/lib/publishers/engine";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // 未設定なら常に拒否（fail closed）
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from("Bearer " + secret);
  return got.length === want.length && timingSafeEqual(got, want);
}

// Vercel Cron は CRON_SECRET を Authorization: Bearer で送る。既定は DRY RUN（SNS_MODE=live かつ確認句がなければ実投稿しない）。
export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // モック実行でも投稿エンジンは問題の公開状態と投稿履歴を書き換える。
  // クラウドの dry-run では永続DBに接続する前に終了する。
  const mode = publicationMode();
  if (mode === "live" && process.env.CRON_PUBLISH_ENABLED !== "true") {
    return NextResponse.json({ ok: true, mode, state: "disabled" });
  }
  if (mode === "disabled") {
    return NextResponse.json({ ok: true, mode: "dry-run", state: "disabled" });
  }
  try {
    const publishers = createPublishers();
    const report = await runPublishCycle({ repo: getRepository(), publishers });
    const instagram = mode === "live" && process.env.INSTAGRAM_CAROUSEL_ENABLED === "true"
      ? await Promise.resolve().then(() => instagramService().run()).catch(() => ({ state: "error" }))
      : undefined;
    console.info("cron/publish", {
      mode,
      stage: report.stage,
      outcomes: report.outcomes.map(({ platform, result }) => ({ platform, result })),
      instagram: instagram?.state,
    });
    return NextResponse.json({ ok: true, instagram, mode, report });
  } catch {
    console.error("cron/publish failed");
    return NextResponse.json({ ok: false, error: "cycle failed" }, { status: 500 });
  }
}

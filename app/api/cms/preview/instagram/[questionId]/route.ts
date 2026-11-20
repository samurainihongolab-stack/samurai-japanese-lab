import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/db/client";
import { verifyRequest } from "@/lib/auth/jwt";
import { generateInstagramPreview } from "@/lib/preview/instagram";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ questionId: string }> }
) {
  try {
    const user = verifyRequest(request);
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const { questionId } = await params;
    const { searchParams } = new URL(request.url);
    const style = (searchParams.get("style") as "light" | "dark") || "light";
    const templateId = searchParams.get("templateId") || "tpl_ig_default";

    // Fetch question from database
    const { data: question, error } = await supabaseAdmin
      .from("questions")
      .select("*")
      .eq("id", questionId)
      .single();

    if (error || !question) {
      return NextResponse.json({ success: false, error: "Question not found" }, { status: 404 });
    }

    // Generate preview image
    const imageBuffer = await generateInstagramPreview({
      stem: question.stem,
      choices: question.choices,
      correctChoice: question.correctChoice,
      difficulty: question.difficulty,
      style,
    });

    // Convert to base64
    const base64Image = imageBuffer.toString("base64");
    const dataUrl = `data:image/png;base64,${base64Image}`;

    // Generate caption
    const caption = `【${question.difficulty}級の問題】\n\n${question.stem}\n\nプロフィールのリンクで答えを確認しましょう！\n\n#日本語学習 #日本語 #侍日本語ラボ`;

    return NextResponse.json(
      {
        success: true,
        data: {
          image: dataUrl,
          caption,
          dimensions: "1080x1350",
          format: "image/png",
          size: imageBuffer.length,
        },
        timestamp: new Date(),
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("GET /api/cms/preview/instagram/[questionId]:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

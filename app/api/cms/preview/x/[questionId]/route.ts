import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/db/client";
import { verifyRequest } from "@/lib/auth/jwt";
import { generateXPreview, generateXThreadCaption } from "@/lib/preview/twitter";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ questionId: string }> }
) {
  try {
    const user = verifyRequest(request);
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const { questionId } = await params;

    // Fetch question from database
    const { data: question, error } = await supabaseAdmin
      .from("questions")
      .select("*")
      .eq("id", questionId)
      .single();

    if (error || !question) {
      return NextResponse.json({ success: false, error: "Question not found" }, { status: 404 });
    }

    // Generate preview
    const preview = generateXPreview({
      stem: question.stem,
      choices: question.choices,
      correctChoice: question.correctChoice,
      difficulty: question.difficulty,
      id: questionId,
    });

    const caption = generateXThreadCaption({
      stem: question.stem,
      choices: question.choices,
      correctChoice: question.correctChoice,
      difficulty: question.difficulty,
      id: questionId,
    });

    // Calculate character counts
    const totalChars = Object.values(preview).reduce((sum, text) => sum + text.length, 0);

    return NextResponse.json(
      {
        success: true,
        data: {
          threadCaption: caption,
          tweets: [
            { text: preview.tweet1, characterCount: preview.tweet1.length },
            { text: preview.tweet2, characterCount: preview.tweet2.length },
            { text: preview.tweet3, characterCount: preview.tweet3.length },
          ],
          totalCharacters: totalChars,
          threadLength: 3,
          format: "thread",
        },
        timestamp: new Date(),
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("GET /api/cms/preview/x/[questionId]:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

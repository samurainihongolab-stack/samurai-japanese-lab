import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/db/client";
import { verifyRequest } from "@/lib/auth/jwt";

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

    // Generate HTML preview
    const html = `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${question.stem.substring(0, 50)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Arial', sans-serif; background: #f5f5f5; padding: 20px; }
    .container { max-width: 800px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    .header { text-align: center; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 3px solid #082D6B; }
    .header h1 { color: #082D6B; font-size: 28px; margin-bottom: 10px; }
    .difficulty { display: inline-block; background: #FFD600; color: black; padding: 8px 16px; border-radius: 20px; font-weight: bold; font-size: 14px; }
    .question { background: #f9f9f9; padding: 20px; border-radius: 8px; margin-bottom: 30px; border-left: 4px solid #082D6B; }
    .question h2 { color: #082D6B; font-size: 14px; margin-bottom: 10px; }
    .question p { color: #333; font-size: 18px; line-height: 1.6; }
    .choices { margin-bottom: 30px; }
    .choice { display: flex; align-items: center; padding: 15px; margin-bottom: 12px; background: #f5f5f5; border-radius: 8px; cursor: pointer; transition: all 0.3s; }
    .choice:hover { background: #e8e8e8; transform: translateX(5px); }
    .choice-label { font-weight: bold; color: white; background: #082D6B; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 15px; font-size: 16px; }
    .choice-text { flex: 1; color: #333; font-size: 16px; }
    .answer { margin-top: 40px; padding: 20px; background: #082D6B; color: white; border-radius: 8px; text-align: center; display: none; }
    .answer.show { display: block; }
    .answer h3 { font-size: 18px; margin-bottom: 10px; }
    .answer p { font-size: 16px; line-height: 1.6; }
    .footer { text-align: center; margin-top: 40px; color: #999; font-size: 12px; }
    button { background: #FFD600; color: black; border: none; padding: 12px 24px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 16px; margin-top: 20px; }
    button:hover { opacity: 0.9; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🥋 侍日本語ラボ</h1>
      <p style="color: #666; margin-top: 10px;">日本語学習の毎日の問題</p>
    </div>

    <div class="question">
      <h2>【問題】</h2>
      <p>${question.stem}</p>
    </div>

    <div class="choices">
      <div class="choice" onclick="this.closest('.container').querySelector('.answer').classList.add('show')">
        <div class="choice-label">A</div>
        <div class="choice-text">${question.choices.A}</div>
      </div>
      <div class="choice" onclick="this.closest('.container').querySelector('.answer').classList.add('show')">
        <div class="choice-label">B</div>
        <div class="choice-text">${question.choices.B}</div>
      </div>
      <div class="choice" onclick="this.closest('.container').querySelector('.answer').classList.add('show')">
        <div class="choice-label">C</div>
        <div class="choice-text">${question.choices.C}</div>
      </div>
      <div class="choice" onclick="this.closest('.container').querySelector('.answer').classList.add('show')">
        <div class="choice-label">D</div>
        <div class="choice-text">${question.choices.D}</div>
      </div>
    </div>

    <div class="answer">
      <h3>✅ 正解: ${question.correctChoice}</h3>
      <p>${question.explanation}</p>
    </div>

    <div style="text-align: center; margin-top: 30px;">
      <button onclick="document.querySelector('.answer').classList.toggle('show')">
        {{ document.querySelector('.answer').classList.contains('show') ? '解説を隠す' : '答えを見る' }}
      </button>
    </div>

    <div class="footer">
      <p>© 侍日本語ラボ | ${new Date().toLocaleDateString("ja-JP")}</p>
    </div>
  </div>
</body>
</html>
    `.trim();

    const url = `/questions/${questionId}`;
    const urlFull = `https://samurai-japanese-lab.vercel.app${url}`;

    return NextResponse.json(
      {
        success: true,
        data: {
          html,
          url,
          urlFull,
          title: question.stem.substring(0, 50),
          description: `${question.difficulty}級の問題`,
        },
        timestamp: new Date(),
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("GET /api/cms/preview/hp/[questionId]:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

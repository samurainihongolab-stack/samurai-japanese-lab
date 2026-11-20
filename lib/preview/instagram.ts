import sharp from "sharp";

export interface InstagramPreviewOptions {
  stem: string;
  choices: { A: string; B: string; C: string; D: string };
  correctChoice: string;
  difficulty: string;
  style?: "light" | "dark";
}

export async function generateInstagramPreview(
  options: InstagramPreviewOptions
): Promise<Buffer> {
  const { stem, choices, correctChoice, difficulty, style = "light" } = options;

  const bgColor = style === "dark" ? "#082D6B" : "#ffffff";
  const textColor = style === "dark" ? "#ffffff" : "#082D6B";
  const accentColor = "#FFD600";

  const svgImage = `
    <svg width="1080" height="1350" xmlns="http://www.w3.org/2000/svg">
      <rect width="1080" height="1350" fill="${bgColor}"/>

      <!-- Header -->
      <rect width="1080" height="150" fill="${accentColor}"/>
      <text x="540" y="85" font-size="48" font-weight="bold" text-anchor="middle" fill="#000" font-family="Arial">
        🥋 侍日本語ラボ
      </text>

      <!-- Difficulty Badge -->
      <rect x="40" y="170" width="1000" height="80" fill="${style === "dark" ? "#1a3a7a" : "#f0f0f0"}" rx="10"/>
      <text x="60" y="210" font-size="32" font-weight="bold" fill="${textColor}" font-family="Arial">
        難易度: ${difficulty}
      </text>

      <!-- Question -->
      <text x="60" y="310" font-size="28" font-weight="bold" fill="${textColor}" font-family="Arial" text-anchor="start">
        問題
      </text>
      <foreignObject x="60" y="330" width="960" height="200">
        <div xmlns="http://www.w3.org/1999/xhtml" style="color: ${textColor}; font-size: 24px; font-family: Arial; line-height: 1.4; word-wrap: break-word;">
          ${stem.substring(0, 100)}${stem.length > 100 ? "..." : ""}
        </div>
      </foreignObject>

      <!-- Choices -->
      <text x="60" y="600" font-size="24" font-weight="bold" fill="${textColor}" font-family="Arial">
        選択肢:
      </text>

      <rect x="60" y="630" width="960" height="50" fill="${style === "dark" ? "#1a3a7a" : "#f5f5f5"}" rx="5"/>
      <text x="80" y="665" font-size="20" fill="${textColor}" font-family="Arial">
        A) ${choices.A.substring(0, 50)}${choices.A.length > 50 ? "..." : ""}
      </text>

      <rect x="60" y="700" width="960" height="50" fill="${style === "dark" ? "#1a3a7a" : "#f5f5f5"}" rx="5"/>
      <text x="80" y="735" font-size="20" fill="${textColor}" font-family="Arial">
        B) ${choices.B.substring(0, 50)}${choices.B.length > 50 ? "..." : ""}
      </text>

      <rect x="60" y="770" width="960" height="50" fill="${style === "dark" ? "#1a3a7a" : "#f5f5f5"}" rx="5"/>
      <text x="80" y="805" font-size="20" fill="${textColor}" font-family="Arial">
        C) ${choices.C.substring(0, 50)}${choices.C.length > 50 ? "..." : ""}
      </text>

      <rect x="60" y="840" width="960" height="50" fill="${style === "dark" ? "#1a3a7a" : "#f5f5f5"}" rx="5"/>
      <text x="80" y="875" font-size="20" fill="${textColor}" font-family="Arial">
        D) ${choices.D.substring(0, 50)}${choices.D.length > 50 ? "..." : ""}
      </text>

      <!-- CTA -->
      <rect x="60" y="950" width="960" height="80" fill="${accentColor}" rx="10"/>
      <text x="540" y="1005" font-size="32" font-weight="bold" text-anchor="middle" fill="#000" font-family="Arial">
        → 答えを見る
      </text>

      <!-- Footer -->
      <text x="540" y="1150" font-size="20" text-anchor="middle" fill="${textColor}" font-family="Arial">
        @samurai.nihongo.lab
      </text>
      <text x="540" y="1180" font-size="18" text-anchor="middle" fill="${textColor}" font-family="Arial" opacity="0.7">
        日本語学習の毎日の問題
      </text>
      <text x="540" y="1310" font-size="16" text-anchor="middle" fill="${textColor}" font-family="Arial" opacity="0.5">
        プロフィールのリンクからチェック
      </text>
    </svg>
  `;

  const buffer = await sharp(Buffer.from(svgImage)).png().toBuffer();
  return buffer;
}

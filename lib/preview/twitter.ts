export interface XPreviewOptions {
  stem: string;
  choices: { A: string; B: string; C: string; D: string };
  correctChoice: string;
  difficulty: string;
  id: string;
}

export function generateXPreview(options: XPreviewOptions): {
  tweet1: string;
  tweet2: string;
  tweet3: string;
} {
  const { stem, choices, difficulty, id, correctChoice } = options;

  // Split long stem if needed
  const shortStem = stem.length > 200 ? stem.substring(0, 200) + "..." : stem;

  const tweet1 = `🥋 本日の日本語問題

難易度: ${difficulty}

【問題】
${shortStem}

選択肢を下のツイートで確認 👇`;

  const tweet2 = `【選択肢】

A) ${choices.A.substring(0, 150)}${choices.A.length > 150 ? "..." : ""}

B) ${choices.B.substring(0, 150)}${choices.B.length > 150 ? "..." : ""}

C) ${choices.C.substring(0, 150)}${choices.C.length > 150 ? "..." : ""}

D) ${choices.D.substring(0, 150)}${choices.D.length > 150 ? "..." : ""}`;

  const tweet3 = `【正解】

正解は ${correctChoice} です！

詳しい解説はプロフィールのリンクから確認できます。

毎日新しい問題をお届けします。
フォローして日本語をマスター！`;

  return { tweet1, tweet2, tweet3 };
}

export function generateXThreadCaption(options: XPreviewOptions): string {
  return `${options.difficulty}級の日本語問題 | @samurai.nihongo.lab`;
}

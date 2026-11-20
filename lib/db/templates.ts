export interface InstagramTemplate {
  id: string;
  name: string;
  description: string;
  platform: "instagram";
  template: {
    bgColor: string;
    textColor: string;
    accentColor: string;
    headerText: string;
    headerSize: number;
    difficultyBadgeEnabled: boolean;
    questionFontSize: number;
    choicesFontSize: number;
    ctaButtonText: string;
    ctaButtonColor: string;
    footerText: string;
    footerSize: number;
  };
  isDefault: boolean;
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
}

export interface XTemplate {
  id: string;
  name: string;
  description: string;
  platform: "x";
  template: {
    tweet1Format: string; // Template with {stem}, {difficulty}, {choices}
    tweet2Format: string; // Template with {choices}
    tweet3Format: string; // Template with {correctChoice}, {difficulty}
    hashtagsEnabled: boolean;
    hashtags: string[];
    threadStyle: "formal" | "casual" | "emoji-rich";
    maxCharsPerTweet: number;
  };
  isDefault: boolean;
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
}

export interface HPTemplate {
  id: string;
  name: string;
  description: string;
  platform: "hp";
  template: {
    containerBgColor: string;
    containerMaxWidth: number;
    headerFontSize: number;
    questionFontSize: number;
    choicesFontSize: number;
    buttonStyle: "primary" | "secondary" | "outline";
    answerRevealAnimation: "fade" | "slide" | "none";
    showExplanation: boolean;
    customCSS?: string;
  };
  isDefault: boolean;
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
}

export type SocialTemplate = InstagramTemplate | XTemplate | HPTemplate;

// Preset templates
export const DEFAULT_INSTAGRAM_TEMPLATE: InstagramTemplate = {
  id: "tpl_ig_default",
  name: "デフォルト",
  description: "標準的な Instagram テンプレート",
  platform: "instagram",
  template: {
    bgColor: "#ffffff",
    textColor: "#082D6B",
    accentColor: "#FFD600",
    headerText: "🥋 侍日本語ラボ",
    headerSize: 48,
    difficultyBadgeEnabled: true,
    questionFontSize: 28,
    choicesFontSize: 20,
    ctaButtonText: "→ 答えを見る",
    ctaButtonColor: "#FFD600",
    footerText: "@samurai.nihongo.lab",
    footerSize: 20,
  },
  isDefault: true,
  createdAt: new Date(),
  createdBy: "system",
  updatedAt: new Date(),
};

export const DARK_INSTAGRAM_TEMPLATE: InstagramTemplate = {
  id: "tpl_ig_dark",
  name: "ダークモード",
  description: "ダークテーマの Instagram テンプレート",
  platform: "instagram",
  template: {
    bgColor: "#082D6B",
    textColor: "#ffffff",
    accentColor: "#FFD600",
    headerText: "🥋 侍日本語ラボ",
    headerSize: 48,
    difficultyBadgeEnabled: true,
    questionFontSize: 28,
    choicesFontSize: 20,
    ctaButtonText: "→ 答えを見る",
    ctaButtonColor: "#FFD600",
    footerText: "@samurai.nihongo.lab",
    footerSize: 20,
  },
  isDefault: false,
  createdAt: new Date(),
  createdBy: "system",
  updatedAt: new Date(),
};

export const DEFAULT_X_TEMPLATE: XTemplate = {
  id: "tpl_x_default",
  name: "デフォルト",
  description: "標準的な X テンプレート",
  platform: "x",
  template: {
    tweet1Format: "🥋 本日の日本語問題\n\n難易度: {difficulty}\n\n【問題】\n{stem}\n\n選択肢を下のツイートで確認 👇",
    tweet2Format: "【選択肢】\n\nA) {choiceA}\n\nB) {choiceB}\n\nC) {choiceC}\n\nD) {choiceD}",
    tweet3Format: "【正解】\n\n正解は {correctChoice} です！\n\n詳しい解説はプロフィールのリンクから確認できます。\n\n毎日新しい問題をお届けします。\nフォローして日本語をマスター！",
    hashtagsEnabled: true,
    hashtags: ["#日本語学習", "#日本語", "#侍日本語ラボ"],
    threadStyle: "formal",
    maxCharsPerTweet: 280,
  },
  isDefault: true,
  createdAt: new Date(),
  createdBy: "system",
  updatedAt: new Date(),
};

export const CASUAL_X_TEMPLATE: XTemplate = {
  id: "tpl_x_casual",
  name: "カジュアル",
  description: "絵文字多用のカジュアルなテンプレート",
  platform: "x",
  template: {
    tweet1Format: "✨ 今日の問題です!\n\nレベル: {difficulty}\n\n📝 {stem}\n\nどうですか? 下のツイートで答え確認 👇",
    tweet2Format: "🎯 選択肢:\n\n① {choiceA}\n② {choiceB}\n③ {choiceC}\n④ {choiceD}",
    tweet3Format: "✅ 答え: {correctChoice}\n\n解説はプロフへ!\n\n毎日の日本語チャレンジ 🚀\nフォロー待ってます!",
    hashtagsEnabled: true,
    hashtags: ["#日本語学習", "#日本語チャレンジ"],
    threadStyle: "emoji-rich",
    maxCharsPerTweet: 280,
  },
  isDefault: false,
  createdAt: new Date(),
  createdBy: "system",
  updatedAt: new Date(),
};

export const DEFAULT_HP_TEMPLATE: HPTemplate = {
  id: "tpl_hp_default",
  name: "デフォルト",
  description: "標準的なホームページテンプレート",
  platform: "hp",
  template: {
    containerBgColor: "#ffffff",
    containerMaxWidth: 800,
    headerFontSize: 28,
    questionFontSize: 18,
    choicesFontSize: 16,
    buttonStyle: "primary",
    answerRevealAnimation: "fade",
    showExplanation: true,
  },
  isDefault: true,
  createdAt: new Date(),
  createdBy: "system",
  updatedAt: new Date(),
};

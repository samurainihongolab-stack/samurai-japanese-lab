import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { SITE } from "../site";
import { CHOICE_KEYS, type QuizQuestion } from "./types";
import { choiceNumber } from "./templates/common";

export const IG_W = 1080;
export const IG_H = 1350; // 4:5

const C = { navy: "#061c3c", navy2: "#082D6B", gold: "#FFD600", light: "#E6F4FF", ink: "#09254c", white: "#ffffff" };

/** 同梱フォント（Noto Sans JP / SIL OFL 1.1）だけを使う fontconfig を用意する。システムフォントに依存しない。 */
let fontReady = false;
function ensureFont() {
  if (fontReady) return;
  const dir = path.join(process.cwd(), "assets", "fonts");
  if (!fs.existsSync(path.join(dir, "NotoSansJP-VF.ttf"))) throw new Error("同梱フォントが見つかりません: assets/fonts/NotoSansJP-VF.ttf");
  const cfgDir = fs.mkdtempSync(path.join(os.tmpdir(), "fc-"));
  const cfg = path.join(cfgDir, "fonts.conf");
  fs.writeFileSync(
    cfg,
    '<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd"><fontconfig><dir>' + dir + "</dir><cachedir>" + cfgDir + "</cachedir></fontconfig>",
  );
  process.env.FONTCONFIG_FILE = cfg;
  fontReady = true;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const KINSOKU = new Set("、。，．）」』】？！・ー:：;；)".split(""));
const charW = (ch: string) => (/[\u0000-ÿ]/.test(ch) ? 0.58 : 1.0);

/** 日本語向け折り返し（禁則: 行頭に句読点・閉じ括弧を置かない）。 */
export function wrap(text: string, fontSize: number, maxWidth: number): string[] {
  const lines: string[] = [];
  let cur = "";
  let w = 0;
  for (const ch of text) {
    const cw = charW(ch) * fontSize;
    if (w + cw > maxWidth && cur && !KINSOKU.has(ch)) {
      lines.push(cur);
      cur = "";
      w = 0;
    }
    cur += ch;
    w += cw;
  }
  if (cur) lines.push(cur);
  return lines;
}

const igHandle = () => "@" + (SITE.instagram.replace(/\/+$/, "").split("/").pop() || "samurai.nihongo.lab");

export interface RenderedImage {
  png: Buffer;
  width: number;
  height: number;
  layout: { stemLines: number; stemFont: number; choiceFont: number; choiceLines: number[]; contentBottom: number };
}

/** 4:5 の問題画像。正答は一切含めない（入力にも正答を受け取らない）。 */
export async function renderQuestionImage(q: Pick<QuizQuestion, "question" | "choices">): Promise<RenderedImage> {
  ensureFont();
  const FOOTER_TOP = 1200;
  const CONTENT_TOP = 318;
  let stemFont = 46;
  let choiceFont = 38;

  const layout = (sf: number, cf: number) => {
    const stemLines = wrap(q.question, sf, 960 - 2 * 48);
    const stemH = 44 + stemLines.length * sf * 1.55 + 28;
    const choices = CHOICE_KEYS.map((k) => {
      const lines = wrap(q.choices[k], cf, 960 - 40 - 96 - 36);
      return { k, lines, h: Math.max(84, 36 + lines.length * cf * 1.4) };
    });
    const total = stemH + 28 + choices.reduce((a, c) => a + c.h + 18, 0);
    return { stemLines, stemH, choices, total };
  };
  let L = layout(stemFont, choiceFont);
  while (CONTENT_TOP + L.total > FOOTER_TOP - 10) {
    if (stemFont <= 30) throw new Error("問題文・選択肢が長すぎて画像に収まりません");
    stemFont -= 2;
    choiceFont = Math.max(28, choiceFont - 2);
    L = layout(stemFont, choiceFont);
  }

  let y = CONTENT_TOP;
  const parts: string[] = [];
  parts.push('<rect x="60" y="' + y + '" width="960" height="' + L.stemH + '" rx="26" fill="' + C.white + '"/>');
  parts.push('<rect x="60" y="' + y + '" width="12" height="' + L.stemH + '" rx="6" fill="' + C.gold + '"/>');
  L.stemLines.forEach((ln, i) => {
    const ty = y + 44 + stemFont * 1.1 + i * stemFont * 1.55;
    parts.push('<text x="108" y="' + ty + '" font-size="' + stemFont + '" font-weight="700" fill="' + C.ink + '">' + esc(ln) + "</text>");
  });
  y += L.stemH + 28;
  for (const c of L.choices) {
    parts.push('<rect x="60" y="' + y + '" width="960" height="' + c.h + '" rx="22" fill="' + C.light + '"/>');
    parts.push('<circle cx="114" cy="' + (y + c.h / 2) + '" r="34" fill="' + C.navy2 + '"/>');
    parts.push('<text x="114" y="' + (y + c.h / 2 + 14) + '" font-size="38" font-weight="900" text-anchor="middle" fill="' + C.gold + '">' + choiceNumber(c.k) + "</text>");
    const th = c.lines.length * choiceFont * 1.4;
    c.lines.forEach((ln, i) => {
      const ty = y + (c.h - th) / 2 + choiceFont * 1.05 + i * choiceFont * 1.4;
      parts.push('<text x="174" y="' + ty + '" font-size="' + choiceFont + '" font-weight="500" fill="' + C.ink + '">' + esc(ln) + "</text>");
    });
    y += c.h + 18;
  }

  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="' + IG_W + '" height="' + IG_H + '" viewBox="0 0 ' + IG_W + " " + IG_H + "\" font-family=\"'Noto Sans JP'\">" +
    '<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + C.navy2 + '"/><stop offset="1" stop-color="' + C.navy + '"/></linearGradient></defs>' +
    '<rect width="' + IG_W + '" height="' + IG_H + '" fill="url(#bg)"/>' +
    '<circle cx="98" cy="100" r="44" fill="none" stroke="' + C.white + '" stroke-width="4"/>' +
    '<text x="98" y="116" font-size="46" font-weight="900" text-anchor="middle" fill="' + C.white + '">侍</text>' +
    '<text x="164" y="102" font-size="46" font-weight="900" fill="' + C.white + '">侍日本語ラボ</text>' +
    '<text x="166" y="134" font-size="20" font-weight="700" letter-spacing="5" fill="' + C.gold + '">SAMURAI NIHONGO LAB</text>' +
    '<rect x="60" y="172" width="960" height="3" fill="' + C.gold + '" opacity="0.8"/>' +
    '<rect x="60" y="212" width="960" height="72" rx="36" fill="' + C.gold + '"/>' +
    '<text x="540" y="261" font-size="38" font-weight="900" text-anchor="middle" fill="' + C.navy + '">今日の日本語教員試験クイズ</text>' +
    parts.join("") +
    '<rect x="60" y="' + FOOTER_TOP + '" width="960" height="100" rx="20" fill="none" stroke="' + C.gold + '" stroke-width="3"/>' +
    '<text x="540" y="' + (FOOTER_TOP + 44) + '" font-size="32" font-weight="900" text-anchor="middle" fill="' + C.white + '">正解と解説は公式サイトで</text>' +
    '<text x="540" y="' + (FOOTER_TOP + 84) + '" font-size="24" font-weight="500" text-anchor="middle" fill="' + C.gold + '">プロフィールのリンクから　' + esc(igHandle()) + "</text>" +
    "</svg>";

  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return {
    png,
    width: IG_W,
    height: IG_H,
    layout: { stemLines: L.stemLines.length, stemFont, choiceFont, choiceLines: L.choices.map((c) => c.lines.length), contentBottom: y },
  };
}

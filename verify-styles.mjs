import { chromium } from "playwright";

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  await page.goto("http://localhost:3000", { waitUntil: "networkidle" });

  // 重要なセクターのCSS確認
  const selectors = {
    "ヘッダー": "header",
    "ヒーロー背景": "section.relative.h-\\[570px\\]",
    "教材カード": "div.bg-gradient-to-b",
    "SNS導線セクション": "section:has(h2:has-text('SNS で学びを続ける'))",
    "フッター": "footer",
    "本文色": "body",
    "ナビゲーション": "nav a"
  };

  console.log("🎨 CSS適用状況検証\n");

  for (const [name, selector] of Object.entries(selectors)) {
    try {
      const element = await page.locator(selector).first();

      if (await element.isVisible()) {
        const styles = await element.evaluate(el => {
          const computed = window.getComputedStyle(el);
          return {
            backgroundColor: computed.backgroundColor,
            color: computed.color,
            display: computed.display,
            padding: computed.padding,
            className: el.className
          };
        });

        console.log(`✅ ${name}`);
        console.log(`   背景色: ${styles.backgroundColor}`);
        console.log(`   テキスト色: ${styles.color}`);
        console.log(`   クラス: ${styles.className.substring(0, 100)}`);
        console.log();
      } else {
        console.log(`⚠️  ${name}: 表示されていません\n`);
      }
    } catch (error) {
      console.log(`❌ ${name}: 確認失敗 (${error.message})\n`);
    }
  }

  // キャラクター画像の背景確認
  console.log("\n📸 キャラクター画像確認");
  try {
    const characterImg = await page.locator("img[alt*='キャラクター'], img[alt*='ロゴ']").first();
    if (await characterImg.isVisible()) {
      const bgColor = await characterImg.evaluate(el => {
        const parent = el.parentElement;
        return window.getComputedStyle(parent).backgroundColor;
      });
      console.log(`✅ キャラクター画像親要素の背景色: ${bgColor}`);
    }
  } catch (error) {
    console.log(`⚠️  キャラクター画像確認失敗: ${error.message}`);
  }

  // SNS導線セクション詳細確認
  console.log("\n🌐 SNS導線セクション詳細確認");
  try {
    const snsSection = await page.locator("section:has(h2:contains('SNS'))").first();
    if (await snsSection.isVisible()) {
      console.log("✅ SNS導線セクション: 表示されています");

      const snsLinks = await snsSection.locator("a").count();
      console.log(`   リンク数: ${snsLinks}`);

      const content = await snsSection.textContent();
      console.log(`   含まれるテキスト: ${content.substring(0, 100)}...`);
    }
  } catch (error) {
    console.log(`⚠️  SNS導線セクション確認失敗: ${error.message}`);
  }

  await context.close();
  await browser.close();

  console.log("\n✨ CSS検証完了");
})();

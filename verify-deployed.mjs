import { chromium } from "playwright";

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log("🚀 Vercelデプロイメント確認開始...\n");

  await page.goto("https://samurai-japanese-lab.vercel.app", { waitUntil: "networkidle" });

  const screenshot = await page.screenshot({ path: "/tmp/deployed_1440px.png", fullPage: true });
  console.log("✅ Vercelスクリーンショット保存完了: /tmp/deployed_1440px.png");

  // Check computed styles
  const bgColor = await page.locator("body").evaluate(el => {
    return window.getComputedStyle(el).backgroundColor;
  });
  
  const headerBg = await page.locator("header").evaluate(el => {
    return window.getComputedStyle(el).backgroundColor;
  });
  
  const footerBg = await page.locator("footer").evaluate(el => {
    return window.getComputedStyle(el).backgroundColor;
  });

  console.log("\n🎨 デプロイメント後のスタイル確認:");
  console.log(`   body背景: ${bgColor}`);
  console.log(`   header背景: ${headerBg}`);
  console.log(`   footer背景: ${footerBg}`);

  await context.close();
  await browser.close();

  console.log("\n✨ 確認完了");
})();

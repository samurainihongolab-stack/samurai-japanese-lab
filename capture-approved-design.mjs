import { chromium } from "playwright";
import path from "path";

const __dirname = path.dirname(new URL(import.meta.url).pathname);

(async () => {
  const browser = await chromium.launch();

  try {
    // PC 1440px
    console.log("📸 PC版 1440px スクリーンショット取得中...");
    const pc1440 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page1440 = await pc1440.newPage();
    await page1440.goto("http://localhost:3000", { waitUntil: "networkidle" });
    await page1440.screenshot({ path: "/tmp/approved-pc-1440px.png", fullPage: true });
    console.log("✅ 保存: /tmp/approved-pc-1440px.png");
    await pc1440.close();

    // PC 1920px
    console.log("📸 PC版 1920px スクリーンショット取得中...");
    const pc1920 = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const page1920 = await pc1920.newPage();
    await page1920.goto("http://localhost:3000", { waitUntil: "networkidle" });
    await page1920.screenshot({ path: "/tmp/approved-pc-1920px.png", fullPage: true });
    console.log("✅ 保存: /tmp/approved-pc-1920px.png");
    await pc1920.close();

    // タブレット 768px
    console.log("📸 タブレット 768px スクリーンショット取得中...");
    const tablet = await browser.newContext({ viewport: { width: 768, height: 1024 } });
    const pageTablet = await tablet.newPage();
    await pageTablet.goto("http://localhost:3000", { waitUntil: "networkidle" });
    await pageTablet.screenshot({ path: "/tmp/approved-tablet-768px.png", fullPage: true });
    console.log("✅ 保存: /tmp/approved-tablet-768px.png");
    await tablet.close();

    // スマートフォン 375px
    console.log("📸 スマートフォン 375px スクリーンショット取得中...");
    const sp375 = await browser.newContext({ viewport: { width: 375, height: 667 } });
    const page375 = await sp375.newPage();
    await page375.goto("http://localhost:3000", { waitUntil: "networkidle" });
    await page375.screenshot({ path: "/tmp/approved-sp-375px.png", fullPage: true });
    console.log("✅ 保存: /tmp/approved-sp-375px.png");
    await sp375.close();

    // スマートフォン 390px
    console.log("📸 スマートフォン 390px スクリーンショット取得中...");
    const sp390 = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page390 = await sp390.newPage();
    await page390.goto("http://localhost:3000", { waitUntil: "networkidle" });
    await page390.screenshot({ path: "/tmp/approved-sp-390px.png", fullPage: true });
    console.log("✅ 保存: /tmp/approved-sp-390px.png");
    await sp390.close();

    console.log("\n✨ スクリーンショット取得完了!");
  } catch (error) {
    console.error("❌ エラーが発生しました:", error);
  } finally {
    await browser.close();
  }
})();

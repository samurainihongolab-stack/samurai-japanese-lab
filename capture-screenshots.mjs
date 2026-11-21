import { chromium } from "playwright";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

(async () => {
  const browser = await chromium.launch();

  try {
    // PC版 (1440px)
    console.log("📸 PC版スクリーンショット取得中 (1440px)...");
    const pcContext = await browser.newContext({
      viewport: { width: 1440, height: 900 }
    });
    const pcPage = await pcContext.newPage();
    await pcPage.goto("http://localhost:3000", { waitUntil: "networkidle" });
    const pcPath = path.join("/tmp", "pc_1440px.png");
    await pcPage.screenshot({ path: pcPath, fullPage: true });
    console.log(`✅ PC版保存完了: ${pcPath}`);
    await pcContext.close();

    // スマートフォン版 (375px)
    console.log("📸 スマートフォン版スクリーンショット取得中 (375px)...");
    const spContext = await browser.newContext({
      viewport: { width: 375, height: 667 }
    });
    const spPage = await spContext.newPage();
    await spPage.goto("http://localhost:3000", { waitUntil: "networkidle" });
    const spPath = path.join("/tmp", "sp_375px.png");
    await spPage.screenshot({ path: spPath, fullPage: true });
    console.log(`✅ スマートフォン版保存完了: ${spPath}`);
    await spContext.close();

    console.log("\n✨ スクリーンショット取得完了!");
    console.log(`PC版: ${pcPath}`);
    console.log(`スマートフォン版: ${spPath}`);
  } catch (error) {
    console.error("❌ エラーが発生しました:", error);
  } finally {
    await browser.close();
  }
})();

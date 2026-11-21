import { chromium } from "playwright";

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // エラー・警告をキャッチ
  const errors = [];
  const warnings = [];

  page.on("console", msg => {
    if (msg.type() === "error") {
      errors.push(msg.text());
    } else if (msg.type() === "warning") {
      warnings.push(msg.text());
    }
  });

  page.on("response", response => {
    if (response.url().includes(".css") && response.status() !== 200) {
      console.log(`⚠️  CSS ファイル取得失敗: ${response.url()} (HTTP ${response.status()})`);
    }
  });

  console.log("🔍 CSS 診断開始\n");

  await page.goto("http://localhost:3000", { waitUntil: "networkidle" });

  // CSSファイルが取得されているか確認
  console.log("📄 CSS ファイル読み込み確認:");
  const links = await page.locator("link[rel='stylesheet']").count();
  console.log(`   スタイルシートリンク数: ${links}\n`);

  if (links > 0) {
    const hrefs = await page.locator("link[rel='stylesheet']").all();
    for (let i = 0; i < hrefs.length && i < 3; i++) {
      const href = await hrefs[i].getAttribute("href");
      console.log(`   - ${href}`);
    }
  }

  // Computed Styles 確認
  console.log("\n🎨 Computed Styles 確認:");

  const tests = [
    {
      name: "body（背景色）",
      selector: "body",
      style: "backgroundColor"
    },
    {
      name: "header（背景色）",
      selector: "header",
      style: "backgroundColor"
    },
    {
      name: "footer（背景色）",
      selector: "footer",
      style: "backgroundColor"
    },
    {
      name: "div.bg-white（白背景クラス）",
      selector: "div.bg-white",
      style: "backgroundColor"
    },
    {
      name: "div.bg-navy（navy背景クラス）",
      selector: "div.bg-navy",
      style: "backgroundColor"
    },
    {
      name: "button.bg-navy",
      selector: "button.bg-navy",
      style: "backgroundColor"
    }
  ];

  for (const test of tests) {
    try {
      const element = await page.locator(test.selector).first();
      if (await element.isVisible()) {
        const value = await element.evaluate((el, style) => {
          return window.getComputedStyle(el)[style];
        }, test.style);

        console.log(`✅ ${test.name}: ${value}`);
      } else {
        console.log(`⚠️  ${test.name}: 要素が表示されていません`);
      }
    } catch (error) {
      console.log(`❌ ${test.name}: 確認失敗`);
    }
  }

  // Tailwind クラス確認
  console.log("\n📋 Tailwind クラス適用確認:");
  const bodyClasses = await page.locator("body").first().getAttribute("class");
  console.log(`   body: ${bodyClasses}`);

  const headerClasses = await page.locator("header").first().getAttribute("class");
  console.log(`   header: ${headerClasses?.substring(0, 100)}...`);

  // エラー・警告報告
  console.log("\n⚠️  コンソールエラー:");
  if (errors.length === 0) {
    console.log("   なし ✅");
  } else {
    errors.slice(0, 5).forEach(err => console.log(`   - ${err}`));
  }

  console.log("\n⚠️  コンソール警告:");
  if (warnings.length === 0) {
    console.log("   なし ✅");
  } else {
    warnings.slice(0, 3).forEach(warn => console.log(`   - ${warn}`));
  }

  // HTML 構造確認
  console.log("\n📐 HTML 構造確認:");
  const hasHeader = await page.locator("header").count() > 0;
  const hasMain = await page.locator("main").count() > 0;
  const hasFooter = await page.locator("footer").count() > 0;

  console.log(`   <header>: ${hasHeader ? "✅" : "❌"}`);
  console.log(`   <main>: ${hasMain ? "✅" : "❌"}`);
  console.log(`   <footer>: ${hasFooter ? "✅" : "❌"}`);

  await context.close();
  await browser.close();

  console.log("\n✨ 診断完了");
})();

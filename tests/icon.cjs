const fs = require("node:fs");
const { chromium } = require("@playwright/test");
(async () => {
  const engine = (await import("@sparticuz/chromium")).default;
  const browser = await chromium.launch({
    headless: true,
    executablePath: await engine.executablePath(),
    args: engine.args,
  });
  const page = await browser.newPage({
    viewport: { width: 1024, height: 1024 },
    deviceScaleFactor: 1,
  });
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><rect width="1024" height="1024" fill="#073F32"/><g transform="translate(222 220) scale(24)"><path d="M3 10L12 3l9 7v11h-6v-7H9v7H3Z" stroke="#E4F1E9" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/></g></svg>';
  fs.writeFileSync("assets/app-icon.svg", svg);
  await page.setContent("<style>body{margin:0}</style>" + svg);
  await page.screenshot({ path: "assets/icon.png" });
  await browser.close();
  const config = JSON.parse(fs.readFileSync("app.json"));
  config.expo.android.adaptiveIcon = {
    foregroundImage: "./assets/icon.png",
    backgroundColor: "#073F32",
  };
  fs.writeFileSync("app.json", JSON.stringify(config, null, 2) + "\n");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

const { spawn } = require("node:child_process");
const { mkdir, mkdtemp, rm } = require("node:fs/promises");
const { once } = require("node:events");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { chromium, expect } = require("@playwright/test");

(async () => {
  const dir = await mkdtemp(join(tmpdir(), "anvira-telugu-"));
  const base = "http://127.0.0.1:4482";
  const api = spawn(process.execPath, ["server/index.mjs"], {
    env: {
      ...process.env,
      APP_MODE: "demo",
      PAYMENT_MODE: "demo",
      NODE_ENV: "test",
      PORT: "4482",
      DB_PATH: join(dir, "test.sqlite"),
      WEB_DIST_DIR: process.env.WEB_DIST_DIR || "dist-demo",
      RUN_BACKGROUND_JOBS: "false",
      ALLOWED_ORIGINS: base,
    },
    stdio: ["ignore", "pipe", "inherit"],
  });
  let browser;
  try {
    await new Promise((resolve, reject) => {
      api.stdout.on("data", (d) => {
        if (d.toString().includes("listening")) resolve();
      });
      api.once("error", reject);
      api.once("exit", (code) => reject(Error("API exit " + code)));
    });
    browser = await chromium.launch({
      headless: true,
      executablePath: process.env.CHROMIUM_EXECUTABLE,
    });
    const page = await browser.newPage({
      viewport: { width: 320, height: 850 },
      reducedMotion: "reduce",
    });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(base + "/welcome");
    await page.locator(".mp-header-language").click();
    const hero = page.getByRole("heading", {
      name: "మీ ఇంటి వద్దే మెరుగైన సేవలు",
      exact: true,
    });
    await expect(hero).toBeVisible();
    await expect(hero).toHaveCSS("letter-spacing", "normal");
    expect(await page.locator("html").getAttribute("lang")).toBe("te");
    await expect(
      page
        .locator(".mp-monthly")
        .getByText("నెలవారీ సభ్యత్వం", { exact: true }),
    ).toBeVisible();
    await mkdir("evidence", { recursive: true });
    await page.screenshot({
      path: "evidence/telugu-website-home.png",
      fullPage: true,
    });
    const overflow = await page.locator(".mp").evaluate((el) => ({
      scroll: el.scrollWidth,
      width: el.clientWidth,
      elements: [...el.querySelectorAll("*")]
        .filter(
          (node) => node.getBoundingClientRect().right > el.clientWidth + 1,
        )
        .slice(0, 12)
        .map((node) => [node.className, node.textContent.slice(0, 45)]),
    }));
    expect(overflow.scroll, JSON.stringify(overflow)).toBeLessThanOrEqual(
      overflow.width,
    );
    await page.locator(".mp-monthly").getByRole("link").click();
    await expect(
      page.getByRole("heading", {
        name: "కారు సంరక్షణ",
        level: 1,
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: "నెలవారీ ధర, వచ్చే రోజులు",
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByRole("textbox", { name: "సేవలను వెతకండి", exact: true })
      .fill("కారు సంరక్షణ");
    await expect(page.locator(".mp:visible .mp-service")).toHaveCount(1);
    await page.reload();
    await expect(
      page.getByRole("heading", {
        name: "కారు సంరక్షణ",
        level: 1,
        exact: true,
      }),
    ).toBeVisible();

    await page.goto(base + "/sign-in?sample=customer");
    await page.waitForURL("**/home", { timeout: 12000 });
    await expect(
      page
        .getByText("మీ ఇంటి కోసం సేవలు", { exact: true })
        .filter({ visible: true }),
    ).toBeVisible();
    await page
      .getByRole("button", {
        name: "నెలవారీ కారు సంరక్షణను చూడండి",
        exact: true,
      })
      .filter({ visible: true })
      .click();
    await page.waitForURL("**/service/car-cleaning");
    await expect(
      page
        .getByText("నెలవారీ సభ్యత్వం", { exact: true })
        .filter({ visible: true }),
    ).toBeVisible();
    await page.screenshot({
      path: "evidence/telugu-monthly-car-care.png",
      fullPage: true,
    });
    await expect(
      page.getByRole("button", { name: "కొనసాగించండి", exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole("button", {
        name: "నెలవారీ ప్లాన్ కోసం అభ్యర్థించండి",
        exact: true,
      })
      .filter({ visible: true })
      .click();
    await page.waitForURL("**/quotes?serviceId=car-cleaning");
    await page
      .getByRole("textbox", { name: "శుభ్రత అవసరాలు, మీకు అనుకూలమైన రోజులు" })
      .fill("మంగళవారం, శుక్రవారం ఉదయం కావాలి.");
    await page
      .getByRole("textbox", { name: "కారు తయారీ సంస్థ, మోడల్ (తప్పనిసరి)" })
      .fill("మారుతి స్విఫ్ట్");
    await page
      .getByRole("textbox", { name: "పార్కింగ్ వివరాలు (తప్పనిసరి)" })
      .fill("బేస్‌మెంట్ స్థలం 14");
    await page
      .getByRole("textbox", { name: "సేవ అందించే చిరునామా" })
      .fill("షాద్‌నగర్, గార్డెన్ వీధి 12");
    await page
      .getByRole("textbox", { name: "పిన్ కోడ్", exact: true })
      .fill("509216");
    await page
      .getByRole("button", { name: "నెలవారీ ప్లాన్ అభ్యర్థన పంపండి" })
      .click();
    await expect(
      page.getByText("మంగళవారం, శుక్రవారం ఉదయం కావాలి.", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: "చెల్లింపుకు కొనసాగించండి",
        exact: true,
      }),
    ).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);

    const owner = await browser.newPage({
      viewport: { width: 1100, height: 960 },
    });
    owner.on("pageerror", (error) => errors.push(error.message));
    await owner.addInitScript(() =>
      localStorage.setItem("anvira-language", "te"),
    );
    await owner.goto(base + "/staff?sample=owner");
    await owner.waitForURL("**/dashboard/home", { timeout: 12000 });
    await owner.goto(base + "/dashboard/quotes");
    await expect(
      owner.getByText("నెలవారీ సభ్యత్వం", { exact: true }),
    ).toBeVisible();
    await owner
      .getByRole("button", { name: "ప్రతిపాదన సిద్ధం చేయండి" })
      .click();
    await expect(
      owner.getByRole("textbox", {
        name: "నెలవారీ ధర (పన్నులతో సహా పూర్తి రూపాయల్లో)",
      }),
    ).toBeVisible();
    expect(errors).toEqual([]);
    console.log(
      "Passed: Telugu website and app at 320px, localized search and persistent language, monthly customer request and Owner pricing.",
    );
  } finally {
    await browser?.close();
    if (api.exitCode === null) {
      const exited = once(api, "exit");
      api.kill();
      await exited;
    }
    await rm(dir, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

const { spawn } = require("node:child_process");
const { mkdtemp, rm, mkdir } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { chromium, expect } = require("@playwright/test");
(async () => {
  const temp = await mkdtemp(join(tmpdir(), "anvira-marketing-"));
  const api = spawn(process.execPath, ["server/index.mjs"], {
    env: {
      ...process.env,
      NODE_ENV: "test",
      APP_MODE: "demo",
      PAYMENT_MODE: "demo",
      PORT: "4699",
      WEB_DIST_DIR: "dist",
      DB_PATH: join(temp, "demo.sqlite"),
      RUN_BACKGROUND_JOBS: "false",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  await new Promise((resolve, reject) => {
    api.stdout.on("data", (d) => {
      if (d.toString().includes("listening")) resolve();
    });
    api.on("error", reject);
    api.on("exit", (c) => reject(Error("API exited " + c)));
  });
  let browser;
  const errors = [],
    results = [];
  try {
    await mkdir("evidence", { recursive: true });
    browser = await chromium.launch({
      headless: true,
      executablePath: process.env.CHROMIUM_EXECUTABLE,
    });
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
      reducedMotion: "reduce",
    });
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("**/api/public", (r) =>
      r.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          supportPhone: "9123456789",
          termsUrl: "",
          privacyUrl: "",
          policyPublished: false,
        }),
      }),
    );
    await page.addInitScript(() => {
      window.open = (url) => {
        window.__enquiryDraft = String(url);
        return null;
      };
    });
    const base = "http://127.0.0.1:4699";
    await page.goto(base + "/welcome");
    await expect(
      page.getByRole("heading", { name: "Good care. Right at home." }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: "Explore Doorstep car cleaning",
        exact: true,
      }),
    ).toHaveCount(1);
    await expect(page.getByRole("button", { name: /^Explore / })).toHaveCount(
      9,
    );
    const logo = page.locator(".brand-image");
    await expect(logo).toBeVisible();
    await expect
      .poll(() => logo.evaluate((el) => el.complete && el.naturalWidth > 0))
      .toBe(true);
    expect(
      await page
        .locator(".anvira-site")
        .evaluate((el) =>
          getComputedStyle(el).getPropertyValue("--green").trim(),
        ),
    ).toBe("#12634F");
    await expect
      .poll(() =>
        page
          .locator(".hero-visual")
          .evaluate((el) => Number(getComputedStyle(el).opacity)),
      )
      .toBe(1);
    await expect
      .poll(() =>
        page
          .locator(".hero-photo img")
          .evaluate((el) => el.complete && el.naturalWidth > 0),
      )
      .toBe(true);
    await page.screenshot({ path: "evidence/marketing-desktop.png" });
    results.push(
      "Original theme and new logo, nine services and monthly car-care price render",
    );
    await page
      .getByRole("button", {
        name: "Explore Doorstep car cleaning",
        exact: true,
      })
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("dialog")).toContainText("included visits");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.getByRole("button", { name: "Repairs", exact: true }).click();
    await expect(page.getByRole("button", { name: /^Explore / })).toHaveCount(
      3,
    );
    await page
      .getByRole("button", { name: "All services", exact: true })
      .click();
    await expect(page.getByRole("button", { name: /^Explore / })).toHaveCount(
      9,
    );
    results.push(
      "Service details, Escape/focus restoration and category filters work",
    );
    await page
      .getByRole("button", { name: "Arrange a laundry pickup", exact: true })
      .click();
    await expect(page.getByLabel("Service", { exact: true })).toHaveValue(
      "laundry",
    );
    await page.getByLabel("Your name", { exact: true }).fill("Demo Customer");
    await page
      .getByLabel("Locality or PIN code", { exact: true })
      .fill("Shadnagar 509216");
    await page
      .getByRole("button", { name: "Continue on WhatsApp", exact: true })
      .click();
    const draft = await page.evaluate(() => window.__enquiryDraft);
    expect(draft).toContain("https://wa.me/919123456789");
    expect(decodeURIComponent(draft)).toContain("Laundry & dry cleaning");
    results.push(
      "Laundry CTA selects pickup enquiry and prepares correct WhatsApp draft without sending",
    );
    await page
      .getByRole("button", { name: "▷ Watch car-care film", exact: true })
      .click();
    await expect(page.locator("video")).toBeVisible();
    await expect
      .poll(() => page.locator("video").evaluate((el) => el.readyState))
      .toBeGreaterThan(0);
    const loaded = await page
      .locator("img")
      .evaluateAll((imgs) =>
        imgs
          .filter((i) => i.getAttribute("src")?.startsWith("/images/"))
          .every((i) => i.complete && i.naturalWidth > 0),
      );
    expect(loaded).toBe(true);
    results.push("Service photography and on-demand car-care video load");
    await page.setViewportSize({ width: 360, height: 850 });
    await page.goto(base + "/welcome");
    await page
      .getByRole("button", { name: "Open navigation", exact: true })
      .click();
    await expect(
      page.getByRole("link", { name: "Staff portal", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Close navigation", exact: true })
      .click();
    expect(
      await page
        .locator(".anvira-site")
        .evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true);
    await page.screenshot({ path: "evidence/marketing-mobile.png" });
    results.push(
      "360px navigation, layout and reduced-motion preference work without overflow",
    );
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole("link", { name: "Staff portal", exact: true }).click();
    await page.waitForURL("**/staff");
    await expect(page.getByLabel("Email address", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Google|Apple/ }),
    ).toHaveCount(0);
    results.push("Staff portal remains email/password only");
    expect(errors).toEqual([]);
    console.log(
      JSON.stringify(
        { passed: results.length, results, runtimeErrors: errors },
        null,
        2,
      ),
    );
  } finally {
    await browser?.close();
    api.kill("SIGTERM");
    await new Promise((r) => api.once("exit", r));
    await rm(temp, { recursive: true, force: true });
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

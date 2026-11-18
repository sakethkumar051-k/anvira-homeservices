// Isolated guest discovery/booking handoff. No live users, SMS, payments or cloud data.
const { spawn } = require("node:child_process");
const { mkdtemp, rm, mkdir, writeFile } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { chromium, expect } = require("@playwright/test");
(async () => {
  const temp = await mkdtemp(join(tmpdir(), "anvira-six-services-"));
  const base = "http://localhost:4709";
  const api = spawn(process.execPath, ["server/index.mjs"], {
    env: {
      ...process.env,
      APP_MODE: "demo",
      PAYMENT_MODE: "demo",
      NODE_ENV: "test",
      SEED_DEMO_PEOPLE: "false",
      PORT: "4709",
      WEB_DIST_DIR: process.env.MARKETPLACE_WEB_DIST_DIR || "dist-auth-review",
      DB_PATH: join(temp, "preview.sqlite"),
      ALLOWED_ORIGINS: base,
      RUN_BACKGROUND_JOBS: "false",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let browser;
  const errors = [],
    results = [];
  try {
    await new Promise((resolve, reject) => {
      api.stdout.on("data", (d) => {
        if (d.toString().includes("listening")) resolve();
      });
      api.once("error", reject);
      api.once("exit", (c) => reject(Error("API exit " + c)));
    });
    browser = await chromium.launch({
      headless: true,
      executablePath: process.env.CHROMIUM_EXECUTABLE,
    });
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      reducedMotion: "reduce",
    });
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(base + "/welcome");
    await expect(
      page.getByRole("heading", {
        name: "Good care. Right at home.",
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /^Explore / })).toHaveCount(
      6,
    );
    await mkdir("evidence", { recursive: true });
    const categories = [
      ["home", "Home cleaning"],
      ["car", "Car cleaning"],
      ["ac", "AC repair & service"],
      ["ro", "RO filter service"],
      ["plumbing", "Plumbing"],
      ["electrical", "Electrician"],
    ];
    for (const [id, label] of categories) {
      await page
        .getByRole("button", { name: "Explore " + label, exact: true })
        .click();
      await expect(page).toHaveURL(base + "/catalog?category=" + id);
      await expect(
        page.getByRole("heading", { name: label, exact: true, level: 1 }),
      ).toBeVisible();
      await expect(page.locator(".mp:visible .mp-service")).toHaveCount(1);
      await expect(page.locator(".mp:visible .mp-topic")).toHaveCount(
        id === "home" ? 4 : 3,
      );
      await expect
        .poll(() =>
          page
            .locator(".mp:visible .mp-category img")
            .evaluateAll((imgs) =>
              imgs.every((img) => img.complete && img.naturalWidth > 0),
            ),
        )
        .toBe(true);
      expect(
        await page
          .locator(".mp:visible")
          .evaluate((el) => el.scrollWidth <= el.clientWidth),
      ).toBe(true);
      await page.screenshot({ path: "evidence/marketplace-phone-category-" + id + ".png", fullPage: true });
      results.push(
        "Phone category " +
          id +
          ": published service, relevant subcategories, loaded photos, no horizontal overflow",
      );
    }
    await page.goto(base + "/catalog");
    await page
      .getByRole("textbox", { name: "Search services", exact: true })
      .fill("kitchen");
    await expect(page.locator(".mp:visible .mp-service")).toHaveCount(1);
    await expect(
      page.getByRole("heading", { name: "Kitchen cleaning", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("textbox", { name: "Search services", exact: true })
      .fill("nothing-matches-123");
    await expect(
      page.getByRole("heading", { name: "No matching bookable services" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Clear search", exact: true })
      .first()
      .click();
    await page.getByLabel("Your PIN code", { exact: true }).fill("509216");
    await page.getByRole("button", { name: "Check", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("in our service area");
    results.push(
      "Search matches subpackages, empty state recovers, and PIN code checks actual catalogue coverage",
    );
    for (const id of ["cleaning", "car-cleaning", "ac", "ro", "plumbing", "electrical"]) {
      await page.goto(base + "/service/" + id);
      await expect(page.getByRole("button", { name: "Sign in to book", exact: true })).toBeVisible();
      await expect.poll(() => page.locator("img:visible").evaluateAll(imgs => imgs.every(img => img.complete && img.naturalWidth > 0))).toBe(true);
      await page.screenshot({ path: "evidence/marketplace-phone-service-" + id + ".png", fullPage: true });
    }
    results.push("All six public service-detail screens render with loaded photography and a guest booking action");
    await page.goto(base + "/service/ro");
    const choice = page.getByRole("radio", {
      name: /Filter replacement labour/,
    });
    await expect(choice).toBeVisible();
    await choice.click();
    await page
      .getByRole("button", { name: "Sign in to book", exact: true })
      .click();
    await expect(page).toHaveURL(/\/sign-in\?returnTo=/);
    const returnTo = new URL(page.url()).searchParams.get("returnTo");
    expect(returnTo).toMatch(/^\/checkout\/ro\?packageId=/);
    await expect(
      page.getByLabel("Mobile number", { exact: true }),
    ).toBeVisible();
    results.push(
      "A guest package selection reaches phone sign-in with its exact checkout package preserved",
    );
    await mkdir("evidence", { recursive: true });
    await page.screenshot({
      path: "evidence/marketplace-phone-sign-in.png",
      fullPage: true,
    });
    await page.goto(base + "/welcome");
    await page
      .getByRole("heading", { name: "Good care. Right at home.", exact: true })
      .waitFor();
    await expect.poll(() => page.locator(".mp:visible .mp-category img").evaluateAll(imgs => imgs.every(img => img.complete && img.naturalWidth > 0))).toBe(true);
    await page.screenshot({
      path: "evidence/marketplace-phone-home.png",
      fullPage: true,
    });
    await page.locator(".mp:visible .mp-discover").evaluate(el => el.scrollIntoView({ block: "start", behavior: "instant" }));
    await page.locator(".mp:visible .mp-category img").evaluateAll(imgs => Promise.all(imgs.map(img => img.decode())));
    await page.screenshot({ path: "evidence/marketplace-phone-discovery.png", fullPage: true });
    await page.locator(".mp:visible").evaluate(el => el.scrollTop = 0);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({
      path: "evidence/marketplace-desktop-home.png",
      fullPage: true,
    });
    expect(
      await page
        .locator(".mp:visible")
        .evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true);
    await page
      .getByRole("link", { name: "Services", exact: true })
      .first()
      .click();
    await expect(page.locator(".mp:visible .mp-service")).toHaveCount(6);
    results.push("Desktop navigation exposes the same six current services");
    expect(errors).toEqual([]);
    await writeFile(
      "evidence/marketplace-verification.json",
      JSON.stringify({ results, errors }, null, 2),
    );
    console.log(JSON.stringify({ results, errors }, null, 2));
  } finally {
    await browser?.close();
    api.kill();
    await new Promise((resolve) => api.once("exit", resolve));
    await rm(temp, { recursive: true, force: true });
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

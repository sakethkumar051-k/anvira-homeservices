// Public marketing website and staff boundary. No live users, SMS, payments or cloud data.
const { spawn } = require("node:child_process");
const { mkdtemp, rm, mkdir, writeFile } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { chromium, expect } = require("@playwright/test");
(async () => {
  const temp = await mkdtemp(join(tmpdir(), "anvira-six-services-"));
  const base = "http://localhost:4712";
  const api = spawn(process.execPath, ["server/index.mjs"], {
    env: {
      ...process.env,
      APP_MODE: "demo",
      PAYMENT_MODE: "demo",
      NODE_ENV: "test",
      SEED_DEMO_PEOPLE: "false",
      PORT: "4712",
      WEB_DIST_DIR: process.env.WEBSITE_WEB_DIST_DIR || "dist",
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
      ["car", "Car Care"],
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
      await page.screenshot({
        path: "evidence/website-public-category-" + id + ".png",
        fullPage: true,
      });
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
      page.getByRole("heading", { name: "No matching services" }),
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
    await page.goto(base + "/welcome");
    await expect(
      page.getByRole("heading", {
        name: "Good care. Right at home.",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Staff portal", exact: true }),
    ).toHaveCount(2);
    await expect(
      page.locator(
        'a[href*="/sign-in"], a[href*="/bookings"], a[href*="/checkout"], a[href*="/service/"], a[href*="/profile"]',
      ),
    ).toHaveCount(0);
    await expect(page.locator(".mp-mobile-nav")).toHaveCount(0);
    await expect(
      page
        .locator(".mp:visible .mp-service")
        .getByRole("link", {
          name: /Enquire with our team|Enquire about a monthly plan/,
        }),
    ).toHaveCount(6);
    for (const path of [
      "/home",
      "/services",
      "/service/ro",
      "/bookings",
      "/cart",
      "/quotes",
      "/checkout/ro",
    ]) {
      await page.goto(base + path);
      await expect(
        page.getByRole("heading", {
          name: "Good care. Right at home.",
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        page.getByLabel("Mobile number", { exact: true }),
      ).toHaveCount(0);
    }
    results.push(
      "Customer URLs are unavailable in the website build; public pages have enquiry links and no customer accounts or app navigation",
    );
    await page.goto(base + "/sign-in");
    await expect(
      page.getByText("ANVIRA · STAFF PORTAL", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByLabel("Email address", { exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel("Mobile number", { exact: true })).toHaveCount(
      0,
    );
    await expect(
      page.getByRole("button", { name: "Continue with Google", exact: true }),
    ).toHaveCount(0);
    results.push(
      "Sign-in is the approved staff email portal; customer OTP is absent from the website",
    );
    await mkdir("evidence", { recursive: true });
    await page.screenshot({
      path: "evidence/website-staff-only-signin.png",
      fullPage: true,
    });
    await page.goto(base + "/welcome");
    await page
      .getByRole("heading", { name: "Good care. Right at home.", exact: true })
      .waitFor();
    await expect
      .poll(() =>
        page
          .locator(".mp:visible .mp-category img")
          .evaluateAll((imgs) =>
            imgs.every((img) => img.complete && img.naturalWidth > 0),
          ),
      )
      .toBe(true);
    await page.screenshot({
      path: "evidence/website-public-phone.png",
      fullPage: true,
    });
    await page
      .locator(".mp:visible .mp-discover")
      .evaluate((el) =>
        el.scrollIntoView({ block: "start", behavior: "instant" }),
      );
    await page
      .locator(".mp:visible .mp-category img")
      .evaluateAll((imgs) => Promise.all(imgs.map((img) => img.decode())));
    await page.screenshot({
      path: "evidence/website-public-services.png",
      fullPage: true,
    });
    await page.locator(".mp:visible").evaluate((el) => (el.scrollTop = 0));
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({
      path: "evidence/website-public-desktop.png",
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
    results.push(
      "Desktop website navigation exposes service information and enquiries",
    );
    expect(errors).toEqual([]);
    await writeFile(
      "evidence/website-public-verification.json",
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

// Regressions: dialog focus restoration must not undo enquiry navigation;
// service CTAs must expose the selected enquiry field on narrow screens.
const { spawn } = require("node:child_process");
const { mkdtemp, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { chromium, expect } = require("@playwright/test");

(async () => {
  const temp = await mkdtemp(join(tmpdir(), "anvira-landing-navigation-"));
  const port = process.env.LANDING_TEST_PORT || "4799";
  const base = `http://127.0.0.1:${port}`;
  const api = spawn(process.execPath, ["server/index.mjs"], {
    env: {
      ...process.env,
      NODE_ENV: "test",
      APP_MODE: "demo",
      PAYMENT_MODE: "demo",
      PORT: port,
      WEB_DIST_DIR: process.env.WEB_DIST_DIR || "dist-demo",
      DB_PATH: join(temp, "test.sqlite"),
      RUN_BACKGROUND_JOBS: "false",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let browser;
  const errors = [];
  const results = [];
  try {
    await new Promise((resolve, reject) => {
      api.stdout.on("data", (chunk) => {
        if (chunk.toString().includes("listening")) resolve();
      });
      api.once("error", reject);
      api.once("exit", (code) => reject(Error(`API exited ${code}`)));
    });
    browser = await chromium.launch({
      headless: true,
      executablePath: process.env.CHROMIUM_EXECUTABLE,
    });
    for (const [width, reducedMotion] of [
      [1440, "reduce"],
      [360, "reduce"],
      [1440, "no-preference"],
      [360, "no-preference"],
    ]) {
      console.log(
        `Checking landing navigation at ${width}px / ${reducedMotion}`,
      );
      const page = await browser.newPage({
        viewport: { width, height: 850 },
        reducedMotion,
      });
      page.on("pageerror", (error) => errors.push(error.message));
      await page.addInitScript(() => {
        // Capture the external draft without opening or sending a message.
        window.open = (url) => {
          window.__enquiryDraft = String(url);
          return null;
        };
      });
      await page.goto(base + "/welcome");
      await page
        .getByRole("heading", { name: "Good care. Right at home." })
        .waitFor();
      const explore = page.getByRole("link", {
        name: "Explore our services",
        exact: true,
      });
      await explore.focus();
      await explore.press("Enter");
      await expect(page).toHaveURL(/\/welcome#services$/);
      await expect(page.locator("#services")).toBeInViewport();
      await expect(page.locator("#services")).toBeFocused();
      const card = page.getByRole("button", {
        name: "Explore Home cleaning",
        exact: true,
      });
      await card.click();
      await page
        .getByRole("button", {
          name: "Enquire about this service",
          exact: true,
        })
        .click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      // Must remain at the destination after the exiting dialog restores focus.
      await expect(
        page.getByLabel("Service", { exact: true }),
      ).toBeInViewport();
      await expect(page.getByLabel("Service", { exact: true })).toBeFocused();
      await expect(page.getByLabel("Service", { exact: true })).toHaveValue(
        "home",
      );
      await expect(page).toHaveURL(/\/welcome#contact$/);
      expect(
        await page.locator(".anvira-site").evaluate((el) => el.scrollTop),
      ).toBeGreaterThan(3000);

      await page.getByLabel("Your name", { exact: true }).fill("Asha & Family");
      await page
        .getByLabel("Locality or PIN code", { exact: true })
        .fill("Shadnagar 509216");
      await page
        .getByLabel(/A little more detail/)
        .fill("Pickup after 6 pm & fabric care");
      const enquiryURL = page.url();
      const newTab = page.context().waitForEvent("page");
      await explore.click({
        modifiers: [process.platform === "darwin" ? "Meta" : "Control"],
      });
      const opened = await newTab;
      await opened.waitForURL(/\/welcome#services$/);
      await opened.close();
      await expect(page).toHaveURL(enquiryURL);
      await expect(page.getByLabel("Your name", { exact: true })).toHaveValue(
        "Asha & Family",
      );
      await page
        .getByRole("link", { name: "ANVIRA Services home", exact: true })
        .first()
        .click();
      await page
        .getByRole("button", { name: "Car care from ₹500/month", exact: true })
        .click();
      await expect(page.getByLabel("Service", { exact: true })).toHaveValue(
        "car",
      );
      await expect(
        page.getByLabel("Service", { exact: true }),
      ).toBeInViewport();
      if (width === 360)
        await page
          .getByRole("button", { name: "Open navigation", exact: true })
          .click();
      await page
        .getByRole("link", { name: "Laundry pickup", exact: true })
        .click();
      await expect(page).toHaveURL(/\/welcome#laundry$/);
      await expect(page.locator("#laundry")).toBeInViewport();
      await expect(page.locator("#laundry")).toBeFocused();
      if (width === 360)
        await expect(
          page.getByRole("button", { name: "Open navigation", exact: true }),
        ).toHaveAttribute("aria-expanded", "false");
      await page
        .getByRole("button", { name: "Arrange a laundry pickup", exact: true })
        .click();
      await expect(page.getByLabel("Service", { exact: true })).toBeFocused();
      await expect(
        page.getByLabel("Service", { exact: true }),
      ).toBeInViewport();
      await expect(page.getByLabel("Service", { exact: true })).toHaveValue(
        "laundry",
      );
      await expect(page.getByLabel("Your name", { exact: true })).toHaveValue(
        "Asha & Family",
      );
      await page
        .getByRole("button", { name: "Continue on WhatsApp", exact: true })
        .click();
      const draft = new URL(await page.evaluate(() => window.__enquiryDraft));
      expect(draft.hostname).toBe("wa.me");
      expect(draft.searchParams.get("text")).toContain(
        "Laundry & dry cleaning",
      );
      expect(draft.searchParams.get("text")).toContain("Asha & Family");
      expect(draft.searchParams.get("text")).toContain(
        "Pickup after 6 pm & fabric care",
      );
      expect(draft.searchParams.get("text")).toContain("Shadnagar 509216");

      await page.goto(base + "/welcome#car-care");
      await expect(page.locator("#car-care")).toBeInViewport();
      await page.goto(base + "/welcome#services");
      await card.click();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(card).toBeFocused();
      await expect(card).toBeInViewport();
      expect(
        await page
          .locator(".anvira-site")
          .evaluate((el) => el.scrollWidth <= el.clientWidth),
      ).toBe(true);
      await page
        .getByRole("link", { name: "About Us", exact: true })
        .last()
        .click();
      await expect(page).toHaveURL(/\/about$/);
      await page
        .getByRole("link", { name: "Let’s talk ↗", exact: true })
        .click();
      await expect(page).toHaveURL(/\/welcome#contact$/);
      await expect(page.locator("#contact:visible")).toBeInViewport();
      await page.goBack();
      await expect(page).toHaveURL(/\/about$/);
      results.push(
        `${width}px / ${reducedMotion}: anchors, modal enquiry, form focus, draft integrity and Escape return`,
      );
      await page.close();
    }
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
    if (api.exitCode === null)
      await new Promise((resolve) => api.once("exit", resolve));
    await rm(temp, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

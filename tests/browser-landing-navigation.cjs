// Exercise the public landing anchors and monthly enquiry on both layouts.
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
      await page.goto(base + "/welcome");
      await expect(page.getByRole("heading", { name: "Good care. Right at home." }))
        .toBeVisible();
      const explore = page.getByRole("link", {
        name: "Find your service",
        exact: true,
      });
      await explore.focus();
      await explore.press("Enter");
      await expect(page).toHaveURL(/\/welcome#services$/);
      await expect(page.locator("#services")).toBeInViewport();
      await expect(page.locator("#services")).toBeFocused();

      await page
        .getByRole("link", { name: "Explore monthly Car Care", exact: true })
        .click();
      await expect(page).toHaveURL(/\/catalog\?category=car$/);
      const offer = page.locator(".mp-service").filter({
        has: page.getByRole("heading", { name: "Monthly Car Care", exact: true }),
      });
      await expect(offer).toContainText("Monthly subscription");
      const enquiry = offer.getByRole("link", {
        name: "Enquire about a monthly plan",
        exact: true,
      });
      const destination = new URL(await enquiry.getAttribute("href"));
      if (destination.protocol === "mailto:") {
        expect(destination.searchParams.get("subject")).toContain("Monthly Car Care");
      } else {
        expect(destination.hostname).toBe("wa.me");
        expect(destination.searchParams.get("text")).toContain("Monthly Car Care");
      }
      await expect(enquiry).toHaveAttribute("target", "_blank");

      const pin = page.getByRole("textbox", { name: "Your PIN code", exact: true });
      await pin.fill("509216");
      await pin.press("Enter");
      await expect(page.getByRole("status")).toContainText("in our service area");
      expect(
        await page.locator(".mp:visible").evaluate(
          (el) => el.scrollWidth <= el.clientWidth,
        ),
      ).toBe(true);

      await page.getByRole("link", { name: "About ANVIRA", exact: true }).click();
      await expect(page).toHaveURL(/\/about$/);
      await page.getByRole("link", { name: "Let’s talk ↗", exact: true }).click();
      await expect(page).toHaveURL(/\/welcome#contact$/);
      await expect(page.locator("#contact:visible")).toBeInViewport();
      await expect(page.locator("#contact:visible")).toBeFocused();
      await page.goBack();
      await expect(page).toHaveURL(/\/about$/);
      results.push(
        `${width}px / ${reducedMotion}: anchor focus, monthly enquiry, PIN check and browser Back`,
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

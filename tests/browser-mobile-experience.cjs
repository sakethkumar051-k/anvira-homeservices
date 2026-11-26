// Run against a demo export/server; MOBILE_BASE_URL can target a running Metro web preview.
const { chromium, expect } = require("@playwright/test");
const { mkdir, writeFile, mkdtemp, rm } = require("node:fs/promises");
const { spawn } = require("node:child_process");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
(async () => {
  const base = process.env.MOBILE_BASE_URL || "http://127.0.0.1:4917";
  let api, temp;
  if (!process.env.MOBILE_BASE_URL) {
    temp = await mkdtemp(join(tmpdir(), "anvira-mobile-experience-"));
    api = spawn(process.execPath, ["server/index.mjs"], {
      env: {
        ...process.env,
        NODE_ENV: "test",
        APP_MODE: "demo",
        PAYMENT_MODE: "demo",
        SEED_DEMO_PEOPLE: "true",
        PORT: "4917",
        DB_PATH: join(temp, "test.sqlite"),
        WEB_DIST_DIR: process.env.WEB_DIST_DIR || "dist-demo",
        ALLOWED_ORIGINS: base,
        RUN_BACKGROUND_JOBS: "false",
      },
      stdio: ["ignore", "pipe", "inherit"],
    });
    await new Promise((resolve, reject) => {
      api.stdout.on("data", (d) => {
        if (String(d).includes("listening")) resolve();
      });
      api.once("error", reject);
      api.once("exit", (code) => reject(Error("Demo API exited " + code)));
    });
  }
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_EXECUTABLE,
  });
  const errors = [];
  const results = [];
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (e) => {
    if (
      e.type() === "error" &&
      /Unexpected text node|Text strings must|Maximum update|Rendered (more|fewer) hooks/.test(
        e.text(),
      )
    )
      errors.push(e.text());
  });
  const button = (name) =>
    page.getByRole("button", { name, exact: true }).filter({ visible: true });
  const visible = (locator) => locator.filter({ visible: true });
  await mkdir("evidence/mobile-redesign", { recursive: true });
  async function shot(name) {
    await expect(
      visible(page.getByText(/^(DEMO · SAMPLE SERVICES|డెమో · నమూనా సేవలు)$/)),
    ).toBeVisible();
    await page.waitForTimeout(250);
    await expect
      .poll(() => page.evaluate(() => document.body.scrollWidth <= innerWidth))
      .toBe(true);
    await page.screenshot({ path: `evidence/mobile-redesign/${name}.png` });
    results.push(name);
  }
  try {
    await page.goto(base + "/sign-in?sample=customer");
    await page.waitForURL("**/home");
    await shot("01-home-after");
    await visible(
      page.getByRole("textbox", { name: "Search services", exact: true }),
    ).fill("cleaning");
    await button("View service: Home cleaning").click();
    await page.waitForURL("**/service/cleaning");
    await shot("03-service-after");
    await button("Continue").click();
    await expect(
      visible(page.getByText("Make it your service", { exact: true })),
    ).toBeVisible();
    await shot("04-cart-after");
    await button("Continue").click();
    await expect(
      visible(page.getByText("Where and when?", { exact: true })),
    ).toBeVisible();
    await button("Back").click();
    await expect(
      visible(page.getByText("Make it your service", { exact: true })),
    ).toBeVisible();
    await button("Continue").click();
    await visible(
      page.getByRole("textbox", { name: "Your address", exact: true }),
    ).fill("42 Garden Street, Shadnagar");
    // Seeded sample visits are placed relative to the current time and can
    // occupy a fixed hour, so choose the first slot that is actually open.
    await page
      .getByRole("button", { name: /^\d+:00 slot$/ })
      .filter({ visible: true })
      .and(page.locator(":not([aria-disabled='true'])"))
      .first()
      .click();
    await shot("05-address-time-after");
    await button("Continue").click();
    await expect(
      visible(page.getByText("Review your booking", { exact: true })),
    ).toBeVisible();
    await shot("06-summary-after");
    await button("Continue to payment").click();
    await page.waitForURL("**/booking/*");
    await shot("07-detail-payment-after");
    await button("Simulate payment").click();
    await expect(
      visible(page.getByText("Professional assigned", { exact: true })).first(),
    ).toBeVisible();
    await shot("07-detail-paid-after");
    await page.goto(base + "/bookings");
    await shot("07-bookings-after");
    await visible(
      page.getByRole("tab", { name: "Past bookings", exact: true }),
    ).click();
    await expect(
      visible(page.getByText("No past bookings", { exact: true })),
    ).toBeVisible();
    await page.goto(base + "/notifications");
    await expect(
      visible(page.getByText("Payment received", { exact: true })).first(),
    ).toBeVisible();
    await shot("08-notifications-after");
    await button("Mark this page as read").click();
    await expect(button("Mark this page as read")).toHaveCount(0);
    await visible(
      page.getByRole("tab", { name: "Unread", exact: true }),
    ).click();
    await expect(
      visible(page.getByText("You’re all caught up", { exact: true })),
    ).toBeVisible();
    await button("Notification preferences").click();
    await expect(button("Enable notifications")).toBeVisible();
    // Older pages can still hold unread records: never claim the full inbox is caught up.
    await page.route("**/api/records/notifications?*", (route) =>
      route.fulfill({
        json: {
          rows: [
            {
              id: "read-page",
              title: "Read update",
              body: "Already read",
              read: true,
              createdAt: Date.now(),
            },
          ],
          nextCursor: [Date.now(), "older"],
        },
      }),
    );
    await page.goto(base + "/notifications");
    await expect(
      visible(page.getByText("Read update", { exact: true })),
    ).toBeVisible();
    await visible(
      page.getByRole("tab", { name: "Unread", exact: true }),
    ).click();
    await expect(
      visible(
        page.getByText("No unread updates on this page", { exact: true }),
      ),
    ).toBeVisible();
    await expect(button("Next notifications page")).toBeVisible();
    await page.unroute("**/api/records/notifications?*");
    await page.goto(base + "/profile");
    await shot("09-profile-after");
    await button("Saved addresses").click();
    await visible(
      page.getByRole("textbox", { name: "Your address", exact: true }),
    ).fill("42 Garden Street, Shadnagar");
    await button("Save address").click();
    await expect(button("Add an address")).toBeVisible();
    await shot("10-addresses-after");
    for (const [name, path] of [
      ["02-services-after", "/services"],
      ["11-support-after", "/support"],
      ["12-saved-cart-after", "/cart"],
      ["13-account-after", "/account"],
      ["14-care-after", "/care"],
      ["15-quotes-after", "/quotes?serviceId=car-cleaning"],
    ]) {
      await page.goto(base + path);
      await shot(name);
    }
    await page.goto(base + "/home");
    await page.setViewportSize({ width: 320, height: 850 });
    await button("Switch language").click();
    await expect(
      visible(page.getByText("మీ ఇంటి కోసం సేవలు", { exact: true })),
    ).toBeVisible();
    await shot("20-home-telugu-320");
    await button("నెలవారీ కారు సంరక్షణను చూడండి").click();
    await expect(
      visible(page.getByText("నెలవారీ సభ్యత్వం", { exact: true })).first(),
    ).toBeVisible();
    await shot("21-monthly-telugu-320");
    for (const [name, path] of [
      ["22-checkout-telugu-320", "/checkout/cleaning"],
      ["23-notifications-telugu-320", "/notifications"],
      ["24-profile-telugu-320", "/profile"],
      ["25-support-telugu-320", "/support"],
      ["26-addresses-telugu-320", "/addresses"],
    ]) {
      await page.goto(base + path);
      await shot(name);
    }
    await expect(errors, errors.join("\n")).toEqual([]);
    await writeFile(
      "evidence/mobile-redesign/verification.json",
      JSON.stringify({ results, errors }, null, 2),
    );
    console.log(
      JSON.stringify(
        {
          screens: results.length,
          booking: "created and demo payment completed",
          back: "previous step retained",
          notifications: "marked read and preferences opened",
          narrowTelugu: "passed",
          errors,
        },
        null,
        2,
      ),
    );
  } finally {
    await browser.close();
    api?.kill("SIGTERM");
    if (temp) await rm(temp, { recursive: true, force: true });
  }
})()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

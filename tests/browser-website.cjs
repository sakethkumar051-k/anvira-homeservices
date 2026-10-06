const { spawn } = require("node:child_process");
const { mkdtemp, rm, mkdir, writeFile } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { chromium, expect } = require("@playwright/test");
(async () => {
  const temp = await mkdtemp(join(tmpdir(), "anvira-site-"));
  const api = spawn(process.execPath, ["server/index.mjs"], {
    env: {
      ...process.env,
      NODE_ENV: "test",
      APP_MODE: "demo",
      PAYMENT_MODE: "demo",
      PORT: "4599",
      WEB_DIST_DIR: "dist-demo",
      DB_PATH: join(temp, "test.sqlite"),
      RUN_BACKGROUND_JOBS: "false",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  await new Promise((resolve, reject) => {
    api.stdout.on("data", (d) => {
      if (d.toString().includes("listening")) resolve();
    });
    api.once("error", reject);
    api.once("exit", (c) => reject(Error("API exited " + c)));
  });
  let browser;
  const results = [],
    errors = [];
  try {
    browser = await chromium.launch({
      headless: true,
      executablePath: process.env.CHROMIUM_EXECUTABLE,
    });
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    });
    page.on("pageerror", (e) => errors.push(e.message));
    const base = "http://127.0.0.1:4599";
    await page.goto(base + "/welcome");
    await expect(
      page.getByText("Your home deserves", { exact: false }),
    ).toBeVisible();
    await expect(
      page.getByText("Client preview · fictional services and prices", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: "Explore Doorstep car cleaning",
        exact: true,
      }),
    ).toBeVisible();
    await page.screenshot({
      path: "evidence/website-desktop.png",
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Find a service", exact: true })
      .click();
    await page.waitForURL("**/catalog");
    results.push(
      "Public website loads the active catalog and service CTA without sign-in",
    );
    await page.setViewportSize({ width: 360, height: 850 });
    await page.goto(base + "/welcome");
    await expect(
      page.getByRole("button", { name: "Find a service", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: "evidence/website-mobile.png",
      fullPage: true,
    });
    results.push("Website is usable at 360px without horizontal overflow");
    await page.route("**/api/catalog", (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ services: [], pins: [], mode: "firebase" }),
      }),
    );
    await page.goto(base + "/welcome");
    await expect(
      page.getByText("Our service catalog is being prepared.", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: "Explore Doorstep car cleaning",
        exact: true,
      }),
    ).toHaveCount(0);
    results.push(
      "Unpublished live catalog never substitutes fictional services or prices",
    );
    await page.unroute("**/api/catalog");
    await page
      .getByRole("button", {
        name: "Professional and Owner sign in",
        exact: true,
      })
      .click();
    await page.waitForURL("**/sign-in");
    await expect(
      page.getByRole("button", { name: "Enter customer app", exact: true }),
    ).toBeVisible();
    results.push("Public website leads to the correct sign-in route");
    const token = (
      await fetch(base + "/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "customer" }),
      }).then((r) => r.json())
    ).token;
    const headers = {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token,
    };
    const day = new Date(Date.now() + 8 * 86400000).toISOString().slice(0, 10);
    const booking = await fetch(base + "/api/bookings", {
      method: "POST",
      headers,
      body: JSON.stringify({
        serviceId: "cleaning",
        addons: [],
        slot: Date.parse(day + "T06:30:00Z"),
        address: { line: "Fictional demo house", pin: "509216" },
        idempotencyKey: "website-checkout-fixture",
      }),
    }).then((r) => r.json());
    const order = await fetch(
      base + "/api/bookings/" + booking.id + "/payment/order",
      { method: "POST", headers, body: "{}" },
    ).then((r) => r.json());
    const checkoutUrl = base + new URL(order.checkoutUrl).pathname;
    await page.route("https://checkout.razorpay.com/v1/checkout.js", (route) =>
      route.abort(),
    );
    await page.goto(checkoutUrl);
    await expect(
      page.getByText("Razorpay test mode", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Continue to secure checkout", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText(
      "Secure checkout could not load",
    );
    results.push(
      "Checkout labels test mode and explains a blocked provider script without claiming payment",
    );
    await page.unroute("https://checkout.razorpay.com/v1/checkout.js");
    await page.route("https://checkout.razorpay.com/v1/checkout.js", (route) =>
      route.fulfill({
        contentType: "application/javascript",
        body: "window.Razorpay=function(options){this.on=(event,fn)=>{this.fail=fn};this.open=()=>{this.fail()}}",
      }),
    );
    await page.reload();
    await page
      .getByRole("button", { name: "Continue to secure checkout", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText("Payment failed");
    const state = await fetch(base + "/api/state", { headers }).then((r) =>
      r.json(),
    );
    expect(state.bookings.find((b) => b.id === booking.id).payment).toBe(
      "pending",
    );
    results.push(
      "Provider failure remains pending and permits retry of the same checkout",
    );
    expect(errors).toEqual([]);
    await mkdir("evidence", { recursive: true });
    await writeFile(
      "evidence/website-browser-results.json",
      JSON.stringify({ passed: results.length, results, errors }, null, 2),
    );
    console.log(results.join("\n"));
  } finally {
    await browser?.close();
    api.kill();
    await new Promise((r) => api.once("exit", r));
    await rm(temp, { recursive: true, force: true });
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

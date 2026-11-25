// Run against a fresh Expo export with EXPO_PUBLIC_AUTH_MODE=demo.
const { chromium, expect } = require("@playwright/test");
const { spawn } = require("node:child_process");
const { mkdtemp, rm } = require("node:fs/promises");
const { once } = require("node:events");
const { tmpdir } = require("node:os");
const { join } = require("node:path");

(async () => {
  const temp = await mkdtemp(join(tmpdir(), "anvira-visit-cart-"));
  const base = "http://127.0.0.1:4857";
  const api = spawn(process.execPath, ["server/index.mjs"], {
    env: {
      ...process.env,
      APP_MODE: "demo",
      PAYMENT_MODE: "demo",
      NODE_ENV: "test",
      DB_PATH: join(temp, "test.sqlite"),
      PORT: "4857",
      ALLOWED_ORIGINS: base,
      RUN_BACKGROUND_JOBS: "false",
      SEED_DEMO_PEOPLE: "true",
      WEB_DIST_DIR: process.env.WEB_DIST_DIR || "dist-demo",
    },
    stdio: ["ignore", "pipe", "inherit"],
  });
  let browser;
  try {
    await new Promise((resolve, reject) => {
      api.stdout.on("data", (chunk) => {
        if (String(chunk).includes("listening")) resolve();
      });
      api.once("error", reject);
      api.once("exit", (code) => reject(Error("Demo API stopped: " + code)));
    });
    async function apiRequest(path, token, body, method) {
      const response = await fetch(base + "/api" + path, {
        method: method || (body ? "POST" : "GET"),
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + (token || ""),
        },
        body: body && JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw Error(path + ": " + data.error);
      return data;
    }
    const owner = (await apiRequest("/session", "", { role: "owner" })).token;
    const customer = (await apiRequest("/session", "", { role: "customer" }))
      .token;
    const service = (await apiRequest("/state", owner)).services.find(
      (s) => s.id === "cleaning",
    );
    await apiRequest(
      "/services/cleaning",
      owner,
      {
        ...service,
        active: true,
        status: "active",
        bookingMode: "instant",
        maxQuantity: 3,
        quantityUnit: "room",
        packageRequired: true,
        optionGroups: [],
        bookingFields: [],
        packages: [
          {
            id: "basic",
            name: "Room clean",
            price: 200,
            duration: 30,
            description: "Surfaces and floor",
            includes: ["Surfaces"],
          },
          {
            id: "full",
            name: "Room and windows",
            price: 300,
            duration: 60,
            description: "Includes windows",
            includes: ["Surfaces", "Windows"],
          },
        ],
        addons: [
          {
            id: "window",
            name: "Window clean",
            price: 50,
            duration: 30,
            packageIds: ["basic"],
          },
        ],
      },
      "PATCH",
    );
    browser = await chromium.launch({
      headless: true,
      executablePath: process.env.CHROMIUM_EXECUTABLE,
    });
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      reducedMotion: "reduce",
    });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(
      (token) => sessionStorage.setItem("anvira-demo-session", token),
      customer,
    );
    await page.goto(
      base + "/checkout/cleaning?packageId=basic&addonIds=window",
    );
    const button = (name) =>
      page.getByRole("button", { name, exact: true }).filter({ visible: true });
    const checkbox = (name) =>
      page.getByRole("checkbox", { name }).filter({ visible: true });
    await expect(checkbox("Window clean")).toBeChecked();
    await button("+").click();
    await button("Change service option").click();
    await checkbox(/^Room and windows/).click();
    await expect(checkbox("Window clean")).toHaveCount(0);
    await checkbox(/^Room clean/).click();
    await expect(checkbox("Window clean")).not.toBeChecked();
    await checkbox("Window clean").click();
    await expect(
      page
        .getByText("Draft saved on this device.", { exact: false })
        .filter({ visible: true }),
    ).toBeVisible();
    await page.waitForFunction(() =>
      Object.keys(sessionStorage).some(
        (k) =>
          k.startsWith("anvira-draft-") &&
          JSON.parse(sessionStorage.getItem(k)).data?.quantity === 2,
      ),
    );
    await page.goto(base + "/cart");
    await expect(
      page.getByText("₹450 · 90 min", { exact: true }),
    ).toBeVisible();
    await button("Review visit").click();
    await expect(checkbox("Window clean")).toBeChecked();
    await button("Continue").click();
    await page
      .getByLabel("Your address", { exact: true })
      .fill("42 Garden Street, Shadnagar");
    await page.getByLabel("PIN code", { exact: true }).fill("500000");
    await button("Continue").click();
    await expect(
      page.getByText(/Enter a complete address and a supported PIN/),
    ).toBeVisible();
    await page.getByLabel("PIN code", { exact: true }).fill("509216");
    await button("12:00 slot").click();
    await button("Continue").click();
    await button("Edit cart").click();
    await expect(checkbox("Window clean")).toBeChecked();
    await button("Continue").click();
    await button("Continue").click();
    await button("Continue to payment").click();
    await page.waitForURL(/\/booking\//);
    const id = new URL(page.url()).pathname.split("/").pop();
    const booking = await apiRequest("/bookings/" + id, customer);
    expect(booking.total).toBe(450);
    expect(booking.quantity).toBe(2);
    expect(booking.duration).toBe(90);
    await page.route(
      "**/api/bookings/" + id + "/action",
      (route) =>
        route.fulfill({
          status: 502,
          json: { error: "Payment is temporarily unavailable." },
        }),
      { times: 1 },
    );
    await button("Simulate payment").click();
    await expect(
      page
        .getByText("Payment is temporarily unavailable.")
        .filter({ visible: true })
        .first(),
    ).toBeVisible();
    expect((await apiRequest("/bookings/" + id, customer)).payment).toBe(
      "pending",
    );
    await button("Simulate payment").click();
    await expect(page.getByText("Receipt", { exact: true })).toBeVisible();
    await page.goto(base + "/cart");
    await expect(page.getByText("Your cart is empty")).toBeVisible();
    expect(errors).toEqual([]);
    console.log(
      "Passed mobile viewport: compatible extras, quantity, saved cart, unsupported PIN, available slot, editing, booking snapshot, simulated payment failure and retry, and cart cleanup.",
    );
  } finally {
    await browser?.close();
    const closed = once(api, "close");
    api.kill();
    await closed;
    await rm(temp, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

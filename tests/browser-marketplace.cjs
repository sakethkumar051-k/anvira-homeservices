const { spawn } = require("node:child_process");
const { mkdtemp, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { chromium, expect } = require("@playwright/test");
(async () => {
  const temp = await mkdtemp(join(tmpdir(), "anvira-marketplace-"));
  const api = spawn(process.execPath, ["server/index.mjs"], {
    env: {
      ...process.env,
      APP_MODE: "demo",
      PAYMENT_MODE: "demo",
      NODE_ENV: "test",
      PORT: "4303",
      DB_PATH: join(temp, "test.sqlite"),
      WEB_DIST_DIR: "dist-demo",
      ALLOWED_ORIGINS: "http://127.0.0.1:4303",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let browser;
  const errors = [];
  try {
    await new Promise((resolve, reject) => {
      api.stdout.on("data", (d) => {
        if (d.toString().includes("listening")) resolve();
      });
      api.once("exit", (c) => reject(Error("API exited " + c)));
      api.once("error", reject);
    });
    browser = await chromium.launch({
      headless: true,
      executablePath: process.env.CHROMIUM_EXECUTABLE,
    });
    const visible = (l) => l.filter({ visible: true });
    async function login(label, width) {
      const p = await browser.newPage({ viewport: { width, height: 950 } });
      p.on("pageerror", (e) => errors.push(e.message));
      await p.goto("http://127.0.0.1:4303");
      await p.getByRole("button", { name: label, exact: true }).click();
      await p.waitForURL(
        label === "Owner dashboard" ? "**/dashboard/home" : "**/home",
      );
      return p;
    }
    const setupToken = (
      await (
        await fetch("http://127.0.0.1:4303/api/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: "customer" }),
        })
      ).json()
    ).token;
    await fetch("http://127.0.0.1:4303/api/addresses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + setupToken,
      },
      body: JSON.stringify({
        line: "House 42, Shadnagar",
        pin: "509216",
        label: "Home",
      }),
    });
    const customer = await login("Enter customer app", 393),
      owner = await login("Owner dashboard", 1440);
    await customer.goto("http://127.0.0.1:4303/quotes");
    await visible(
      customer.getByRole("button", { name: "Home deep cleaning", exact: true }),
    ).click();
    await customer
      .getByLabel("Work required", { exact: true })
      .fill("Need three rooms cleaned, please include materials.");
    await customer
      .getByLabel("Service address", { exact: true })
      .fill("House 42, Shadnagar");
    await customer.getByLabel("PIN code", { exact: true }).fill("509216");
    await customer
      .getByRole("button", { name: "Send quote request", exact: true })
      .click();
    await expect(
      customer.getByText("requested · Revision 0", { exact: true }),
    ).toBeVisible();
    await owner.goto("http://127.0.0.1:4303/dashboard/quotes");
    await owner
      .getByLabel("Total price (whole rupees, including taxes)", {
        exact: true,
      })
      .fill("750");
    await owner
      .getByLabel("Approved scope and exclusions", { exact: true })
      .fill("Clean three rooms including materials. Excludes painting.");
    await owner
      .getByRole("button", { name: "Send proposal", exact: true })
      .click();
    await expect(
      owner.getByText("proposed · Revision 1", { exact: true }),
    ).toBeVisible();
    await customer
      .getByRole("button", { name: "Refresh quotes", exact: true })
      .click();
    await customer
      .getByRole("button", { name: "Accept this scope and price", exact: true })
      .click();
    await expect(
      customer.getByText("accepted · Revision 2", { exact: true }),
    ).toBeVisible();
    await customer.screenshot({
      path: "/tmp/anvira-quotes-browser.png",
      fullPage: true,
    });
    await customer
      .getByRole("button", {
        name: "Reserve and continue to payment",
        exact: true,
      })
      .click();
    await customer.waitForURL("**/booking/**");
    await expect(
      visible(customer.getByText("₹750", { exact: true })).first(),
    ).toBeVisible();
    await customer.goto("http://127.0.0.1:4303/care");
    await customer
      .getByRole("button", { name: "Save a service", exact: true })
      .click();
    await customer
      .getByRole("button", { name: "Save Home deep cleaning", exact: true })
      .click();
    await expect(
      customer.getByRole("button", {
        name: "Remove saved service",
        exact: true,
      }),
    ).toBeVisible();
    await customer
      .getByRole("button", { name: "Remove saved service", exact: true })
      .click();
    await expect(
      customer.getByRole("button", {
        name: "Remove saved service",
        exact: true,
      }),
    ).toHaveCount(0);
    await customer
      .getByRole("button", { name: "Add home asset", exact: true })
      .click();
    await customer.getByLabel("Asset name", { exact: true }).fill("Bedroom AC");
    await customer
      .getByLabel("Category", { exact: true })
      .fill("Air conditioner");
    await customer
      .getByRole("button", { name: "Save home asset", exact: true })
      .click();
    await expect(
      customer.getByText("Bedroom AC", { exact: true }),
    ).toBeVisible();
    await customer
      .getByRole("button", { name: "Add care reminder", exact: true })
      .click();
    await customer
      .getByRole("button", { name: "Save care reminder", exact: true })
      .click();
    await expect(
      customer.getByRole("button", { name: "Pause reminder", exact: true }),
    ).toBeVisible();
    await customer
      .getByRole("button", { name: "Pause reminder", exact: true })
      .click();
    await expect(
      customer.getByRole("button", { name: "Resume reminder", exact: true }),
    ).toBeVisible();
    await customer.screenshot({
      path: "/tmp/anvira-home-care-browser.png",
      fullPage: true,
    });
    await owner.goto("http://127.0.0.1:4303/dashboard/settings");
    await owner
      .getByRole("checkbox", { name: "Booking value slabs", exact: true })
      .click();
    await owner
      .getByRole("button", {
        name: "Use 10%, 15%, 20%, 25% preset",
        exact: true,
      })
      .click();
    await owner
      .getByLabel("Published terms URL", { exact: true })
      .fill("https://example.test/terms");
    await owner
      .getByLabel("Published privacy URL", { exact: true })
      .fill("https://example.test/privacy");
    await owner
      .getByLabel("Support phone (+91)", { exact: true })
      .fill("+919876543210");
    await owner
      .getByLabel("Slab 2 starts at (₹, inclusive)", { exact: true })
      .fill("0");
    await owner
      .getByRole("button", { name: "Save company settings", exact: true })
      .click();
    await expect(
      owner
        .getByText(/strictly increasing/i)
        .filter({ visible: true })
        .first(),
    ).toBeVisible();
    await owner
      .getByLabel("Slab 2 starts at (₹, inclusive)", { exact: true })
      .fill("1000");
    await owner
      .getByRole("button", { name: "Save company settings", exact: true })
      .click();
    await expect(
      owner.getByText("Settings saved", { exact: true }),
    ).toBeVisible();
    await owner.reload();
    await expect(
      owner.getByLabel("Slab 4 commission (%)", { exact: true }),
    ).toHaveValue("25");
    if (errors.length) throw Error(errors.join("\n"));
    console.log(
      "PASS: mobile quote request → desktop Owner proposal → customer acceptance → approved-price booking; home care favorites, assets, reminder creation and pause",
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

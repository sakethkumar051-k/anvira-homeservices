const { spawn } = require("node:child_process");
const { mkdtemp, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { randomUUID } = require("node:crypto");
const { chromium, expect } = require("@playwright/test");
(async () => {
  const temp = await mkdtemp(join(tmpdir(), "anvira-office-"));
  const base = "http://127.0.0.1:4312";
  const api = spawn(process.execPath, ["server/index.mjs"], {
    env: {
      ...process.env,
      APP_MODE: "demo",
      PAYMENT_MODE: "demo",
      NODE_ENV: "test",
      PORT: "4312",
      DB_PATH: join(temp, "test.sqlite"),
      WEB_DIST_DIR: "dist-demo",
      ALLOWED_ORIGINS: base,
      RUN_BACKGROUND_JOBS: "false",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let browser;
  const errors = [];
  const tokens = {};
  try {
    await new Promise((resolve, reject) => {
      api.stdout.on("data", (d) => {
        if (d.toString().includes("listening")) resolve();
      });
      api.once("exit", (c) => reject(Error("API exited " + c)));
      api.once("error", reject);
    });
    async function req(path, role, body, method) {
      const r = await fetch(base + "/api" + path, {
        method: method || (body ? "POST" : "GET"),
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + (tokens[role] || ""),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await r.json();
      if (!r.ok)
        throw Error(path + " " + r.status + " " + JSON.stringify(data));
      return data;
    }
    for (const role of ["owner", "care", "customer", "professional"])
      tokens[role] = (await req("/session", null, { role })).token;
    tokens.partner = (
      await req("/session", null, {
        role: "professional",
        professionalId: "pro-2",
      })
    ).token;
    await req("/availability", "professional", { available: false }, "PATCH");
    await req("/availability", "partner", { available: false }, "PATCH");
    const state = await req("/state", "owner");
    await req(
      "/settings",
      "owner",
      {
        ...state.settings,
        termsUrl: "https://example.test/terms",
        privacyUrl: "https://example.test/privacy",
        supportPhone: "+917989365699",
      },
      "PUT",
    );
    browser = await chromium.launch({
      headless: true,
      executablePath: process.env.CHROMIUM_EXECUTABLE,
    });
    async function page(role, width) {
      const p = await browser.newPage({ viewport: { width, height: 950 } });
      p.on("pageerror", (e) => errors.push(e.message));
      if (role === "partner") {
        await p.addInitScript(
          (token) => sessionStorage.setItem("anvira-demo-session", token),
          tokens.partner,
        );
        await p.goto(base + "/jobs");
      } else {
        await p.goto(base + (role === "customer" ? "" : "/staff"));
        await p
          .getByRole("button", {
            name: {
              owner: "Admin / Owner",
              care: "Customer Associate",
              customer: "Enter customer app",
            }[role],
            exact: true,
          })
          .click();
        await p.waitForURL(
          role === "customer" ? "**/home" : "**/dashboard/home",
        );
      }
      return p;
    }
    const owner = await page("owner", 1440);
    await owner.goto(base + "/dashboard/workers");
    await owner
      .getByRole("button", { name: "Add internal worker", exact: true })
      .click();
    await owner
      .getByRole("button", { name: "Save internal worker", exact: true })
      .click();
    await expect(
      owner.getByText("Enter a worker name with 2–100 characters.", {
        exact: true,
      }),
    ).toBeVisible();
    await owner
      .getByLabel("Worker name", { exact: true })
      .fill("SAMPLE office cleaner");
    await owner
      .getByRole("checkbox", { name: "Home deep cleaning", exact: true })
      .click();
    await owner
      .getByRole("checkbox", { name: "Works Sun", exact: true })
      .click();
    await owner
      .getByRole("button", { name: "Save internal worker", exact: true })
      .click();
    await expect(
      owner.getByText("Internal worker saved. No login account was created.", {
        exact: true,
      }),
    ).toBeVisible();
    await owner.goto(base + "/dashboard/settings");
    await owner
      .getByRole("checkbox", { name: "Enable office dispatch", exact: true })
      .click();
    await owner
      .getByRole("button", { name: "Save dispatch settings", exact: true })
      .click();
    await expect(
      owner.getByText("Office dispatch active", { exact: true }),
    ).toBeVisible();
    const customer = await page("customer", 393);
    const date = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
    const slot = Date.parse(date + "T12:00:00+05:30");
    const create = () =>
      req("/bookings", "customer", {
        serviceId: "cleaning",
        slot,
        address: { line: "House 42, private test address", pin: "509216" },
        idempotencyKey: randomUUID(),
      });
    const booking = await create();
    await customer.goto(base + "/booking/" + booking.id);
    await customer.getByRole("button", { name: /Simulate payment/i }).click();
    await expect(
      customer
        .getByText("Office arranging your visit", { exact: true })
        .first(),
    ).toBeVisible();
    const care = await page("care", 393);
    await care.goto(base + "/dashboard/bookings");
    await care
      .getByRole("button", {
        name: "Open order " + booking.id.slice(0, 8),
        exact: true,
      })
      .click();
    await care
      .getByRole("button", {
        name: "Assign SAMPLE office cleaner",
        exact: true,
      })
      .click();
    await expect(
      care
        .getByText("Team assigned", { exact: true })
        .filter({ visible: true })
        .first(),
    ).toBeVisible();
    await care
      .getByRole("button", { name: "Mark team dispatched", exact: true })
      .click();
    await care
      .getByRole("button", { name: "Record team arrival", exact: true })
      .click();
    await care
      .getByRole("button", { name: "Start internal service", exact: true })
      .click();
    await expect(
      care.getByText("Service checklist", { exact: true }),
    ).toBeVisible();
    const checks = care.getByRole("checkbox").filter({ visible: true });
    for (let i = 0; i < (await checks.count()); i++)
      await checks.nth(i).click();
    await care
      .getByLabel("Handover notes for the customer", { exact: true })
      .fill("SAMPLE walkthrough completed for client review.");
    await care
      .getByRole("button", { name: "Complete service", exact: true })
      .click();
    await expect
      .poll(async () => (await req("/bookings/" + booking.id, "owner")).status)
      .toBe("completed");
    await care.screenshot({
      path: "/tmp/anvira-office-completed.png",
      fullPage: true,
    });
    await care.goto(base + "/dashboard/workers");
    await care
      .getByRole("button", {
        name: "Mark unavailable: SAMPLE office cleaner",
        exact: true,
      })
      .click();
    await expect(
      care.getByText("Availability updated for SAMPLE office cleaner.", {
        exact: true,
      }),
    ).toBeVisible();
    await owner.goto(base + "/dashboard/settings");
    await owner
      .getByRole("checkbox", { name: "External partner fallback", exact: true })
      .click();
    await owner
      .getByRole("button", { name: "Save dispatch settings", exact: true })
      .click();
    await expect(
      owner.getByText("Dispatch settings saved", { exact: true }),
    ).toBeVisible();
    await req("/availability", "partner", { available: true }, "PATCH");
    const fallback = await create();
    await req("/bookings/" + fallback.id + "/action", "customer", {
      action: "pay",
    });
    const partner = await page("partner", 393);
    await expect(
      partner.getByRole("button", { name: "Accept this job", exact: true }),
    ).toBeVisible();
    await expect(
      partner.getByText("House 42, private test address · 509216", {
        exact: true,
      }),
    ).toHaveCount(0);
    await partner.screenshot({
      path: "/tmp/anvira-partner-offer.png",
      fullPage: true,
    });
    await partner
      .getByRole("button", { name: "Accept this job", exact: true })
      .click();
    await partner.waitForURL("**/booking/" + fallback.id);
    await expect(
      partner.getByText("House 42, private test address · 509216", {
        exact: true,
      }),
    ).toBeVisible();
    if (errors.length) throw Error(errors.join("\n"));
    console.log(
      "PASS: Owner roster validation and office settings; mobile Customer Associate assigns, dispatches and completes internal work; external fallback preserves privacy and partner accepts.",
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

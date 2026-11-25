const { spawn } = require("node:child_process");
const { mkdtemp, rm, mkdir, writeFile } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { randomUUID } = require("node:crypto");
const { chromium, expect } = require("@playwright/test");
(async () => {
  const temp = await mkdtemp(join(tmpdir(), "anvira-admin-"));
  const { createSQLiteStore } = await import("../server/lib/store.mjs");
  const { seedDemo } = await import("../server/lib/seed.mjs");
  const store = await createSQLiteStore(join(temp, "test.sqlite"));
  await seedDemo(store);
  const now = Date.now();
  const booking = {
    customerId: "customer-1",
    customerName: "Admin test customer",
    serviceId: "cleaning",
    serviceName: "Home cleaning",
    price: 850,
    total: 850,
    duration: 60,
    payment: "paid",
    refund: "none",
    address: { line: "Local test address", pin: "509216" },
    slot: now + 86400000,
    addons: [],
    checklist: [],
  };
  await store.transaction(async (tx) => {
    for (let i = 0; i < 205; i++)
      tx.put("bookings", {
        ...booking,
        id: "recent-" + i,
        status: "completed",
        createdAt: now,
      });
    tx.put("bookings", {
      ...booking,
      id: "old-dispatch",
      status: "awaiting_assignment",
      createdAt: now - 86400000,
    });
  });
  await store.close();
  const base = "http://127.0.0.1:4952";
  const api = spawn(process.execPath, ["server/index.mjs"], {
    env: {
      ...process.env,
      APP_MODE: "demo",
      PAYMENT_MODE: "demo",
      SEED_DEMO_PEOPLE: "true",
      NODE_ENV: "test",
      PORT: "4952",
      DB_PATH: join(temp, "test.sqlite"),
      WEB_DIST_DIR: "dist-demo",
      ALLOWED_ORIGINS: base,
      RUN_BACKGROUND_JOBS: "false",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let browser;
  const errors = [],
    checks = [];
  const tokens = {};
  try {
    await new Promise((resolve, reject) => {
      api.stdout.on("data", (d) => {
        if (d.toString().includes("listening")) resolve();
      });
      api.once("error", reject);
      api.once("exit", (c) => reject(Error("API exited " + c)));
    });
    async function req(path, role, body) {
      const r = await fetch(base + "/api" + path, {
        method: body ? "POST" : "GET",
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
    for (const role of ["owner", "care", "customer"])
      tokens[role] = (await req("/session", null, { role })).token;
    const ticket = await req("/tickets", "customer", {
      message: "Please help with my service schedule.",
      category: "schedule",
      idempotencyKey: randomUUID(),
    });
    await req("/service-quotes", "customer", {
      serviceId: "cleaning",
      description: "Please quote for cleaning three rooms with materials.",
      address: { line: "Local test address", pin: "509216" },
      details: {},
      idempotencyKey: randomUUID(),
    });
    browser = await chromium.launch({
      headless: true,
      executablePath: process.env.CHROMIUM_EXECUTABLE,
    });
    const p = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    });
    p.on("pageerror", (e) => errors.push(e.message));
    await p.addInitScript(
      (token) => sessionStorage.setItem("anvira-demo-session", token),
      tokens.owner,
    );
    await p.goto(base + "/dashboard/home");
    await expect(
      p.getByRole("heading", { name: "Overview", exact: true }),
    ).toBeVisible();
    await expect(
      p.getByText("Your next actions", { exact: true }),
    ).toBeVisible();
    await expect(p.getByText("Owner setup guide", { exact: true })).toHaveCount(
      0,
    );
    await p
      .getByRole("button", { name: "Review dispatch · 1", exact: true })
      .click();
    await expect(
      p.getByRole("button", { name: "Open booking old-disp", exact: true }),
    ).toBeVisible();
    await expect(
      p.getByText("Assign a worker →", { exact: true }),
    ).toBeVisible();
    await expect(p.getByText("1 on this page", { exact: true })).toBeVisible();
    checks.push("Old dispatch work found beyond 205 recent bookings");
    await p.goto(base + "/dashboard/quotes");
    await expect(
      p.getByLabel("Total price (whole rupees, including taxes)", {
        exact: true,
      }),
    ).toHaveCount(0);
    await p
      .getByRole("button", { name: "Prepare proposal", exact: true })
      .click();
    await expect(
      p.getByLabel("Total price (whole rupees, including taxes)", {
        exact: true,
      }),
    ).toBeVisible();
    checks.push("Proposal editor opens deliberately");
    await p.goto(base + "/dashboard/support");
    await p
      .getByRole("button", { name: "Acknowledge request", exact: true })
      .click();
    await expect(
      p.getByLabel("Reply to customer", { exact: true }),
    ).toHaveValue(/Thank you for contacting ANVIRA/);
    const tickets = await req("/records/tickets", "owner");
    expect(tickets.rows.find((t) => t.id === ticket.id).messages).toHaveLength(
      0,
    );
    await p
      .getByRole("button", { name: "Close conversation", exact: true })
      .click();
    await p
      .getByRole("button", { name: "Open conversation", exact: true })
      .click();
    await expect(
      p.getByLabel("Reply to customer", { exact: true }),
    ).toHaveValue(/Thank you for contacting ANVIRA/);
    await p.route("**/api/tickets/*/reply", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 700));
      await route.continue();
    });
    await p.getByRole("button", { name: "Send reply", exact: true }).click();
    await p
      .getByRole("button", { name: "Close conversation", exact: true })
      .click();
    await p
      .getByRole("button", { name: "Open conversation", exact: true })
      .click();
    await expect(
      p.getByLabel("Reply to customer", { exact: true }),
    ).toHaveValue("");
    await p
      .getByLabel("Reply to customer", { exact: true })
      .fill("We will confirm the schedule here after checking availability.");
    await p.getByRole("button", { name: "Send reply", exact: true }).click();
    await expect(p.getByText("Reply sent.", { exact: true })).toBeVisible();
    expect(
      (await req("/records/tickets", "owner")).rows.find(
        (t) => t.id === ticket.id,
      ).messages,
    ).toHaveLength(2);
    checks.push(
      "Reply drafts survive closing and delayed sends rotate the retry key",
    );
    checks.push("Reply template stays a draft until Send");
    await p.goto(base + "/dashboard/settings");
    await expect(
      p.getByRole("checkbox", { name: "Enable office dispatch", exact: true }),
    ).toBeVisible();
    await expect(p.getByLabel("Company name", { exact: true })).toHaveCount(0);
    await p
      .getByRole("button", { name: "Business & policies", exact: true })
      .click();
    await expect(p.getByLabel("Company name", { exact: true })).toBeVisible();
    await p.getByRole("button", { name: "Staff access", exact: true }).click();
    await expect(
      p.getByText("Staff access", { exact: true }).last(),
    ).toBeVisible();
    await expect(p.getByLabel("Company name", { exact: true })).toHaveCount(0);
    checks.push("Settings tasks are separate");
    await p.goto(base + "/dashboard/payouts");
    await expect(
      p.getByLabel("Payout hour (0–23 IST)", { exact: true }),
    ).toHaveCount(0);
    await p
      .getByRole("button", { name: "Payout schedule", exact: true })
      .click();
    await expect(
      p.getByLabel("Payout hour (0–23 IST)", { exact: true }),
    ).toBeVisible();
    await p
      .getByRole("button", { name: "Reconciliation", exact: true })
      .click();
    await expect(
      p.getByLabel("Booking or payout ID", { exact: true }),
    ).toBeVisible();
    checks.push("Financial review separated from schedule and reconciliation");
    await p.goto(base + "/dashboard/reports");
    await p.getByRole("button", { name: "Last 7 days", exact: true }).click();
    await expect(p.getByText("206", { exact: true })).toBeVisible();
    await p
      .getByRole("button", { name: "Staff activity", exact: true })
      .click();
    await expect(p.getByText("Audit trail", { exact: true })).toBeVisible();
    checks.push("Date preset calculates full-history report");
    await p.goto(base + "/dashboard/offers");
    await p.getByRole("button", { name: "Create offer", exact: true }).click();
    await p.getByLabel("Offer code", { exact: true }).fill("ADMINTEST");
    await p.getByRole("button", { name: "Save offer", exact: true }).click();
    await expect(p.getByText("ADMINTEST", { exact: true })).toBeVisible();
    await p
      .getByRole("button", { name: "Edit offer ADMINTEST", exact: true })
      .click();
    await expect(p.getByLabel("Offer code", { exact: true })).toHaveValue(
      "ADMINTEST",
    );
    checks.push("Offer create and edit retain saved values");
    await mkdir("evidence/admin-workspace", { recursive: true });
    for (const tab of [
      "home",
      "bookings",
      "quotes",
      "workers",
      "vendors",
      "services",
      "refunds",
      "support",
      "reports",
      "payouts",
      "banners",
      "offers",
      "settings",
      "automations",
    ]) {
      await p.goto(base + "/dashboard/" + tab);
      await expect(p.locator("main h1")).toBeVisible();
      await p.waitForTimeout(900);
      await p.screenshot({ path: "evidence/admin-workspace/" + tab + ".png" });
    }
    await p.setViewportSize({ width: 393, height: 852 });
    await p.goto(base + "/dashboard/home");
    await p.getByRole("button", { name: "Menu", exact: true }).click();
    await p.getByRole("link", { name: "Services", exact: true }).click();
    await expect(
      p.getByRole("heading", { name: "Services", exact: true }),
    ).toBeVisible();
    await expect(
      p.getByRole("link", { name: "Orders & dispatch", exact: true }),
    ).not.toBeVisible();
    expect(
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    checks.push("393px menu navigation and no page overflow");
    await p
      .getByRole("button", { name: "Switch language", exact: true })
      .click();
    await expect(
      p.getByRole("heading", { name: "సేవలు", exact: true }),
    ).toBeVisible();
    await p.screenshot({ path: "evidence/admin-workspace/mobile-telugu.png" });
    expect(
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    checks.push("Telugu screen layout");
    const care = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    });
    await care.addInitScript(
      (token) => sessionStorage.setItem("anvira-demo-session", token),
      tokens.care,
    );
    await care.goto(base + "/dashboard/home");
    await expect(
      care.getByRole("link", { name: "Roles & settings", exact: true }),
    ).toHaveCount(0);
    await expect(
      care.getByRole("link", { name: "Automations", exact: true }),
    ).toHaveCount(0);
    await care.goto(base + "/dashboard/automations");
    await expect(
      care.getByText("Owner access required", { exact: true }),
    ).toBeVisible();
    checks.push("Customer Associate role boundaries");
    expect(errors).toEqual([]);
    await writeFile(
      "evidence/admin-workspace/results.json",
      JSON.stringify({ checks, errors }, null, 2),
    );
    console.log(JSON.stringify({ checks, errors }, null, 2));
  } finally {
    if (browser) await browser.close();
    api.kill("SIGTERM");
    await new Promise((resolve) =>
      api.exitCode !== null ? resolve() : api.once("exit", resolve),
    );
    await rm(temp, { recursive: true, force: true });
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

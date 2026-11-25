const { spawn } = require("node:child_process");
const { mkdtemp, rm, mkdir, writeFile } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { randomUUID } = require("node:crypto");
const { chromium, expect } = require("@playwright/test");
const translations = require("../src/lib/translations.json");
(async () => {
  const temp = await mkdtemp(join(tmpdir(), "anvira-routing-")),
    base = "http://127.0.0.1:4953";
  const { createSQLiteStore } = await import("../server/lib/store.mjs");
  const { seedDemo } = await import("../server/lib/seed.mjs");
  const store = await createSQLiteStore(join(temp, "test.sqlite"));
  await seedDemo(store);
  await store.transaction(async (tx) => {
    const source = await tx.get("services", "car-cleaning");
    tx.put("services", {
      ...source,
      id: "monthly-test",
      name: "Monthly Car Care",
      billingPeriod: "monthly",
      bookingMode: "quote",
      packages: [],
      addons: [],
      optionGroups: [],
      packageRequired: false,
      bookingFields: [{ id: "model", label: "Car model", required: true }],
      price: 0,
      active: true,
    });
    const p = await tx.get("professionals", "pro-2");
    tx.put("users", {
      id: "pro-2",
      name: p.name,
      role: "professional",
      active: true,
    });
    tx.put("professionals", {
      ...p,
      id: "outside-2",
      name: "SAMPLE outside electrician",
    });
    tx.put("users", {
      id: "outside-2",
      name: "SAMPLE outside electrician",
      role: "professional",
      active: true,
    });
  });
  await store.close();
  const api = spawn(process.execPath, ["server/index.mjs"], {
    env: {
      ...process.env,
      APP_MODE: "demo",
      PAYMENT_MODE: "demo",
      SEED_DEMO_PEOPLE: "true",
      NODE_ENV: "test",
      PORT: "4953",
      DB_PATH: join(temp, "test.sqlite"),
      WEB_DIST_DIR: "dist-demo",
      ALLOWED_ORIGINS: base,
      RUN_BACKGROUND_JOBS: "false",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let browser;
  const tokens = {},
    errors = [],
    checks = [];
  try {
    await new Promise((resolve, reject) => {
      api.stdout.on("data", (d) => {
        if (d.toString().includes("listening")) resolve();
      });
      api.once("error", reject);
      api.once("exit", (c) => reject(Error("API exited " + c)));
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
    tokens.other = (
      await req("/session", null, {
        role: "professional",
        professionalId: "outside-2",
      })
    ).token;
    browser = await chromium.launch({
      headless: true,
      executablePath: process.env.CHROMIUM_EXECUTABLE,
    });
    async function page(role, width = 393, te = false) {
      const p = await browser.newPage({ viewport: { width, height: 950 } });
      p.on("pageerror", (e) => errors.push(e.message));
      await p.addInitScript(
        ({ token, te }) => {
          sessionStorage.setItem("anvira-demo-session", token);
          if (te) localStorage.setItem("anvira-language", "te");
        },
        { token: tokens[role], te },
      );
      return p;
    }
    const customer = await page("customer");
    await customer.goto(base + "/quotes?serviceId=monthly-test");
    await expect(
      customer.getByRole("button", {
        name: "Send monthly plan request",
        exact: true,
      }),
    ).toBeEnabled();
    await customer
      .getByRole("button", { name: "Send monthly plan request", exact: true })
      .click();
    for (const error of [
      "Describe your requirement in 15–2,000 characters.",
      "Enter at least 2 characters for this required field.",
      "Enter your full service address in 8–300 characters.",
      "Enter a valid 6-digit PIN code.",
    ])
      await expect(customer.getByText(error, { exact: true })).toBeVisible();
    await customer
      .getByLabel("Cleaning preferences and preferred days", { exact: true })
      .fill("Exterior cleaning every Monday morning.");
    await customer
      .getByLabel("Car model (required)", { exact: true })
      .fill("Tata Nexon");
    await customer
      .getByLabel("Service address", { exact: true })
      .fill("42 SAMPLE Garden Street");
    await customer.getByLabel("PIN code", { exact: true }).fill("500001");
    await customer
      .getByRole("button", { name: "Send monthly plan request", exact: true })
      .click();
    await expect(
      customer
        .getByText("This service is unavailable for that PIN code.", {
          exact: true,
        })
        .first(),
    ).toBeVisible();
    await expect(
      customer.getByLabel("PIN code", { exact: true }),
    ).toBeFocused();
    await customer.getByLabel("PIN code", { exact: true }).fill("509216");
    await customer
      .getByRole("button", { name: "Send monthly plan request", exact: true })
      .click();
    await expect(
      customer.getByText(
        "Monthly plan request sent. The team will confirm the price and schedule. No payment has been taken.",
        { exact: true },
      ),
    ).toBeVisible();
    expect((await req("/state", "customer")).bookings).toHaveLength(0);
    checks.push(
      "Monthly request shows every missing field, rejects unsupported PIN and submits without billing",
    );
    await mkdir("evidence/automatic-dispatch", { recursive: true });
    await customer.screenshot({
      path: "evidence/automatic-dispatch/monthly-request.png",
    });
    const te = await page("customer", 393, true);
    await te.goto(base + "/quotes?serviceId=monthly-test");
    await te
      .getByRole("button", {
        name: translations["Send monthly plan request"],
        exact: true,
      })
      .click();
    await expect(
      te.getByText(
        translations["Describe your requirement in 15–2,000 characters."],
        { exact: true },
      ),
    ).toBeVisible();
    expect(
      await te.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await te.screenshot({
      path: "evidence/automatic-dispatch/monthly-errors-telugu.png",
    });
    checks.push("Telugu validation and mobile layout");
    const owner = await page("owner", 1440);
    await owner.goto(base + "/dashboard/settings");
    await owner
      .getByRole("button", {
        name: "Use recommended automatic flow",
        exact: true,
      })
      .click();
    await owner
      .getByRole("button", { name: "Save dispatch settings", exact: true })
      .click();
    await expect(
      owner.getByText("Dispatch settings saved", { exact: true }),
    ).toBeVisible();
    expect((await req("/state", "owner")).settings.internalAssignmentMode).toBe(
      "automatic",
    );
    const day = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10),
      slot = Date.parse(day + "T12:00:00+05:30");
    const create = () =>
      req("/bookings", "customer", {
        serviceId: "cleaning",
        slot,
        address: { line: "42 PRIVATE Customer Street", pin: "509216" },
        idempotencyKey: randomUUID(),
      });
    const first = await create();
    const internal = await req(
      "/bookings/" + first.id + "/action",
      "customer",
      { action: "pay" },
    );
    expect(internal.status).toBe("confirmed");
    expect(internal.professionalType).toBe("In-house");
    await owner.goto(base + "/booking/" + first.id);
    await expect(
      owner.getByText("ANVIRA team assigned", { exact: true }).first(),
    ).toBeVisible();
    await owner
      .getByRole("button", { name: "Why this assignment?", exact: true })
      .click();
    await expect(
      owner.getByText("Team eligibility", { exact: true }),
    ).toBeVisible();
    checks.push(
      "Paid booking assigns ANVIRA automatically with readable explanation",
    );
    await owner.goto(base + "/dashboard/settings");
    await owner
      .getByRole("checkbox", {
        name: "Pause ANVIRA team · Home cleaning · 509216",
        exact: true,
      })
      .click();
    await owner
      .getByRole("button", {
        name: "Save team availability rules",
        exact: true,
      })
      .click();
    await expect(
      owner.getByText("Team availability rules saved", { exact: true }),
    ).toBeVisible();
    const outside = await page("partner");
    await outside.goto(base + "/jobs");
    const second = await create();
    const offered = await req(
      "/bookings/" + second.id + "/action",
      "customer",
      { action: "pay" },
    );
    expect(offered.dispatch.state).toBe("offering");
    expect(offered.dispatchProgress.round).toBe(1);
    const partnerOffers = await req("/partner-offers", "partner");
    expect(partnerOffers.offers.some((o) => o.bookingId === second.id)).toBe(
      true,
    );
    await expect(
      outside.getByRole("button", { name: "Accept this job", exact: true }),
    ).toBeVisible({ timeout: 12000 });
    expect(await outside.locator("body").innerText()).not.toContain(
      "42 PRIVATE Customer Street",
    );
    await outside.screenshot({
      path: "evidence/automatic-dispatch/outside-offer.png",
    });
    await outside
      .getByRole("button", { name: "Accept this job", exact: true })
      .click();
    await outside.waitForURL("**/booking/" + second.id);
    await expect(
      outside.getByText(/42 PRIVATE Customer Street/).first(),
    ).toBeVisible();
    expect(
      (await req("/bookings/" + second.id, "owner")).professionalType,
    ).toBe("Partner");
    await owner.goto(base + "/booking/" + second.id);
    await expect(
      owner.getByText("Outside professional accepted", { exact: true }).first(),
    ).toBeVisible();
    await owner
      .getByRole("button", { name: "Why this assignment?", exact: true })
      .click();
    await expect(
      owner.getByText("ANVIRA team paused for this service and area", {
        exact: true,
      }),
    ).toBeVisible();
    await owner.screenshot({
      path: "evidence/automatic-dispatch/admin-routing.png",
    });
    checks.push(
      "Service/PIN pause routes to outside inbox, hides private details until acceptance and updates admin",
    );
    const before = await req("/state", "owner");
    await owner.goto(base + "/dashboard/automations");
    await owner
      .getByRole("button", { name: "Dispatch simulator", exact: true })
      .click();
    const scenarios = [
      ["ANVIRA worker available", "ANVIRA team assigned"],
      ["ANVIRA unavailable · outside accepts", "Outside professional accepted"],
      ["No eligible team available", "Office action needed"],
      [
        "Two professionals accept together",
        "Only one professional can win this booking.",
      ],
      [
        "Nobody accepts · show escalation",
        "No outside professional accepted within the offer window",
      ],
      [
        "Push notification fails",
        "Simulated push failure: the job remains in the offer inbox until expiry. Delivery retries do not extend its deadline.",
      ],
    ];
    for (const [scenario, result] of scenarios) {
      await owner.getByRole("button", { name: scenario, exact: true }).click();
      await owner
        .getByRole("button", { name: "Run dispatch simulation", exact: true })
        .click();
      await expect(
        owner.getByText(result, { exact: true }).first(),
      ).toBeVisible();
    }
    await owner.screenshot({
      path: "evidence/automatic-dispatch/simulator.png",
    });
    const after = await req("/state", "owner");
    for (const key of ["bookings", "notifications", "audit"])
      expect(after[key].map((x) => x.id)).toEqual(before[key].map((x) => x.id));
    checks.push(
      "All six simulator scenarios leave bookings, audit and real alerts unchanged",
    );
    expect(errors).toEqual([]);
    await writeFile(
      "evidence/automatic-dispatch/results.json",
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

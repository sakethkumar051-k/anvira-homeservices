const { spawn } = require("node:child_process");
const { mkdtemp, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { chromium, expect } = require("@playwright/test");
(async () => {
  const temp = await mkdtemp(join(tmpdir(), "anvira-service-guide-"));
  const base = "http://127.0.0.1:4324";
  const api = spawn(process.execPath, ["server/index.mjs"], {
    env: {
      ...process.env,
      APP_MODE: "demo",
      PAYMENT_MODE: "demo",
      NODE_ENV: "test",
      PORT: "4324",
      DB_PATH: join(temp, "test.sqlite"),
      WEB_DIST_DIR: "dist-demo",
      ALLOWED_ORIGINS: base,
      RUN_BACKGROUND_JOBS: "false",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let browser;
  const errors = [];
  let ownerToken;
  try {
    await new Promise((resolve, reject) => {
      api.stdout.on("data", (d) => {
        if (d.toString().includes("listening")) resolve();
      });
      api.once("exit", (c) => reject(Error("Server exit " + c)));
      api.once("error", reject);
    });
    async function req(path, body, method) {
      const r = await fetch(base + "/api" + path, {
        method: method || (body ? "POST" : "GET"),
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + (ownerToken || ""),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await r.json();
      if (!r.ok)
        throw Error(path + " " + r.status + " " + JSON.stringify(data));
      return data;
    }
    ownerToken = (await req("/session", { role: "owner" })).token;
    browser = await chromium.launch({
      headless: true,
      executablePath: process.env.CHROMIUM_EXECUTABLE,
    });
    async function login(label, width) {
      const p = await browser.newPage({ viewport: { width, height: 950 } });
      p.on("pageerror", (e) => errors.push(e.message));
      await p.goto(base);
      await p.getByRole("button", { name: label, exact: true }).click();
      await p.waitForURL(
        label === "Owner dashboard" ? "**/dashboard/home" : "**/home",
      );
      return p;
    }
    const owner = await login("Owner dashboard", 1440);
    await owner
      .getByRole("link", {
        name: "Create Customer Associate account",
        exact: true,
      })
      .click();
    await owner.waitForURL("**/dashboard/settings?section=staff");
    await expect(owner.getByLabel("Staff name", { exact: true })).toBeVisible();
    await owner
      .getByLabel("Staff name", { exact: true })
      .fill("SAMPLE Associate");
    await owner
      .getByLabel("Staff email", { exact: true })
      .fill("sample.associate@example.test");
    await owner.getByLabel("Staff password", { exact: true }).fill("short");
    await owner
      .getByLabel("Confirm staff password", { exact: true })
      .fill("short");
    await owner
      .getByRole("button", { name: "Create staff account", exact: true })
      .click();
    await expect(
      owner
        .getByText("Use at least 8 characters for the staff password.", {
          exact: true,
        })
        .filter({ visible: true })
        .first(),
    ).toBeVisible();
    await owner
      .getByLabel("Staff password", { exact: true })
      .fill("Fixture-Password-123!");
    await owner
      .getByLabel("Confirm staff password", { exact: true })
      .fill("Fixture-Password-123!");
    await owner
      .getByRole("button", { name: "Create staff account", exact: true })
      .click();
    await expect(
      owner.getByText("Customer Associate account created", { exact: true }),
    ).toBeVisible();
    async function basics(name, category) {
      await owner.goto(base + "/dashboard/services");
      await owner
        .getByRole("button", { name: "Create a service", exact: true })
        .click();
      await owner.getByLabel("Service name", { exact: true }).fill(name);
      await owner.getByLabel("Category", { exact: true }).fill(category);
      await owner
        .getByLabel("Description", { exact: true })
        .fill(
          "SAMPLE review service with an explicit scope and client-approved package choices.",
        );
      await owner
        .getByLabel("What is included (one item per line)", { exact: true })
        .fill("Exactly the work described in your selected package");
      await owner
        .getByLabel("Not included (one item per line)", { exact: true })
        .fill("Body repairs");
    }
    await basics("SAMPLE Vehicle detailing", "Vehicle care");
    await owner
      .getByLabel("What one base booking covers", { exact: true })
      .fill("One vehicle, according to the selected size and condition");
    await owner.getByLabel("Price (₹)", { exact: true }).fill("500");
    await owner
      .getByRole("checkbox", {
        name: "Require a package before booking",
        exact: true,
      })
      .click();
    await owner
      .getByRole("checkbox", { name: "Publish to customers", exact: true })
      .click();
    await owner
      .getByRole("button", { name: "Save service", exact: true })
      .click();
    await expect(
      owner.getByText(
        "Add at least one package, or allow the standard service.",
        { exact: true },
      ),
    ).toBeVisible();
    await owner
      .getByRole("button", { name: "Add package", exact: true })
      .click();
    await owner
      .getByLabel("Package name", { exact: true })
      .fill("Large vehicle");
    await owner
      .getByLabel("Package description", { exact: true })
      .fill("A seven-seater vehicle with the work listed below.");
    await owner.getByLabel("Package price (₹)", { exact: true }).fill("1500");
    await owner
      .getByLabel("Package duration (30–240 minutes, steps of 30)", {
        exact: true,
      })
      .fill("120");
    await owner
      .getByLabel("Package inclusions (one per line)", { exact: true })
      .fill("One large vehicle\nExterior wash\nInterior vacuum");
    await owner
      .getByLabel("Package exclusions (one per line)", { exact: true })
      .fill("Engine bay detailing");
    await owner.getByRole("button", { name: "Choices", exact: true }).click();
    await owner
      .getByRole("button", { name: "Add choice group", exact: true })
      .click();
    await owner
      .getByLabel("Choice group name", { exact: true })
      .fill("Vehicle condition");
    await owner
      .getByRole("button", { name: "Add choice", exact: true })
      .click();
    await owner
      .getByLabel("Choice name", { exact: true })
      .nth(0)
      .fill("Normal use");
    await owner
      .getByRole("button", { name: "Add choice", exact: true })
      .click();
    await owner
      .getByLabel("Choice name", { exact: true })
      .nth(1)
      .fill("Heavy soil");
    await owner
      .getByLabel("Extra price (₹, zero allowed)", { exact: true })
      .nth(1)
      .fill("300");
    await owner
      .getByLabel("Extra minutes (0–120, steps of 30)", { exact: true })
      .nth(1)
      .fill("30");
    await owner
      .getByRole("button", { name: "Save service", exact: true })
      .click();
    await expect(
      owner.getByText("Service saved", { exact: true }),
    ).toBeVisible();
    let state = await req("/state");
    const service = state.services.find(
      (s) => s.name === "SAMPLE Vehicle detailing",
    );
    if (!service) throw Error("Published service missing");
    await req("/inhouse-workers", {
      name: "SAMPLE vehicle worker",
      skills: [service.id],
      pins: ["509216"],
      schedule: {
        days: [0, 1, 2, 3, 4, 5, 6],
        hours: [9, 12, 15, 18],
        blockedDates: [],
      },
    });
    await req(
      "/settings",
      {
        ...state.settings,
        dispatchMode: "office_first",
        externalPartnersEnabled: false,
        termsUrl: "https://example.test/terms",
        privacyUrl: "https://example.test/privacy",
        supportPhone: "+917989365699",
      },
      "PUT",
    );
    const customer = await login("Enter customer app", 393);
    await customer.goto(base + "/services");
    await customer
      .getByRole("button", { name: "Vehicle care", exact: true })
      .click();
    await customer
      .getByLabel("Search all services", { exact: true })
      .fill("detailing");
    await expect(
      customer.getByText("1 service in Vehicle care", { exact: true }),
    ).toBeVisible();
    await expect(
      customer.getByText("From ₹1,500", { exact: true }),
    ).toBeVisible();
    await expect(customer.getByText("₹500", { exact: true })).toHaveCount(0);
    await customer
      .getByRole("button", {
        name: "View service: SAMPLE Vehicle detailing",
        exact: true,
      })
      .click();
    await customer
      .getByRole("button", { name: "Continue", exact: true })
      .click();
    await expect(
      customer.getByRole("checkbox", { name: /^Standard ·/ }),
    ).toHaveCount(0);
    await customer
      .getByRole("button", { name: "Continue", exact: true })
      .click();
    await expect(
      customer.getByText("Choose a package for this service.", { exact: true }),
    ).toBeVisible();
    await customer
      .getByRole("checkbox", {
        name: "Large vehicle · ₹1,500 · 120 min",
        exact: true,
      })
      .click();
    await customer
      .getByRole("checkbox", {
        name: "Heavy soil · +₹300 · +30 min",
        exact: true,
      })
      .click();
    await expect(
      customer
        .getByText("• Engine bay detailing", { exact: true })
        .filter({ visible: true })
        .first(),
    ).toBeVisible();
    await customer
      .getByRole("button", { name: "Continue", exact: true })
      .click();
    await customer
      .getByLabel("Your address", { exact: true })
      .fill("House 42, private test address");
    await customer.getByLabel("PIN code", { exact: true }).fill("509216");
    await customer
      .getByRole("button", { name: "Continue", exact: true })
      .click();
    await customer
      .getByRole("button", { name: "Continue to payment", exact: true })
      .click();
    await customer.waitForURL("**/booking/**");
    const bookingId = new URL(customer.url()).pathname.split("/").pop();
    const booked = await req("/bookings/" + bookingId);
    expect(booked.total).toBe(1800);
    expect(booked.packageName).toBe("Large vehicle");
    expect(booked.scope).toContain("One large vehicle");
    expect(booked.exclusions).toContain("Engine bay detailing");
    await basics("SAMPLE Site assessment", "Site work");
    await owner
      .getByRole("checkbox", { name: "Request a tailored quote", exact: true })
      .click();
    await owner.getByLabel("Price (₹)", { exact: true }).fill("1");
    await owner
      .getByRole("button", { name: "Customer details", exact: true })
      .click();
    await owner
      .getByRole("button", { name: "Add customer question", exact: true })
      .click();
    await owner
      .getByLabel("Question label", { exact: true })
      .fill("Assessment requirement");
    await owner
      .getByRole("checkbox", {
        name: "Answer required before booking",
        exact: true,
      })
      .click();
    await owner
      .getByRole("checkbox", { name: "Publish to customers", exact: true })
      .click();
    await owner
      .getByRole("button", { name: "Save service", exact: true })
      .click();
    await expect(
      owner.getByText("Service saved", { exact: true }),
    ).toBeVisible();
    await customer.goto(base + "/services");
    await customer
      .getByRole("button", { name: "Site work", exact: true })
      .click();
    await customer
      .getByRole("button", {
        name: "View service: SAMPLE Site assessment",
        exact: true,
      })
      .click();
    await expect(customer.getByText("₹1", { exact: true })).toHaveCount(0);
    await customer
      .getByRole("button", { name: "Request a tailored quote", exact: true })
      .click();
    await customer.waitForURL("**/quotes?serviceId=*");
    await expect(
      customer.getByLabel("Work required", { exact: true }),
    ).toBeVisible();
    await customer
      .getByLabel("Work required", { exact: true })
      .fill(
        "Please assess a commercial workspace before proposing the complete scope.",
      );
    await customer
      .getByLabel("Service address", { exact: true })
      .fill("House 42, private test address");
    await customer.getByLabel("PIN code", { exact: true }).fill("509216");
    await expect(
      customer.getByRole("button", { name: "Send quote request", exact: true }),
    ).toBeDisabled();
    await customer
      .getByLabel("Assessment requirement (required)", { exact: true })
      .fill("Assess two rooms");
    await customer
      .getByRole("button", { name: "Send quote request", exact: true })
      .click();
    await expect(
      customer.getByText("Assessment requirement: Assess two rooms", {
        exact: true,
      }),
    ).toBeVisible();
    await owner.goto(base + "/dashboard/quotes");
    await owner
      .getByLabel("Total price (whole rupees, including taxes)", {
        exact: true,
      })
      .fill("2200");
    await owner
      .getByLabel("Approved scope and exclusions", { exact: true })
      .fill(
        "Assess exactly two rooms, excluding installation and repair materials.",
      );
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
    state = await req("/state");
    const site = state.services.find(
      (s) => s.name === "SAMPLE Site assessment",
    );
    await req("/inhouse-workers", {
      name: "SAMPLE assessment worker",
      skills: [site.id],
      pins: ["509216"],
      schedule: {
        days: [0, 1, 2, 3, 4, 5, 6],
        hours: [9, 12, 15, 18],
        blockedDates: [],
      },
    });
    await customer
      .getByRole("button", {
        name: "Reserve and continue to payment",
        exact: true,
      })
      .click();
    await customer.waitForURL("**/booking/**");
    const quoteBooking = await req(
      "/bookings/" + new URL(customer.url()).pathname.split("/").pop(),
    );
    expect(quoteBooking.total).toBe(2200);
    expect(quoteBooking.details[0].value).toBe("Assess two rooms");
    await customer.screenshot({
      path: "/tmp/anvira-guided-quote.png",
      fullPage: true,
    });
    if (errors.length) throw Error(errors.join("\n"));
    console.log(
      "PASS: guided staff creation; universal required package and priced option editor; mobile category/search, mandatory package, correct ₹1,800 booking and exclusions snapshot; quote-only service hides placeholder and opens quote request.",
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

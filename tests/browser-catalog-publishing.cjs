// Exercise the owner editor against an isolated SQLite API and a freshly exported demo app.
const { spawn } = require("node:child_process");
const { mkdtemp, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { chromium, expect } = require("@playwright/test");

(async () => {
  const dir = await mkdtemp(join(tmpdir(), "anvira-catalog-owner-"));
  const base = "http://127.0.0.1:4393";
  const api = spawn(process.execPath, ["server/index.mjs"], {
    env: {
      ...process.env,
      APP_MODE: "demo",
      PAYMENT_MODE: "demo",
      NODE_ENV: "test",
      PORT: "4393",
      DB_PATH: join(dir, "test.sqlite"),
      WEB_DIST_DIR: process.env.WEB_DIST_DIR || "dist-demo",
      RUN_BACKGROUND_JOBS: "false",
      ALLOWED_ORIGINS: base,
    },
    stdio: ["ignore", "pipe", "inherit"],
  });
  let browser;
  try {
    await new Promise((resolve, reject) => {
      api.stdout.on("data", (d) => {
        if (d.toString().includes("listening")) resolve();
      });
      api.once("exit", (code) => reject(Error("API exit " + code)));
      api.once("error", reject);
    });
    const token = (
      await (
        await fetch(base + "/api/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: "owner" }),
        })
      ).json()
    ).token;
    browser = await chromium.launch({
      executablePath: process.env.CHROMIUM_EXECUTABLE,
    });
    const page = await browser.newPage({
      viewport: { width: 1280, height: 900 },
    });
    await page.addInitScript(
      (token) => sessionStorage.setItem("anvira-demo-session", token),
      token,
    );
    await page.goto(base + "/dashboard/services");
    const button = (name) => page.getByRole("button", { name, exact: true });
    const input = (name) => page.getByLabel(name, { exact: true });
    const choose = (name) =>
      page.getByRole("checkbox", { name, exact: true }).click();
    const publicService = async () =>
      (await (await fetch(base + "/api/catalog")).json()).services.find(
        (s) => s.name === "Test upholstery cleaning",
      );
    await button("Categories").click();
    await input("New category name").fill("Upholstery care");
    await button("Create category").click();
    await expect(
      page.getByText("Library saved.", { exact: true }),
    ).toBeVisible();
    await button("Add-on library").click();
    await button("Create add-on template").click();
    await input("Template name").fill("Extra cushion");
    await input("Template price (₹)").fill("75");
    await input("Extra minutes (0–120, steps of 30)").fill("30");
    await button("Save template").click();
    await expect(button("Edit Extra cushion")).toBeVisible();
    await button("Services").last().click();
    await button("Create a service").click();
    await input("Service name").fill("Test upholstery cleaning");
    await button("Upholstery care").click();
    await input("Subcategory (optional)").fill("Sofas");
    await input("Description").fill(
      "Clean the selected sofa and agreed cushions.",
    );
    await input("What is included (one item per line)").fill(
      "Fabric vacuuming",
    );
    await button("Preview & publish").click();
    await button("Save service").click();
    await expect(
      page.getByText("Service saved", { exact: true }),
    ).toBeVisible();
    expect(await publicService()).toBeUndefined();
    await input("Find a service to manage").fill("Test upholstery cleaning");
    await button("Edit service details").click();
    await button("Packages & scope").click();
    await choose("Require a package before booking");
    await button("Add package").click();
    await input("Package name").fill("Two-seater");
    await input("Package price (₹)").fill("900");
    await input("Package inclusions (one per line)").fill("Two fabric seats");
    await button("Add-ons").click();
    await button("Extra cushion").click();
    await choose("Available with every package");
    await button("Preview & publish").click();
    await choose("Publish to customers");
    await button("Save service").click();
    await expect
      .poll(publicService)
      .toMatchObject({
        status: "active",
        price: 0,
        category: "Upholstery care",
        addons: [{ name: "Extra cushion", price: 75, duration: 30 }],
      });
    const service = await publicService();
    expect(service.addons[0].packageIds).toEqual([service.packages[0].id]);
    await button("Preview service").click();
    await choose("Pause new bookings");
    await button("Save service").click();
    await expect.poll(publicService).toBeUndefined();
    console.log(
      "PASS: owner creates category and add-on template, saves draft, assigns a package-specific extra, previews, publishes and pauses. Public catalogue reflects each transition.",
    );
  } finally {
    await browser?.close();
    api.kill("SIGTERM");
    if (api.exitCode === null && api.signalCode === null)
      await new Promise((resolve) => api.once("exit", resolve));
    await rm(dir, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

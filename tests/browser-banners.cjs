const { spawn } = require("node:child_process");
const { mkdtemp, rm } = require("node:fs/promises");
const { join } = require("node:path");
const { tmpdir } = require("node:os");
const { chromium, expect } = require("@playwright/test");

(async () => {
  const dir = await mkdtemp(join(tmpdir(), "anvira-banners-"));
  const base = "http://127.0.0.1:4471";
  const api = spawn(process.execPath, ["server/index.mjs"], {
    env: {
      ...process.env,
      APP_MODE: "demo",
      PAYMENT_MODE: "demo",
      NODE_ENV: "test",
      PORT: "4471",
      DB_PATH: join(dir, "test.sqlite"),
      ALLOWED_ORIGINS: base,
      WEB_DIST_DIR: process.env.WEB_DIST_DIR || "dist-demo",
      RUN_BACKGROUND_JOBS: "false",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let browser;
  try {
    await new Promise((ok, fail) => {
      api.stdout.on("data", (d) => {
        if (d.toString().includes("listening")) ok();
      });
      api.once("error", fail);
      api.once("exit", (code) => fail(Error("API exit " + code)));
    });
    browser = await chromium.launch({
      headless: true,
      executablePath: process.env.CHROMIUM_EXECUTABLE,
    });
    const owner = await browser.newPage({
      viewport: { width: 1300, height: 960 },
    });
    const guest = await browser.newPage({
      viewport: { width: 375, height: 812 },
      reducedMotion: "reduce",
    });
    const errors = [];
    for (const p of [owner, guest])
      p.on("pageerror", (e) => errors.push(e.message));
    await owner.goto(base + "/staff?sample=owner");
    await owner.waitForURL("**/dashboard/home");
    await owner.goto(base + "/dashboard/banners");
    await owner
      .getByRole("button", { name: "Create banner", exact: true })
      .click();
    await owner
      .getByLabel("Banner title", { exact: true })
      .fill("Bathroom care this week");
    await owner
      .getByRole("button", { name: "Home cleaning", exact: true })
      .click();
    const choosing = owner.waitForEvent("filechooser");
    await owner.getByRole("button", { name: "Upload banner photo" }).click();
    await (await choosing).setFiles("assets/services/bathroom.jpg");
    await owner
      .getByRole("button", { name: "Inactive · Tap to activate" })
      .click();
    await owner.getByRole("button", { name: "Save banner" }).click();
    await expect(
      owner.getByText("Banner saved.", { exact: true }),
    ).toBeVisible();
    await owner
      .getByRole("button", { name: "Create banner", exact: true })
      .click();
    await owner
      .getByLabel("Banner title", { exact: true })
      .fill("AC service options");
    await owner
      .getByRole("button", { name: "AC service & repair", exact: true })
      .click();
    await owner
      .getByRole("button", { name: "Inactive · Tap to activate" })
      .click();
    await owner.getByRole("button", { name: "Save banner" }).click();
    await expect(
      owner.getByText("Banner saved.", { exact: true }),
    ).toBeVisible();
    await guest.goto(base + "/welcome");
    const card = guest.getByRole("button", {
      name: "Bathroom care this week. View Home cleaning",
    });
    await expect(card).toBeVisible();
    await expect
      .poll(async () =>
        (await guest.request.get(base + "/api/catalog"))
          .json()
          .then((x) => x.banners[0]?.hasPhoto),
      )
      .toBe(true);
    const other = guest.getByRole("button", {
      name: "Show AC service options",
    });
    await other.click();
    await expect(other).toHaveAttribute("aria-pressed", "true");
    await expect(
      guest.getByRole("button", { name: "Play slideshow" }),
    ).toHaveCount(0);
    await guest
      .getByRole("button", { name: "Show Bathroom care this week" })
      .click();
    await card.click();
    await expect(guest.locator(".mp:visible .mp-service")).toHaveCount(1);
    await owner
      .getByRole("button", { name: "Edit Bathroom care this week" })
      .click();
    await owner
      .getByLabel("End date (optional)", { exact: true })
      .fill("2001-01-01");
    await owner.getByRole("button", { name: "Save banner" }).click();
    await expect(
      owner.getByText("Banner saved.", { exact: true }),
    ).toBeVisible();
    await guest.goto(base + "/welcome");
    await expect(
      guest.locator(".mp:visible .mp-service").first(),
    ).toBeVisible();
    await expect(card).toHaveCount(0);
    expect(errors).toEqual([]);
    console.log(
      "Passed: owner uploads and publishes a photo, guest switches slides and follows a destination, and expiration removes the banner.",
    );
  } finally {
    await browser?.close();
    api.kill();
    await rm(dir, { recursive: true, force: true });
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

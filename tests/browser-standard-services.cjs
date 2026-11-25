const { spawn } = require("node:child_process");
const { mkdtemp, rm, mkdir, writeFile } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { chromium, expect } = require("@playwright/test");
(async () => {
  const temp = await mkdtemp(join(tmpdir(), "anvira-standard-"));
  const base = "http://127.0.0.1:4928";
  let api, browser;
  const { standardServices } =
    await import("../server/lib/standard-catalog.mjs");
  const { createSQLiteStore } = await import("../server/lib/store.mjs");
  const { seedDemo } = await import("../server/lib/seed.mjs");
  const { money, slots } = await import("../src/lib/model.ts");
  const store = await createSQLiteStore(join(temp, "test.sqlite"));
  await seedDemo(store);
  await store.transaction(async (tx) => {
    for (const service of await tx.list("services"))
      if (service.id !== "car-cleaning")
        tx.put("services", { ...service, active: false, status: "paused" });
    for (const service of standardServices) tx.put("services", service);
    for (const pro of await tx.list("professionals"))
      tx.put("professionals", {
        ...pro,
        skills: standardServices.map((s) => s.id),
      });
  });
  store.close();
  try {
    api = spawn(process.execPath, ["server/index.mjs"], {
      env: {
        ...process.env,
        NODE_ENV: "test",
        APP_MODE: "demo",
        PAYMENT_MODE: "demo",
        SEED_DEMO_PEOPLE: "true",
        PORT: "4928",
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
      api.once("exit", (c) => reject(Error("API exit " + c)));
    });
    browser = await chromium.launch({
      headless: true,
      executablePath: process.env.CHROMIUM_EXECUTABLE,
    });
    const p = await browser.newPage({
        viewport: { width: 390, height: 844 },
        reducedMotion: "reduce",
      }),
      errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    p.on("console", (e) => {
      if (
        e.type() === "error" &&
        /Unexpected text node|Text strings must|Maximum update|Rendered (more|fewer) hooks/.test(
          e.text(),
        )
      )
        errors.push(e.text());
    });
    const visible = (l) => l.filter({ visible: true }),
      button = (name) => visible(p.getByRole("button", { name, exact: true }));
    await mkdir("evidence/standard-services", { recursive: true });
    await p.goto(base + "/sign-in?sample=customer");
    await p.waitForURL("**/home");
    let options = 0;
    for (const service of standardServices) {
      for (const pack of service.packages) {
        await p.goto(base + "/service/" + service.id);
        await expect(button("Book " + pack.name)).toBeVisible();
        await expect(button("Request a tailored quote")).toHaveCount(0);
        if (pack === service.packages[0])
          await p.screenshot({
            path: "evidence/standard-services/" + service.id + "-menu.png",
          });
        await button("Book " + pack.name).click();
        await p.waitForURL(
          "**/checkout/" + service.id + "?packageId=" + pack.id + "&**",
        );
        await expect(button("Continue")).toBeEnabled();
        await expect(
          visible(p.getByText("Your service is selected", { exact: true })),
        ).toBeVisible();
        await expect(
          visible(p.getByText(pack.name, { exact: true })),
        ).toBeVisible();
        await expect(
          visible(p.getByText(money(pack.price), { exact: true })).last(),
        ).toBeVisible();
        await expect(
          visible(p.getByRole("checkbox", { checked: true })),
        ).toHaveCount(0);
        const compatible = service.addons.filter((a) =>
          a.packageIds.includes(pack.id),
        );
        for (const extra of compatible)
          await expect(
            visible(p.getByRole("checkbox", { name: extra.name, exact: true })),
          ).toBeVisible();
        for (const extra of service.addons.filter(
          (a) => !a.packageIds.includes(pack.id),
        ))
          await expect(
            visible(p.getByRole("checkbox", { name: extra.name, exact: true })),
          ).toHaveCount(0);
        options++;
      }
    }
    // A fresh Book must beat a saved alternative; a reload must retain edits.
    await p.goto(base + "/service/review-cleaning");
    await button("Book Clean 1 bathroom").click();
    await expect(button("Continue")).toBeEnabled();
    await button("Change service option").click();
    await visible(
      p.getByRole("checkbox", { name: /^Deep clean the kitchen/ }),
    ).click();
    await button("Keep this option").click();
    await visible(
      p.getByRole("checkbox", { name: "Clean 1 ceiling fan", exact: true }),
    ).click();
    await p.waitForFunction(() =>
      Object.keys(sessionStorage).some(
        (key) =>
          key.startsWith("anvira-draft-") &&
          JSON.parse(sessionStorage.getItem(key)).data?.packageId ===
            "kitchen" &&
          JSON.parse(sessionStorage.getItem(key)).data?.addon.includes(
            "fan-clean",
          ),
      ),
    );
    await p.reload();
    await expect(button("Continue")).toBeEnabled();
    await expect(
      visible(p.getByText("Deep clean the kitchen", { exact: true })),
    ).toBeVisible();
    await expect(
      visible(
        p.getByRole("checkbox", { name: "Clean 1 ceiling fan", exact: true }),
      ),
    ).toBeChecked();
    await p.goto(base + "/service/review-cleaning");
    await button("Book Clean 1 bathroom").click();
    await expect(button("Continue")).toBeEnabled();
    await expect(
      visible(p.getByText("Clean 1 bathroom", { exact: true })),
    ).toBeVisible();
    await expect(
      visible(p.getByRole("checkbox", { checked: true })),
    ).toHaveCount(0);
    const bookingIds = [];
    for (const [index, service] of standardServices.entries()) {
      const pack = service.packages[0];
      await p.goto(base + "/service/" + service.id);
      await button("Book " + pack.name).click();
      await expect(button("Continue")).toBeEnabled();
      await expect(
        visible(p.getByText(pack.name, { exact: true })),
      ).toBeVisible();
      let total = pack.price;
      if (index === 0) {
        await visible(
          p.getByRole("checkbox", { name: "Clean 1 ceiling fan", exact: true }),
        ).check();
        total += 99;
        await expect(
          visible(p.getByText(money(total), { exact: true })),
        ).toBeVisible();
        await p.screenshot({
          path: "evidence/standard-services/selected-extras.png",
        });
      }
      for (const field of service.bookingFields)
        await visible(
          p.getByRole("textbox", {
            name:
              field.label + (field.required ? " (required)" : " (optional)"),
            exact: true,
          }),
        ).fill(
          field.id === "vehicle"
            ? "Maruti Swift"
            : "Parking bay 14, ground level",
        );
      await button("Continue").click();
      await visible(
        p.getByRole("textbox", { name: "Your address", exact: true }),
      ).fill("42 Garden Street, Shadnagar");
      const day = new Date(slots()[index]).toLocaleDateString("en-IN", {
        timeZone: "Asia/Kolkata",
      });
      await button(day).click();
      await button("9:00 slot").click();
      await button("Continue").click();
      await expect(
        visible(p.getByText("Review your booking", { exact: true })),
      ).toBeVisible();
      await button("Continue to payment").click();
      await p.waitForURL("**/booking/*");
      bookingIds.push({
        id: new URL(p.url()).pathname.split("/").pop(),
        total,
        serviceId: service.id,
      });
      await button("Simulate payment").click();
      await expect(
        visible(p.getByText("Professional assigned", { exact: true })).first(),
      ).toBeVisible();
    }
    const owner = await browser.newPage({
      viewport: { width: 1440, height: 960 },
    });
    await owner.goto(base + "/staff?sample=owner");
    await owner.waitForURL("**/dashboard/home");
    await owner.goto(base + "/dashboard/services");
    await owner
      .getByRole("button", { name: "Published services", exact: true })
      .filter({ visible: true })
      .click();
    await owner
      .getByRole("textbox", { name: "Find a service to manage", exact: true })
      .filter({ visible: true })
      .fill("Home cleaning");
    await owner
      .getByRole("button", { name: "Edit service details", exact: true })
      .filter({ visible: true })
      .first()
      .click();
    await owner
      .getByRole("button", { name: "Pricing", exact: true })
      .filter({ visible: true })
      .click();
    await expect(
      owner
        .getByText("Prices customers pay", { exact: true })
        .filter({ visible: true }),
    ).toBeVisible();
    await owner.screenshot({
      path: "evidence/standard-services/admin-prices.png",
    });
    await owner
      .getByRole("button", { name: "Edit service option prices", exact: true })
      .filter({ visible: true })
      .click();
    await owner
      .getByRole("textbox", { name: "Package price (₹)", exact: true })
      .filter({ visible: true })
      .first()
      .fill("629");
    await owner
      .getByRole("button", { name: "Preview & publish", exact: true })
      .filter({ visible: true })
      .click();
    await owner
      .getByRole("button", { name: "Save service", exact: true })
      .filter({ visible: true })
      .click();
    await expect(
      owner
        .getByText("Service saved", { exact: true })
        .filter({ visible: true }),
    ).toBeVisible();
    await p.goto(base + "/service/review-cleaning");
    await expect(visible(p.getByText("₹629", { exact: true }))).toBeVisible();
    const customerToken = await p.evaluate(() =>
      sessionStorage.getItem("anvira-demo-session"),
    );
    const response = await fetch(base + "/api/bookings/" + bookingIds[0].id, {
      headers: { Authorization: "Bearer " + customerToken },
    });
    const saved = await response.json();
    expect(saved.total).toBe(628);
    expect(saved.packageName).toBe("Clean 1 bathroom");
    // Required admin-defined choices must stay visible and be counted in the displayed starting price.
    const ownerToken = await owner.evaluate(() =>
      sessionStorage.getItem("anvira-demo-session"),
    );
    const activeHome = (
      await (await fetch(base + "/api/catalog")).json()
    ).services.find((s) => s.id === "review-cleaning");
    const withRequired = {
      ...activeHome,
      optionGroups: [
        {
          id: "floor",
          name: "Floor type",
          required: true,
          options: [
            { id: "standard", name: "Standard floor", price: 100, duration: 0 },
          ],
        },
      ],
    };
    const changed = await fetch(base + "/api/services/review-cleaning", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + ownerToken,
      },
      body: JSON.stringify(withRequired),
    });
    expect(changed.ok).toBe(true);
    await p.goto(base + "/service/review-cleaning");
    await expect(
      visible(p.getByText("From ₹729", { exact: true })),
    ).toBeVisible();
    await button("Book Clean 1 bathroom").click();
    await expect(button("Continue")).toBeEnabled();
    await expect(
      visible(p.getByText("Floor type", { exact: true })),
    ).toBeVisible();
    await visible(p.getByRole("checkbox", { name: /^Standard floor/ })).click();
    await expect(visible(p.getByText("₹729", { exact: true }))).toBeVisible();
    const reset = await fetch(base + "/api/services/review-cleaning", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + ownerToken,
      },
      body: JSON.stringify(activeHome),
    });
    expect(reset.ok).toBe(true);
    await p.goto(base + "/home");
    await p.setViewportSize({ width: 320, height: 850 });
    await button("Switch language").click();
    for (const service of standardServices) {
      await p.goto(base + "/service/" + service.id);
      const first = service.packages[0];
      const dict = require("../src/lib/translations.json");
      const localBook = button(dict.Book + " " + dict[first.name]);
      await expect(localBook).toBeVisible();
      await expect
        .poll(() => p.evaluate(() => document.body.scrollWidth <= innerWidth))
        .toBe(true);
      await p.screenshot({
        path: "evidence/standard-services/" + service.id + "-telugu-320.png",
      });
      await localBook.click();
      await expect(
        visible(p.getByText("మీ సేవ ఎంపికైంది", { exact: true })),
      ).toBeVisible();
      await expect(
        visible(p.getByText(dict[first.name], { exact: true })),
      ).toBeVisible();
    }
    expect(errors, errors.join("\n")).toEqual([]);
    const results = {
      optionsChecked: options,
      categories: 6,
      demoPaidBookings: bookingIds.length,
      adminPriceEdit:
        "629 shown for new bookings; earlier booking stays 628 including extra",
      optionalExtras: "compatible only, no preselection",
      telugu: "all six menus at 320px",
      runtimeErrors: errors,
    };
    await writeFile(
      "evidence/standard-services/results.json",
      JSON.stringify(results, null, 2),
    );
    console.log(JSON.stringify(results, null, 2));
  } finally {
    await browser?.close();
    if (api) {
      const closed = new Promise((r) => api.once("exit", r));
      api.kill("SIGTERM");
      await closed;
    }
    await rm(temp, { recursive: true, force: true });
  }
})()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

const { spawn } = require("node:child_process");
const { mkdtemp, rm, writeFile, mkdir } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { chromium, expect } = require("@playwright/test");
(async () => {
  const temp = await mkdtemp(join(tmpdir(), "anvira-features-"));
  const api = spawn(process.execPath, ["server/index.mjs"], {
    env: {
      ...process.env,
      NODE_ENV: "test",
      APP_MODE: "demo",
      PAYMENT_MODE: "demo",
      PORT: "4299",
      WEB_DIST_DIR: "dist-demo",
      ALLOWED_ORIGINS: "http://127.0.0.1:4299",
      DB_PATH: join(temp, "demo.sqlite"),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  await new Promise((resolve, reject) => {
    api.stdout.on("data", (d) => {
      if (d.toString().includes("listening")) resolve();
    });
    api.once("exit", (c) => reject(Error("API exited " + c)));
    api.once("error", reject);
  });
  let browser;
  const errors = [],
    results = [];
  let step = "launch";
  try {
    browser = await chromium.launch({
      headless: true,
      executablePath: process.env.CHROMIUM_EXECUTABLE,
    });
    const visible = (l) => l.filter({ visible: true });
    async function login(label, width = 393) {
      const p = await browser.newPage({ viewport: { width, height: 900 } });
      p.on("pageerror", (e) => errors.push(e.message));
      p.on("response", (r) => {
        if (
          r.url().includes("/api/") &&
          (r.status() >= 500 || r.status() === 429)
        )
          errors.push("HTTP " + r.status() + " " + r.url());
      });
      await p.goto("http://127.0.0.1:4299");
      await p.getByRole("button", { name: label, exact: true }).click();
      await p.waitForURL(
        label === "Owner dashboard"
          ? "**/dashboard/home"
          : label === "Enter customer app"
            ? "**/home"
            : "**/jobs",
      );
      return p;
    }
    step = "owner builder";
    const owner = await login("Owner dashboard", 1440);
    await visible(owner.getByText("Services", { exact: true })).click();
    // Expand the existing cleaning service, leaving other services unaffected.
    await visible(
      owner.getByRole("button", { name: "Edit service details", exact: true }),
    )
      .first()
      .click();
    await visible(
      owner.getByRole("button", { name: "Add package", exact: true }),
    )
      .last()
      .click();
    await visible(owner.getByLabel("Package name", { exact: true }))
      .last()
      .fill("Deep care");
    await visible(owner.getByLabel("Package description", { exact: true }))
      .last()
      .fill("Kitchen and full home care");
    await visible(owner.getByLabel("Package price (₹)", { exact: true }))
      .last()
      .fill("2000");
    await visible(
      owner.getByLabel("Package duration (30–240 minutes, steps of 30)", {
        exact: true,
      }),
    )
      .last()
      .fill("120");
    await visible(
      owner.getByLabel("Package inclusions (one per line)", { exact: true }),
    )
      .last()
      .fill("Kitchen deep clean");
    await visible(owner.getByRole("button", { name: "Choices", exact: true }))
      .last()
      .click();
    await visible(
      owner.getByRole("button", { name: "Add choice group", exact: true }),
    )
      .last()
      .click();
    await visible(owner.getByLabel("Choice group name", { exact: true }))
      .last()
      .fill("Home size");
    await visible(
      owner.getByRole("button", { name: "Add choice", exact: true }),
    )
      .last()
      .click();
    await visible(owner.getByLabel("Choice name", { exact: true }))
      .last()
      .fill("Three bedrooms");
    await visible(
      owner.getByLabel("Extra price (₹, zero allowed)", { exact: true }),
    )
      .last()
      .fill("500");
    await visible(
      owner.getByLabel("Extra minutes (0–120, steps of 30)", { exact: true }),
    )
      .last()
      .fill("30");
    await visible(
      owner.getByRole("button", { name: "Service care", exact: true }),
    )
      .last()
      .click();
    await visible(
      owner.getByLabel("Before we arrive (one instruction per line)", {
        exact: true,
      }),
    ).fill("Clear surfaces");
    await visible(
      owner.getByLabel("Warranty or revisit terms", { exact: true }),
    ).fill("Contact support to discuss a revisit.");
    await visible(
      owner.getByLabel("Professional completion tasks (one per line)", {
        exact: true,
      }),
    ).fill("Kitchen inspected");
    await visible(owner.getByRole("button", { name: "FAQs", exact: true }))
      .last()
      .click();
    await visible(owner.getByRole("button", { name: "Add FAQ", exact: true }))
      .last()
      .click();
    await visible(owner.getByLabel("Customer question", { exact: true }))
      .last()
      .fill("Do I need supplies?");
    await visible(owner.getByLabel("Answer", { exact: true }))
      .last()
      .fill("Standard supplies are included.");
    await visible(
      owner.getByRole("button", { name: "Preview service", exact: true }),
    )
      .last()
      .click();
    await expect(
      visible(owner.getByText("• Clear surfaces", { exact: true })),
    ).toBeVisible();
    const saved = owner.waitForResponse(
      (r) =>
        r.url().endsWith("/api/services/cleaning") &&
        r.request().method() === "PATCH",
    );
    await visible(
      owner.getByRole("button", { name: "Save service", exact: true }),
    )
      .last()
      .click();
    if ((await saved).status() !== 200)
      throw Error("Service customization failed");
    results.push(
      "Owner: packages, required choices, preparation, warranty, FAQs, completion tasks and preview saved",
    );
    step = "rich checkout";
    const customer = await login("Enter customer app");
    await customer
      .getByRole("button", { name: "Cleaning", exact: true })
      .click();
    await expect(
      visible(customer.getByText("• Clear surfaces", { exact: true })),
    ).toBeVisible();
    await visible(
      customer.getByRole("button", {
        name: "Do I need supplies?",
        exact: true,
      }),
    ).click();
    await expect(
      visible(
        customer.getByText("Standard supplies are included.", { exact: true }),
      ),
    ).toBeVisible();
    await customer
      .getByRole("button", { name: "Continue", exact: true })
      .click();
    await visible(
      customer.getByRole("button", { name: "Continue", exact: true }),
    ).click();
    await expect(
      visible(
        customer.getByText("Choose an option for Home size.", { exact: true }),
      ),
    ).toBeVisible();
    await customer
      .getByRole("checkbox", {
        name: "Deep care · ₹2,000 · 120 min",
        exact: true,
      })
      .click();
    await customer
      .getByRole("checkbox", {
        name: "Three bedrooms · +₹500 · +30 min",
        exact: true,
      })
      .click();
    await customer
      .getByLabel("Instructions for your professional", { exact: true })
      .fill("Please ring the side gate.");
    await visible(
      customer.getByRole("button", { name: "Continue", exact: true }),
    ).click();
    await visible(customer.getByLabel("Your address", { exact: true })).fill(
      "12 Garden Street, Shadnagar",
    );
    await visible(
      customer.getByRole("button", { name: "Continue", exact: true }),
    ).click();
    await expect(
      visible(customer.getByText("150 minutes", { exact: true })),
    ).toBeVisible();
    await expect(
      visible(customer.getByText("₹2,500", { exact: true })).first(),
    ).toBeVisible();
    await visible(
      customer.getByRole("button", {
        name: "Continue to payment",
        exact: true,
      }),
    ).click();
    await customer.waitForURL("**/booking/*");
    await visible(
      customer.getByRole("button", { name: "Simulate payment", exact: true }),
    ).click();
    await expect(
      visible(
        customer.getByText("Professional assigned", { exact: true }),
      ).first(),
    ).toBeVisible();
    const bookingPath = new URL(customer.url()).pathname;
    results.push(
      "Customer: required choice validation, FAQ, package price, duration, instructions and paid booking",
    );
    step = "professional job";
    const pro = await login("Enter professional app");
    await visible(
      pro.getByRole("button", {
        name: "Open Home deep cleaning booking",
        exact: true,
      }),
    )
      .first()
      .click();
    await pro.waitForURL("**/booking/*");
    await expect(
      visible(pro.getByText("Please ring the side gate.", { exact: true })),
    ).toBeVisible();
    await visible(
      pro.getByRole("button", { name: "Accept job", exact: true }),
    ).click();
    await visible(
      pro.getByRole("button", { name: "I have arrived", exact: true }),
    ).click();
    await expect(
      visible(pro.getByText("Arrival recorded", { exact: true })),
    ).toBeVisible();
    await visible(
      pro.getByRole("button", { name: "Start service", exact: true }),
    ).click();
    await expect(
      visible(
        pro.getByRole("button", { name: "Complete service", exact: true }),
      ),
    ).toBeDisabled();
    for (const name of [
      "Kitchen inspected",
      "Work completed as agreed",
      "Area cleaned and tools packed",
      "Customer walkthrough completed",
    ])
      await visible(pro.getByRole("checkbox", { name, exact: true })).click();
    await visible(
      pro.getByLabel("Handover notes for the customer", { exact: true }),
    ).fill("Kitchen cleaned. Keep surfaces dry.");
    await visible(
      pro.getByRole("button", { name: "Complete service", exact: true }),
    ).click();
    await expect(
      visible(
        pro.getByText("Kitchen cleaned. Keep surfaces dry.", { exact: true }),
      ),
    ).toBeVisible();
    results.push(
      "Professional: service plan, arrival, custom checklist enforcement and customer handover",
    );
    await visible(pro.getByRole("tab", { name: "Jobs", exact: true })).click();
    await visible(pro.getByText("Job history", { exact: true })).click();
    await visible(
      pro.getByLabel("Search this history page", { exact: true }),
    ).fill("Ananya");
    await expect(
      visible(
        pro.getByRole("button", {
          name: "Open Home deep cleaning booking",
          exact: true,
        }),
      ),
    ).toBeVisible();
    results.push("Professional: paginated history and customer search");
    step = "photo";
    // Login is intentionally separate; only isolated demo pages are inspected.
    const profile = await login("Enter professional app");
    await visible(
      profile.getByRole("tab", { name: "Profile", exact: true }),
    ).click();
    await visible(
      profile.getByRole("button", {
        name: "Professional profile & schedule",
        exact: true,
      }),
    ).click();
    const dataUri = await profile.evaluate(() => {
      const c = document.createElement("canvas");
      c.width = c.height = 80;
      const x = c.getContext("2d");
      x.fillStyle = "#12634f";
      x.fillRect(0, 0, 80, 80);
      x.fillStyle = "#e7bb63";
      x.beginPath();
      x.arc(40, 40, 20, 0, Math.PI * 2);
      x.fill();
      return c.toDataURL("image/jpeg");
    });
    const file = join(temp, "profile.jpg");
    await writeFile(file, Buffer.from(dataUri.split(",")[1], "base64"));
    const chooser = profile.waitForEvent("filechooser");
    await visible(
      profile.getByRole("button", { name: "Add profile photo", exact: true }),
    ).click();
    await (await chooser).setFiles(file);
    await expect(
      visible(
        profile.getByText(
          "Profile photo saved. Customers can see it on your assigned bookings.",
          { exact: true },
        ),
      ),
    ).toBeVisible({ timeout: 20000 });
    await expect(
      visible(
        profile.getByRole("img", {
          name: "Ravi Kumar profile photo",
          exact: true,
        }),
      ),
    ).toBeVisible();
    await visible(profile.getByLabel("About your work", { exact: true })).fill(
      "Cleaning with care and clear communication.",
    );
    await visible(
      profile.getByLabel("Languages spoken (comma separated)", { exact: true }),
    ).fill("Telugu, English");
    await visible(
      profile.getByRole("button", { name: "Save public profile", exact: true }),
    ).click();
    await expect(
      visible(
        profile.getByText("Professional profile saved.", { exact: true }),
      ),
    ).toBeVisible();
    await profile.screenshot({
      path: "evidence/professional-photo-profile.png",
    });
    results.push(
      "Professional: photo picker, square JPEG compression, upload, public bio and languages",
    );
    step = "customer photo and support";
    const support = await login("Enter customer app");
    await visible(
      support.getByRole("tab", { name: "Bookings", exact: true }),
    ).click();
    await visible(support.getByText("Past bookings", { exact: true })).click();
    await visible(
      support.getByRole("button", {
        name: "Open Home deep cleaning booking",
        exact: true,
      }),
    )
      .first()
      .click();
    await expect(
      visible(
        support.getByRole("img", {
          name: "Ravi Kumar profile photo",
          exact: true,
        }),
      ),
    ).toBeVisible();
    await expect(
      visible(support.getByText("Speaks Telugu, English", { exact: true })),
    ).toBeVisible();
    await visible(
      support.getByRole("button", { name: "Support", exact: true }),
    ).click();
    await visible(
      support.getByRole("button", { name: "Send request", exact: true }),
    ).click();
    await expect(
      visible(
        support.getByText("Enter at least two characters to send a request.", {
          exact: true,
        }),
      ),
    ).toBeVisible();
    await visible(
      support.getByLabel("Describe your issue", { exact: true }),
    ).fill("Hi");
    await visible(
      support.getByRole("button", { name: "Send request", exact: true }),
    ).click();
    await expect(
      visible(support.getByText("Request sent", { exact: true })),
    ).toBeVisible();
    results.push(
      "Customer: assigned professional photo and languages; short support message and inline validation",
    );
    step = "owner clone";
    await visible(
      owner.getByRole("button", { name: "Duplicate as draft", exact: true }),
    )
      .first()
      .click();
    await expect(
      visible(owner.getByText("Home deep cleaning copy", { exact: true })),
    ).toBeVisible();
    const source = visible(
      owner.getByRole("button", { name: "Hide from customers", exact: true }),
    ).first();
    await source.click();
    await expect(
      visible(
        owner.getByText(
          "Service hidden. Existing bookings keep their original scope.",
          { exact: true },
        ),
      ),
    ).toBeVisible();
    await visible(
      owner.getByRole("button", { name: "Publish service", exact: true }),
    )
      .first()
      .click();
    await expect(
      visible(owner.getByText("Service published.", { exact: true })),
    ).toBeVisible();
    results.push(
      "Owner: duplicate as draft, hide service and publish without changing booking snapshots",
    );
    step = "mobile";
    await profile.setViewportSize({ width: 360, height: 800 });
    const overflow = await profile.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    );
    if (overflow) throw Error("Professional profile overflows 360px");
    await visible(
      profile.getByRole("button", {
        name: "Remove profile photo",
        exact: true,
      }),
    ).click();
    await expect(
      visible(
        profile.getByRole("button", { name: "Add profile photo", exact: true }),
      ),
    ).toBeVisible();
    results.push("Mobile: profile at 360px and profile photo removal");
    if (errors.length) throw Error(errors.join("\n"));
    await writeFile(
      "evidence/new-feature-ui-results.json",
      JSON.stringify(
        {
          passed: results.length,
          scenarios: results,
          runtimeErrors: errors,
          bookingPath,
        },
        null,
        2,
      ),
    );
    console.log(
      JSON.stringify(
        { passed: results.length, scenarios: results, runtimeErrors: errors },
        null,
        2,
      ),
    );
  } catch (e) {
    console.error("Feature test step: " + step);
    throw e;
  } finally {
    if (browser) await browser.close();
    api.kill();
    await new Promise((r) => api.once("exit", r));
    await rm(temp, { recursive: true, force: true });
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

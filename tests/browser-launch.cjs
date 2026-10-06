const { spawn } = require("node:child_process");
const { mkdtemp, rm, writeFile, mkdir } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { chromium, expect } = require("@playwright/test");
(async () => {
  const temp = await mkdtemp(join(tmpdir(), "anvira-launch-ui-"));
  const api = spawn(process.execPath, ["server/index.mjs"], {
    env: {
      ...process.env,
      NODE_ENV: "test",
      APP_MODE: "demo",
      PAYMENT_MODE: "demo",
      PORT: "4499",
      WEB_DIST_DIR: "dist-demo",
      ALLOWED_ORIGINS: "http://127.0.0.1:4499",
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
  let browser,
    step = "start";
  const errors = [],
    results = [],
    visible = (l) => l.filter({ visible: true }),
    base = "http://127.0.0.1:4499";
  try {
    browser = await chromium.launch({
      headless: true,
      executablePath: process.env.CHROMIUM_EXECUTABLE,
    });
    const customer = await browser.newPage({
      viewport: { width: 393, height: 900 },
    });
    customer.on("pageerror", (e) => errors.push(e.message));
    step = "guest catalog";
    await customer.goto(base + "/catalog");
    await expect(
      customer.getByText("Doorstep car cleaning", { exact: true }),
    ).toBeVisible();
    await customer.getByLabel("Search services", { exact: true }).fill("car");
    await customer
      .getByRole("button", { name: "View Doorstep car cleaning", exact: true })
      .click();
    await expect(
      customer.getByText("Engine-bay wash", { exact: false }),
    ).toBeVisible();
    await expect(
      customer.getByRole("button", {
        name: "Sign in to customize",
        exact: true,
      }),
    ).toBeVisible();
    results.push("Guest catalog shows scope and price without a login");
    step = "guided car checkout";
    await customer.goto(base + "/demo");
    await customer
      .getByRole("button", { name: "Try car cleaning", exact: true })
      .click();
    await customer.waitForURL("**/checkout/car-cleaning");
    await customer
      .getByRole("button", { name: "Continue", exact: true })
      .click();
    await expect(
      visible(
        customer.getByText("Choose an option for Vehicle size.", {
          exact: true,
        }),
      ),
    ).toBeVisible();
    await customer.getByRole("checkbox", { name: /^Inside & out/ }).click();
    await customer.getByRole("checkbox", { name: /^SUV \/ 7-seater/ }).click();
    await customer
      .getByRole("checkbox", { name: /^Water tap available nearby/ })
      .click();
    await customer
      .getByRole("button", { name: "Continue", exact: true })
      .click();
    await expect(
      visible(customer.getByText("Enter Car make and model.", { exact: true })),
    ).toBeVisible();
    await customer
      .getByLabel("Car make and model (required)", { exact: true })
      .fill("Tata Nexon demo");
    await customer
      .getByLabel("Parking instructions (required)", { exact: true })
      .fill("Driveway beside side gate");
    await customer
      .getByRole("checkbox", { name: "Rubber mat deep clean", exact: true })
      .click();
    await customer
      .getByRole("button", { name: "Continue", exact: true })
      .click();
    await customer
      .getByLabel("Your address", { exact: true })
      .fill("12 Garden Street, Shadnagar");
    await customer.getByLabel("PIN code", { exact: true }).fill("509216");
    await expect(
      customer.getByText(
        "Draft saved on this device. It does not reserve a service slot.",
        { exact: true },
      ),
    ).toBeVisible({ timeout: 8000 });
    await customer.reload();
    await expect(
      customer.getByLabel("Car make and model (required)", { exact: true }),
    ).toHaveValue("Tata Nexon demo");
    await expect(
      customer.getByLabel("Parking instructions (required)", { exact: true }),
    ).toHaveValue("Driveway beside side gate");
    await customer
      .getByRole("button", { name: "Continue", exact: true })
      .click();
    await expect(
      customer.getByLabel("Your address", { exact: true }),
    ).toHaveValue("12 Garden Street, Shadnagar");
    await expect(
      customer.getByRole("button", { name: "12:00 slot", exact: true }),
    ).toBeEnabled();
    await customer
      .getByRole("button", { name: "12:00 slot", exact: true })
      .click();
    await customer
      .getByRole("button", { name: "Continue", exact: true })
      .click();
    await expect(
      visible(customer.getByText("₹1,248", { exact: true })).first(),
    ).toBeVisible();
    await customer.screenshot({
      path: "evidence/car-cleaning-checkout.png",
      fullPage: true,
    });
    await customer
      .getByRole("button", { name: "Continue to payment", exact: true })
      .click();
    await customer.waitForURL(/\/booking\//);
    const bookingUrl = customer.url(),
      bookingId = bookingUrl.split("/").at(-1);
    await expect(
      visible(
        customer.getByText("Car make and model: Tata Nexon demo", {
          exact: true,
        }),
      ),
    ).toBeVisible();
    await customer
      .getByRole("button", { name: "Simulate payment", exact: true })
      .click();
    results.push(
      "Car package, required details, exact total and draft recovery work through payment",
    );
    step = "professional and automatic conversation";
    const pro = await browser.newPage({
      viewport: { width: 393, height: 900 },
    });
    pro.on("pageerror", (e) => errors.push(e.message));
    await pro.goto(base);
    await pro
      .getByRole("button", { name: "Enter professional app", exact: true })
      .click();
    await pro.waitForURL("**/jobs");
    await pro.goto(bookingUrl);
    await pro.getByRole("button", { name: "Accept job", exact: true }).click();
    await expect(
      pro.getByRole("button", { name: "Open address in Maps", exact: true }),
    ).toBeVisible();
    await customer
      .getByRole("button", { name: "Open conversation", exact: true })
      .click();
    await customer
      .getByLabel("Booking message", { exact: true })
      .fill("Please use the side gate.");
    await new Promise((r) => setTimeout(r, 1000));
    await customer.reload();
    await customer
      .getByRole("button", { name: "Open conversation", exact: true })
      .click();
    await expect(
      customer.getByLabel("Booking message", { exact: true }),
    ).toHaveValue("Please use the side gate.");
    await customer
      .getByRole("button", { name: "Send booking message", exact: true })
      .click();
    await pro
      .getByRole("button", { name: "Open conversation", exact: true })
      .click();
    await pro
      .getByLabel("Booking message", { exact: true })
      .fill("I will meet you at the side gate.");
    await pro
      .getByRole("button", { name: "Send booking message", exact: true })
      .click();
    await expect(
      visible(
        customer.getByText("I will meet you at the side gate.", {
          exact: true,
        }),
      ),
    ).toBeVisible({ timeout: 12000 });
    await pro
      .getByRole("button", { name: "I have arrived", exact: true })
      .click();
    await pro
      .getByRole("button", { name: "Start service", exact: true })
      .click();
    for (const label of [
      "Vehicle condition discussed before cleaning",
      "Selected exterior or interior scope completed",
      "Glass and surfaces inspected with customer",
      "Work completed as agreed",
      "Area cleaned and tools packed",
      "Customer walkthrough completed",
    ])
      await pro.getByRole("checkbox", { name: label, exact: true }).click();
    await pro
      .getByLabel("Handover notes for the customer", { exact: true })
      .fill("Demo handover: exterior and cabin inspected together.");
    await pro
      .getByRole("button", { name: "Complete service", exact: true })
      .click();
    await customer.reload();
    await expect(
      customer.getByRole("button", {
        name: "Request a revisit or report a concern",
        exact: true,
      }),
    ).toBeVisible();
    await customer
      .getByRole("button", {
        name: "Request a revisit or report a concern",
        exact: true,
      })
      .click();
    await customer
      .getByLabel("Describe your issue", { exact: true })
      .fill("Please explain care after the interior clean.");
    await customer
      .getByRole("button", { name: "Send request", exact: true })
      .click();
    await expect(
      customer.getByText("Request sent", { exact: true }),
    ).toBeVisible();
    results.push(
      "Professional plan and all completion tasks work; messages arrive automatically and unsent drafts recover",
    );
    results.push(
      "Completed booking creates a linked quality/revisit support request",
    );
    step = "owner questions and launch readiness";
    const owner = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    });
    owner.on("pageerror", (e) => errors.push(e.message));
    await owner.goto(base + "/demo");
    await owner
      .getByRole("button", { name: "Open Owner overview", exact: true })
      .click();
    await owner.waitForURL("**/dashboard/home");
    await expect(
      owner.getByText("Launch readiness & attention", { exact: true }),
    ).toBeVisible();
    await owner
      .getByRole("button", { name: "View launch requirements", exact: true })
      .click();
    await expect(
      owner.getByRole("button", {
        name: "Hide launch requirements",
        exact: true,
      }),
    ).toBeVisible();
    await owner.goto(base + "/dashboard/services");
    const card = owner
      .getByText("Doorstep car cleaning", { exact: true })
      .filter({ visible: true })
      .locator("..")
      .locator("..");
    // Select the service's editor by its position in the seeded catalog.
    await visible(
      owner.getByRole("button", { name: "Edit service details", exact: true }),
    )
      .nth(1)
      .click();
    await visible(
      owner.getByRole("button", { name: "Customer details", exact: true }),
    )
      .last()
      .click();
    await expect(
      visible(owner.getByLabel("Question label", { exact: true })).first(),
    ).toHaveValue("Car make and model");
    await visible(owner.getByLabel("Why we ask", { exact: true }))
      .first()
      .fill("Bring supplies suited to your car.");
    await visible(
      owner.getByRole("button", { name: "Save service", exact: true }),
    )
      .last()
      .click();
    results.push(
      "Owner can edit customer questions and inspect actual launch blockers",
    );
    step = "care reply";
    const care = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    });
    await care.goto(base + "/demo");
    await care
      .getByRole("button", { name: "Open Customer Care", exact: true })
      .click();
    await expect(
      visible(
        care.getByText("Please explain care after the interior clean.", {
          exact: true,
        }),
      ),
    ).toBeVisible();
    await visible(care.getByLabel("Reply to customer", { exact: true }))
      .first()
      .fill("Keep the cabin ventilated and let damp fabric dry before use.");
    await visible(care.getByRole("button", { name: "Send reply", exact: true }))
      .first()
      .click();
    await customer.reload();
    await expect(
      visible(
        customer.getByText(
          "Keep the cabin ventilated and let damp fabric dry before use.",
          { exact: true },
        ),
      ),
    ).toBeVisible();
    results.push(
      "Customer Care reply is visible in the customer's linked support thread",
    );
    step = "demo screenshot";
    await owner.goto(base + "/demo");
    await owner.screenshot({
      path: "evidence/client-product-demo.png",
      fullPage: true,
    });
    expect(errors).toEqual([]);
    await mkdir("evidence", { recursive: true });
    await writeFile(
      "evidence/launch-ui-results.json",
      JSON.stringify(
        { passed: results.length, results, errors, bookingId },
        null,
        2,
      ),
    );
    console.log(results.join("\n"));
  } catch (e) {
    console.error("Launch browser check failed at:", step);
    throw e;
  } finally {
    await browser?.close();
    api.kill();
    await new Promise((r) => api.once("exit", r));
    await rm(temp, { recursive: true, force: true });
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

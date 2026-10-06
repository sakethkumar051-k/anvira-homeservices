const { spawn } = require("node:child_process");
const { mkdtemp, rm, writeFile, mkdir } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { chromium, expect } = require("@playwright/test");
(async () => {
  const temp = await mkdtemp(join(tmpdir(), "anvira-ui-"));
  const api = spawn(process.execPath, ["server/index.mjs"], {
    env: {
      ...process.env,
      NODE_ENV: "test",
      APP_MODE: "demo",
      PAYMENT_MODE: "demo",
      PORT: "4199",
      WEB_DIST_DIR: "dist-demo",
      ALLOWED_ORIGINS: "http://127.0.0.1:4199",
      PUBLIC_API_URL: "http://127.0.0.1:4199",
      WEB_APP_URL: "http://127.0.0.1:4199",
      DB_PATH: join(temp, "ui.sqlite"),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  await new Promise((resolve, reject) => {
    api.stdout.on("data", (d) => {
      if (d.toString().includes("listening")) resolve();
    });
    api.on("error", reject);
    api.on("exit", (c) => reject(new Error("API exited " + c)));
  });
  let browser;
  const errors = [],
    results = [];
  try {
    await mkdir("evidence", { recursive: true });
    const serverChromium = (await import("@sparticuz/chromium")).default;
    browser = await chromium.launch({
      headless: true,
      executablePath:
        process.env.CHROMIUM_EXECUTABLE ||
        (process.platform === "linux"
          ? await serverChromium.executablePath()
          : undefined),
      args: process.platform === "linux" ? serverChromium.args : [],
    });
    async function login(label, width = 393, height = 852) {
      const p = await browser.newPage({
        viewport: { width, height },
        deviceScaleFactor: 1,
      });
      p.on("pageerror", (e) => errors.push(e.message));
      p.on("response", (r) => {
        if (
          r.url().includes("/api/") &&
          (r.status() >= 500 || r.status() === 429)
        )
          errors.push(`API ${r.status()}: ${new URL(r.url()).pathname}`);
      });
      await p.goto("http://127.0.0.1:4199");
      await p.getByRole("button", { name: label, exact: true }).click();
      await p.waitForURL(
        label === "Enter customer app"
          ? "**/home"
          : label === "Enter professional app"
            ? "**/jobs"
            : "**/dashboard/home",
      );
      return p;
    }
    const customer = await login("Enter customer app");
    await expect(
      customer
        .getByText("Good care. Right at home.", { exact: true })
        .filter({ visible: true }),
    ).toBeVisible();
    await customer.screenshot({ path: "evidence/customer-home.png" });
    await customer
      .getByLabel("Switch language")
      .filter({ visible: true })
      .click();
    await expect(
      customer
        .getByText("మంచి సంరక్షణ. మీ ఇంటి వద్దే.", { exact: true })
        .filter({ visible: true }),
    ).toBeVisible();
    await customer.screenshot({ path: "evidence/customer-home-telugu.png" });
    await customer
      .getByLabel("Switch language")
      .filter({ visible: true })
      .click();
    await customer
      .getByRole("button", { name: "Cleaning", exact: true })
      .click();
    await customer
      .getByRole("button", { name: "Continue", exact: true })
      .click();
    await customer
      .getByRole("checkbox", { name: "One additional bathroom" })
      .click();
    await customer
      .getByRole("button", { name: "Continue", exact: true })
      .click();
    await customer
      .getByRole("button", { name: "Continue", exact: true })
      .click();
    await expect(
      customer
        .getByText("Enter a complete address and a supported PIN: 509216.")
        .filter({ visible: true }),
    ).toBeVisible();
    await customer
      .getByLabel("Your address", { exact: true })
      .filter({ visible: true })
      .fill("12 Garden Street, Shadnagar");
    await customer.getByLabel("12:00 slot").filter({ visible: true }).click();
    await customer
      .getByRole("button", { name: "Continue", exact: true })
      .click();
    await customer.screenshot({ path: "evidence/customer-summary.png" });
    await customer.getByRole("button", { name: "Continue to payment" }).click();
    await customer.waitForURL("**/booking/*");
    const firstBooking = customer.url();
    await customer.getByRole("button", { name: "Simulate payment" }).click();
    await expect(
      customer
        .getByText("Professional assigned", { exact: true })
        .filter({ visible: true })
        .first(),
    ).toBeVisible();
    await customer.screenshot({ path: "evidence/customer-assigned.png" });
    results.push(
      "Customer: Telugu switch, address validation, add-on, booking and simulated payment",
    );
    const pro = await login("Enter professional app");
    await pro
      .getByRole("button", { name: "Open Home deep cleaning booking" })
      .click();
    await customer
      .getByRole("button", { name: "Open conversation", exact: true })
      .click();
    await customer
      .getByLabel("Booking message", { exact: true })
      .fill("Please bring the cleaning kit.");
    await customer
      .getByRole("button", { name: "Send booking message", exact: true })
      .click();
    await expect(
      customer
        .getByText("Please bring the cleaning kit.", { exact: true })
        .filter({ visible: true }),
    ).toBeVisible();
    await pro
      .getByRole("button", { name: "Open conversation", exact: true })
      .click();
    await expect(
      pro
        .getByText("Please bring the cleaning kit.", { exact: true })
        .filter({ visible: true }),
    ).toBeVisible();
    await pro
      .getByLabel("Booking message", { exact: true })
      .fill("I will bring it. Thank you.");
    await pro
      .getByRole("button", { name: "Send booking message", exact: true })
      .click();
    await customer
      .getByRole("button", { name: "Refresh conversation", exact: true })
      .click();
    await expect(
      customer
        .getByText("I will bring it. Thank you.", { exact: true })
        .filter({ visible: true }),
    ).toBeVisible();
    await customer.screenshot({ path: "evidence/booking-conversation.png" });
    results.push(
      "Customer and professional: private booking conversation with replies",
    );
    await pro.getByRole("button", { name: "Accept job" }).click();
    await pro.getByRole("button", { name: "Start service" }).click();
    await expect(
      pro.getByRole("button", { name: "Complete service" }),
    ).toBeDisabled();
    for (const x of [
      "Nearby furniture protected",
      "Cleaned surfaces inspected",
      "Work completed as agreed",
      "Area cleaned and tools packed",
      "Customer walkthrough completed",
    ])
      await pro.getByRole("checkbox", { name: x }).click();
    await pro.screenshot({ path: "evidence/professional-checklist.png" });
    await pro.getByRole("button", { name: "Complete service" }).click();
    await expect(
      pro.getByText("Completed", { exact: true }).filter({ visible: true }),
    ).toBeVisible();
    results.push(
      "Professional: assigned job acceptance, start and required completion checklist",
    );
    await customer.getByRole("tab", { name: "Bookings", exact: true }).click();
    await customer
      .getByText("Past bookings", { exact: true })
      .filter({ visible: true })
      .click();
    await customer
      .getByRole("button", { name: "Open Home deep cleaning booking" })
      .click();
    await expect(
      customer
        .getByText("Rate your experience", { exact: true })
        .filter({ visible: true }),
    ).toBeVisible();
    await customer
      .getByLabel("Your review")
      .filter({ visible: true })
      .fill("Thoughtful, careful service.");
    await customer.getByRole("button", { name: "Submit review" }).click();
    await expect(
      customer
        .getByText("★ 5 · Thank you for your review")
        .filter({ visible: true }),
    ).toBeVisible();
    results.push(
      "Customer: completed service appears in history and accepts one review",
    );
    await customer.getByRole("tab", { name: "Home", exact: true }).click();
    await customer
      .getByRole("button", { name: "Electrical", exact: true })
      .click();
    await customer
      .getByRole("button", { name: "Continue", exact: true })
      .click();
    await customer
      .getByRole("button", { name: "Continue", exact: true })
      .click();
    await customer
      .getByLabel("Your address", { exact: true })
      .filter({ visible: true })
      .fill("18 Lake Road, Shadnagar");
    await customer.getByLabel("15:00 slot").filter({ visible: true }).click();
    await customer
      .getByRole("button", { name: "Continue", exact: true })
      .click();
    await customer.getByRole("button", { name: "Continue to payment" }).click();
    await customer.getByRole("button", { name: "Simulate payment" }).click();
    await customer
      .getByRole("button", { name: "Reschedule", exact: true })
      .click();
    await customer.getByLabel("18:00 slot").filter({ visible: true }).click();
    await customer.getByRole("button", { name: "Save new slot" }).click();
    await customer
      .getByRole("button", { name: "Cancel booking", exact: true })
      .click();
    await customer
      .getByRole("button", { name: "Confirm cancellation" })
      .click();
    await expect(
      customer
        .getByText("Refund requested", { exact: true })
        .filter({ visible: true }),
    ).toBeVisible();
    results.push(
      "Customer: rescheduling, confirmed cancellation and full refund request",
    );
    await customer
      .getByRole("button", { name: "Support", exact: true })
      .click();
    await customer
      .getByLabel("Describe your issue")
      .filter({ visible: true })
      .fill("Please confirm my refund request has reached your team.");
    await customer.getByRole("button", { name: "Send request" }).click();
    await expect(
      customer
        .getByText("Request sent", { exact: true })
        .filter({ visible: true }),
    ).toBeVisible();
    const owner = await login("Owner dashboard", 1440, 1000);
    await owner.screenshot({ path: "evidence/owner-dashboard.png" });
    await owner
      .getByText("Payments & refunds", { exact: true })
      .filter({ visible: true })
      .click();
    await owner.getByRole("button", { name: "Approve full refund" }).click();
    await expect(
      owner
        .getByText("Refund complete", { exact: true })
        .filter({ visible: true }),
    ).toBeVisible();
    await owner
      .getByText("Customer support", { exact: true })
      .filter({ visible: true })
      .click();
    await owner
      .getByLabel("Reply to customer")
      .filter({ visible: true })
      .fill("We are reviewing your refund and will follow up.");
    await owner
      .getByRole("button", { name: "Send reply", exact: true })
      .click();
    await customer.reload();
    // Demo sessions are deliberately memory-only; sign in again after reload.
    await customer.goto("http://127.0.0.1:4199/?sample=customer");
    await customer.waitForURL("**/home");
    await customer.getByRole("tab", { name: "Profile", exact: true }).click();
    await customer
      .getByRole("button", { name: "Support", exact: true })
      .click();
    await expect(
      customer
        .getByText("We are reviewing your refund and will follow up.", {
          exact: true,
        })
        .filter({ visible: true }),
    ).toBeVisible();
    await customer
      .getByLabel("Add a follow-up")
      .filter({ visible: true })
      .fill("Thank you. Please let me know the next steps.");
    await customer
      .getByRole("button", { name: "Send reply", exact: true })
      .click();
    // Remount the operations workspace to retrieve the customer follow-up.
    await owner
      .getByText("Overview", { exact: true })
      .filter({ visible: true })
      .click();
    await owner
      .getByText("Customer support", { exact: true })
      .filter({ visible: true })
      .click();
    await expect(
      owner
        .getByText("Thank you. Please let me know the next steps.", {
          exact: true,
        })
        .filter({ visible: true }),
    ).toBeVisible();
    await owner
      .getByLabel("Resolution summary")
      .filter({ visible: true })
      .fill(
        "The refund has been processed. Please check your booking receipt.",
      );
    await owner.getByRole("button", { name: "Resolve request" }).click();
    await expect(
      owner.getByText("resolved", { exact: true }).filter({ visible: true }),
    ).toBeVisible();
    await customer.getByRole("tab", { name: "Home", exact: true }).click();
    await customer.getByRole("tab", { name: "Profile", exact: true }).click();
    await customer
      .getByRole("button", { name: "Support", exact: true })
      .click();
    await customer
      .getByLabel("Add a follow-up")
      .filter({ visible: true })
      .fill("I still need help with this refund.");
    await customer
      .getByRole("button", { name: "Reopen request", exact: true })
      .click();
    await expect(
      customer.getByText("open", { exact: true }).filter({ visible: true }),
    ).toBeVisible();
    await owner
      .getByRole("button", { name: "Open requests", exact: true })
      .click();
    await expect(
      owner
        .getByText("I still need help with this refund.", { exact: true })
        .filter({ visible: true }),
    ).toBeVisible();
    await owner
      .getByLabel("Resolution summary")
      .filter({ visible: true })
      .fill(
        "We confirmed the refund status and explained the expected next steps.",
      );
    await owner
      .getByRole("button", { name: "Resolve request", exact: true })
      .click();
    await owner
      .getByRole("button", { name: "All requests", exact: true })
      .click();
    results.push(
      "Support: booking link, Owner reply, customer follow-up and reopen flow with global open queue",
    );
    await owner
      .getByText("Services", { exact: true })
      .filter({ visible: true })
      .click();
    await owner
      .getByLabel("Base price (₹)")
      .filter({ visible: true })
      .first()
      .fill("1699");
    await owner.getByRole("button", { name: "Save price" }).first().click();
    await expect(
      owner.getByText("Price saved", { exact: true }).filter({ visible: true }),
    ).toBeVisible();
    results.push(
      "Owner: refund approval, support resolution and catalog price change",
    );
    const care = await login("Customer Care", 1440, 1000);
    await expect(
      care.getByText("Services", { exact: true }).filter({ visible: true }),
    ).toHaveCount(0);
    await expect(
      care
        .getByText("Professionals", { exact: true })
        .filter({ visible: true }),
    ).toHaveCount(0);
    await care.screenshot({ path: "evidence/care-dashboard.png" });
    results.push("Customer Care: restricted operations navigation");
    const small = await login("Enter customer app", 360, 800);
    await expect(
      small.getByRole("tab", { name: "Home", exact: true }),
    ).toBeVisible();
    if (
      (await small.evaluate(() => document.documentElement.scrollWidth)) > 360
    )
      throw new Error("Mobile horizontal overflow");
    await small.screenshot({ path: "evidence/android-width-home.png" });
    results.push(
      "Responsive mobile: 360 px viewport without document overflow",
    );
    await small.getByRole("tab", { name: "Profile", exact: true }).click();
    await small
      .getByRole("button", { name: "Saved addresses", exact: true })
      .click();
    await small
      .getByLabel("Your address", { exact: true })
      .filter({ visible: true })
      .fill("24 Jasmine Street, Shadnagar");
    await small
      .getByRole("button", { name: "Save address", exact: true })
      .click();
    await expect(
      small
        .getByText("24 Jasmine Street, Shadnagar", { exact: true })
        .filter({ visible: true }),
    ).toHaveCount(1);
    await small.screenshot({ path: "evidence/customer-addresses.png" });
    await small
      .getByRole("button", { name: "Edit address", exact: true })
      .click();
    await small
      .getByLabel("Your address", { exact: true })
      .filter({ visible: true })
      .fill("25 Jasmine Street, Shadnagar");
    await small
      .getByRole("button", { name: "Save address", exact: true })
      .click();
    await expect(
      small
        .getByText("25 Jasmine Street, Shadnagar", { exact: true })
        .filter({ visible: true }),
    ).toHaveCount(1);
    results.push("Customer: saved address creation and editing");
    await small.getByRole("tab", { name: "Profile", exact: true }).click();
    await small
      .getByRole("button", { name: "Account settings", exact: true })
      .click();
    await small
      .getByLabel("Your name", { exact: true })
      .filter({ visible: true })
      .fill("Ananya Rao");
    await small
      .getByRole("button", { name: "Save profile", exact: true })
      .click();
    await expect(
      small
        .getByText("Profile saved", { exact: true })
        .filter({ visible: true }),
    ).toBeVisible();
    await small.getByRole("tab", { name: "Profile", exact: true }).click();
    await expect(
      small.getByText("Ananya Rao", { exact: true }).filter({ visible: true }),
    ).toBeVisible();
    results.push("Customer: profile edit persists in the account");
    await pro.getByRole("tab", { name: "Profile", exact: true }).click();
    await pro
      .getByRole("button", {
        name: "Professional profile & schedule",
        exact: true,
      })
      .click();
    await pro
      .getByLabel("Days off (YYYY-MM-DD, separated by commas)")
      .filter({ visible: true })
      .fill("2026-12-31");
    await pro
      .getByRole("button", { name: "Save schedule", exact: true })
      .click();
    await pro.screenshot({ path: "evidence/professional-schedule.png" });
    await pro.getByRole("tab", { name: "Earnings", exact: true }).click();
    await expect(
      pro
        .getByText("In-house professional", { exact: true })
        .filter({ visible: true }),
    ).toBeVisible();
    results.push(
      "Professional: working schedule and in-house compensation view",
    );
    await owner
      .getByText("Offers", { exact: true })
      .filter({ visible: true })
      .click();
    await owner
      .getByLabel("Offer code", { exact: true })
      .filter({ visible: true })
      .fill("WELCOME");
    await owner
      .getByRole("button", { name: "Save offer", exact: true })
      .click();
    await expect(
      owner.getByText("WELCOME", { exact: true }).filter({ visible: true }),
    ).toBeVisible();
    await owner.screenshot({ path: "evidence/owner-offers.png" });
    await owner
      .getByText("Roles & settings", { exact: true })
      .filter({ visible: true })
      .click();
    await owner
      .getByLabel("Staff name", { exact: true })
      .filter({ visible: true })
      .fill("Care Two");
    await owner
      .getByLabel("Staff email", { exact: true })
      .filter({ visible: true })
      .fill("care2@example.test");
    await owner
      .getByRole("button", { name: "Create staff account", exact: true })
      .click();
    await expect(
      owner.getByText("Care Two", { exact: true }).filter({ visible: true }),
    ).toBeVisible();
    await owner.screenshot({ path: "evidence/owner-settings.png" });
    results.push("Owner: promotion and Customer Care account creation");
    await owner
      .getByText("Reports", { exact: true })
      .filter({ visible: true })
      .click();
    const downloaded = owner
      .waitForEvent("download", { timeout: 12000 })
      .catch(() => null);
    await owner
      .getByRole("button", { name: "Export CSV", exact: true })
      .click();
    const report = await downloaded;
    if (!report) {
      console.log(await owner.locator("body").innerText());
      await owner.screenshot({ path: "evidence/export-failure.png" });
      throw Error("CSV export did not download");
    }
    if (report.suggestedFilename() !== "anvira-bookings.csv")
      throw Error("Unexpected CSV filename");
    results.push("Owner: downloadable date-range CSV report");
    await owner
      .getByRole("button", { name: "Calculate report", exact: true })
      .click();
    await expect(
      owner
        .getByText("Net captured booking value", { exact: true })
        .filter({ visible: true }),
    ).toBeVisible();
    await owner.screenshot({ path: "evidence/owner-analytics.png" });
    results.push("Owner: server-calculated date-range analytics");
    await owner
      .getByText("Payouts & reconciliation", { exact: true })
      .filter({ visible: true })
      .click();
    await expect(
      owner
        .getByText("Payment reconciliation", { exact: true })
        .filter({ visible: true }),
    ).toBeVisible();
    await owner.screenshot({ path: "evidence/owner-finance.png" });
    results.push("Owner: payout and provider reconciliation workspace");
    const { createSQLiteStore } = await import("../server/lib/store.mjs");
    const fixtureStore = await createSQLiteStore(join(temp, "ui.sqlite"));
    await fixtureStore.transaction(async (tx) => {
      for (let i = 0; i < 205; i++)
        tx.put("tickets", {
          id: "history-" + String(i).padStart(3, "0"),
          customerId: "customer-1",
          customerName: "History customer " + i,
          message: "Historical support request " + i,
          status: "resolved",
          createdAt: Date.now() - 31 * 86400000,
        });
    });
    fixtureStore.close();
    await owner
      .getByText("Customer support", { exact: true })
      .filter({ visible: true })
      .click();
    await owner
      .getByRole("button", { name: "Next support page", exact: true })
      .click();
    await expect(
      owner
        .getByText("History customer 104", { exact: true })
        .filter({ visible: true }),
    ).toBeVisible();
    await owner
      .getByRole("button", { name: "Previous support page", exact: true })
      .click();
    await expect(
      owner
        .getByText("History customer 204", { exact: true })
        .filter({ visible: true }),
    ).toBeVisible();
    results.push(
      "Owner: browse older support records and return to the first page",
    );
    const qualityStore = await createSQLiteStore(join(temp, "ui.sqlite"));
    await qualityStore.transaction(async (tx) => {
      tx.put("tickets", {
        id: "quality-old-open",
        customerId: "customer-1",
        customerName: "Quality customer",
        message: "Please follow up about service quality.",
        status: "open",
        priority: "high",
        category: "quality",
        createdAt: Date.now() - 90 * 86400000,
        messages: [],
      });
    });
    qualityStore.close();
    await owner
      .getByRole("button", { name: "Next support page", exact: true })
      .click();
    await owner
      .getByRole("button", { name: "Quality follow-ups", exact: true })
      .click();
    await expect(
      owner
        .getByText("Quality customer", { exact: true })
        .filter({ visible: true }),
    ).toBeVisible();
    await expect(
      owner
        .getByText("Service quality · needs attention", { exact: true })
        .filter({ visible: true }),
    ).toBeVisible();
    await expect(
      owner.getByRole("button", { name: "Previous support page", exact: true }),
    ).toHaveCount(0);
    await owner.screenshot({ path: "evidence/owner-quality-followup.png" });
    results.push(
      "Owner: quality queue finds older unresolved issues and resets pagination across filters",
    );
    await pro.getByRole("tab", { name: "Profile", exact: true }).click();
    await pro.getByRole("button", { name: "Support", exact: true }).click();
    await pro
      .getByLabel("Describe your issue")
      .filter({ visible: true })
      .fill("Please help with my professional service schedule.");
    await pro.getByRole("button", { name: "Schedule", exact: true }).click();
    await pro
      .getByRole("button", { name: "Send request", exact: true })
      .click();
    await pro
      .getByLabel("Add a follow-up")
      .filter({ visible: true })
      .fill("I am available in the afternoon.");
    await pro.getByRole("button", { name: "Send reply", exact: true }).click();
    await expect(
      pro
        .getByText("I am available in the afternoon.", { exact: true })
        .filter({ visible: true }),
    ).toBeVisible();
    results.push(
      "Professional: categorized support and follow-up conversation",
    );
    await small.getByRole("tab", { name: "Profile", exact: true }).click();
    await small
      .getByRole("button", {
        name: "Become an ANVIRA professional",
        exact: true,
      })
      .click();
    await small
      .getByLabel("Experience in years", { exact: true })
      .filter({ visible: true })
      .fill("3");
    await small
      .getByRole("checkbox", { name: "Home deep cleaning", exact: true })
      .click();
    await small
      .getByRole("checkbox", {
        name: "I agree to ANVIRA professional terms and document verification",
        exact: true,
      })
      .click();
    await small
      .getByRole("button", { name: "Submit professional profile", exact: true })
      .click();
    await expect(
      small.getByRole("button", {
        name: "Upload identity document",
        exact: true,
      }),
    ).toBeVisible();
    await small.screenshot({ path: "evidence/professional-onboarding.png" });
    results.push(
      "Professional: customer-to-partner onboarding and document upload controls",
    );
    await small.getByRole("tab", { name: "Profile", exact: true }).click();
    await small
      .getByRole("button", { name: "Switch to customer app", exact: true })
      .click();
    await small.waitForURL("**/home");
    await small.getByRole("tab", { name: "Profile", exact: true }).click();
    await small
      .getByRole("button", { name: "Switch to professional app", exact: true })
      .click();
    await small.waitForURL("**/jobs");
    results.push(
      "Professional: switch between personal customer and professional workspaces",
    );
    if (errors.length)
      throw new Error("Browser runtime errors: " + errors.join("\n"));
    await writeFile(
      "evidence/ui-results.json",
      JSON.stringify(
        {
          passed: results.length,
          scenarios: results,
          runtimeErrors: errors,
          firstBooking,
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
  } finally {
    if (browser) await browser.close();
    api.kill();
    await new Promise((r) => api.once("exit", r));
    await rm(temp, { recursive: true, force: true });
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

// Isolated browser tests: Firebase password/reset requests are mocked. No real users or emails are created.
const { spawn } = require("node:child_process");
const { mkdtemp, rm, mkdir, writeFile } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { chromium, expect } = require("@playwright/test");
(async () => {
  const temp = await mkdtemp(join(tmpdir(), "anvira-auth-"));
  const base = "http://localhost:4399";
  const staffOnly = process.env.STAFF_ONLY_TEST === "true";
  const api = spawn(process.execPath, ["server/index.mjs"], {
    env: {
      ...process.env,
      NODE_ENV: "test",
      APP_MODE: "demo",
      PAYMENT_MODE: "demo",
      PORT: "4399",
      WEB_DIST_DIR: "dist",
      FIREBASE_PROJECT_ID: "anvira-services",
      DB_PATH: join(temp, "demo.sqlite"),
      ALLOWED_ORIGINS: base,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let browser;
  const results = [],
    errors = [];
  try {
    await new Promise((resolve, reject) => {
      api.stdout.on("data", (d) => {
        if (d.toString().includes("listening")) resolve();
      });
      api.once("exit", (c) => reject(Error("API exited " + c)));
      api.once("error", reject);
    });
    const states = {};
    for (const role of ["customer", "owner", "professional", "care"]) {
      const session = await fetch(base + "/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      }).then((r) => r.json());
      states[role] = await fetch(base + "/api/state", {
        headers: { Authorization: "Bearer " + session.token },
      }).then((r) => r.json());
    }
    browser = await chromium.launch({
      headless: true,
      executablePath: process.env.CHROMIUM_EXECUTABLE,
    });
    async function pageFixture(role = "customer") {
      const page = await browser.newPage({
        viewport: { width: staffOnly ? 1440 : 393, height: 900 },
      });
      page.on("pageerror", (e) => errors.push(e.message));
      let signedIn = false,
        lastIdToken = "",
        calls = [];
      await page.route("**/api/state", (r) =>
        r.fulfill({
          status: signedIn ? 200 : 401,
          json: signedIn
            ? states[role]
            : { code: "AUTH_REQUIRED", message: "Sign in" },
        }),
      );
      await page.route("**/api/session", async (r) => {
        const b = r.request().postDataJSON();
        expect(b.idToken).toBeTruthy();
        signedIn = true;
        await r.fulfill({ json: { ok: true } });
      });
      await page.route("https://securetoken.googleapis.com/**", (r) =>
        r.fulfill({
          json: {
            access_token: lastIdToken,
            id_token: lastIdToken,
            expires_in: "3600",
            refresh_token: "fixture-refresh",
            user_id: "fixture-" + role,
            project_id: "516523404901",
          },
        }),
      );
      await page.route(
        "https://identitytoolkit.googleapis.com/**",
        async (route) => {
          const url = route.request().url(),
            body =
              route.request().method() === "POST"
                ? route.request().postDataJSON()
                : {};
          calls.push({ url, body });
          if (url.includes("sendOobCode"))
            return route.fulfill({ json: { email: body.email } });
          if (
            url.includes("signInWithPassword") &&
            body.password === "wrong-password"
          )
            return route.fulfill({
              status: 400,
              json: {
                error: { code: 400, message: "INVALID_LOGIN_CREDENTIALS" },
              },
            });
          const uid = "fixture-" + role,
            now = Math.floor(Date.now() / 1000);
          const enc = (v) =>
            Buffer.from(JSON.stringify(v)).toString("base64url");
          const idToken =
            enc({ alg: "RS256", typ: "JWT" }) +
            "." +
            enc({
              iss: "https://securetoken.google.com/anvira-services",
              aud: "anvira-services",
              sub: uid,
              user_id: uid,
              iat: now,
              exp: now + 3600,
              auth_time: now,
              firebase: { sign_in_provider: "password" },
            }) +
            ".fixture";
          lastIdToken = idToken;
          if (url.includes("lookup"))
            return route.fulfill({
              json: {
                users: [
                  {
                    localId: uid,
                    email: "fixture@example.test",
                    displayName: body.displayName || "Fixture",
                    emailVerified: false,
                    providerUserInfo: [
                      { providerId: "password", email: "fixture@example.test" },
                    ],
                  },
                ],
              },
            });
          if (url.includes("/projects?"))
            return route.fulfill({
              json: { authorizedDomains: ["localhost"] },
            });
          if (
            url.includes("signInWithPassword") ||
            url.includes("signUp") ||
            url.includes(":update")
          )
            return route.fulfill({
              json: {
                localId: uid,
                email: body.email || "fixture@example.test",
                displayName: body.displayName || "Fixture",
                idToken,
                refreshToken: "fixture-refresh",
                expiresIn: "3600",
              },
            });
          // An unexpected identity request is a test failure, never a live write.
          errors.push("Unexpected Firebase request " + url.split("?")[0]);
          await route.abort();
        },
      );
      await page.route("**/api/logout", async (r) => {
        signedIn = false;
        await r.fulfill({ json: { ok: true } });
      });
      await page.goto(base + (staffOnly ? "/staff" : ""));
      await expect(
        page.getByRole("button", { name: "Continue with Google", exact: true }),
      ).toBeEnabled();
      await expect(
        page.getByLabel("Mobile number", { exact: true }),
      ).toHaveCount(0);
      await expect(
        page.getByLabel("Verification code", { exact: true }),
      ).toHaveCount(0);
      return { page, calls };
    }
    let { page, calls } = await pageFixture();
    await page
      .getByRole("button", { name: "Sign in with email", exact: true })
      .click();
    await expect(page.getByRole("alert")).toContainText("valid email");
    await page
      .getByLabel("Email address", { exact: true })
      .fill("fixture@example.test");
    await page.getByLabel("Password", { exact: true }).fill("wrong-password");
    await page
      .getByRole("button", { name: "Show password", exact: true })
      .click();
    await expect(page.getByLabel("Password", { exact: true })).toHaveJSProperty(
      "type",
      "text",
    );
    await page
      .getByRole("button", { name: "Hide password", exact: true })
      .click();
    await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute(
      "type",
      "password",
    );
    await page
      .getByRole("button", { name: "Sign in with email", exact: true })
      .click();
    await expect(page.getByRole("alert")).toContainText(
      "email or password did not match",
    );
    await page
      .getByRole("button", { name: "Reset password", exact: true })
      .click();
    await expect(page.getByRole("alert")).toContainText("check your email");
    expect(calls.filter((c) => c.url.includes("sendOobCode"))).toHaveLength(1);
    await page
      .getByRole("button", { name: "Reset password", exact: true })
      .click();
    await expect(page.getByRole("alert")).toContainText("wait a minute");
    expect(calls.filter((c) => c.url.includes("sendOobCode"))).toHaveLength(1);
    results.push(
      "OTP controls absent; email validation, password visibility, credential errors and reset throttling pass",
    );
    await page.getByLabel("Password", { exact: true }).fill("fixture-password");
    await page
      .getByRole("button", { name: "Sign in with email", exact: true })
      .click();
    if (staffOnly) {
      await expect(page.getByRole("alert")).toContainText(
        "Owner and Customer Care",
      );
      await expect(
        page.getByRole("button", { name: "Customer sign in", exact: true }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: "Create account", exact: true }),
      ).toHaveCount(0);
      await page.goto(base + "/home");
      await page.waitForURL("**/welcome");
      results.push(
        "Customer account cannot enter staff portal; registration and mobile customer routes are absent",
      );
    } else {
      await page.waitForURL("**/home");
      results.push(
        "Email sign-in completes the API session and opens the customer app",
      );
    }
    await page.close();
    if (!staffOnly) {
      ({ page, calls } = await pageFixture());
      await page
        .getByRole("button", { name: "Create account", exact: true })
        .click();
      await page.getByLabel("Your name", { exact: true }).fill("New Customer");
      await page
        .getByLabel("Email address", { exact: true })
        .fill("new@example.test");
      await page.getByLabel("Password", { exact: true }).fill("short");
      await page.getByLabel("Confirm password", { exact: true }).fill("short");
      await page
        .getByRole("button", { name: "Create account & continue", exact: true })
        .click();
      await expect(page.getByRole("alert")).toContainText("8 characters");
      expect(calls).toHaveLength(0);
      await page
        .getByLabel("Password", { exact: true })
        .fill("fixture-password");
      await page
        .getByLabel("Confirm password", { exact: true })
        .fill("different-password");
      await page
        .getByRole("button", { name: "Create account & continue", exact: true })
        .click();
      await expect(page.getByRole("alert")).toContainText("do not match");
      expect(calls).toHaveLength(0);
      await page
        .getByLabel("Confirm password", { exact: true })
        .fill("fixture-password");
      await page
        .getByRole("button", { name: "Create account & continue", exact: true })
        .click();
      await page.waitForURL("**/home");
      expect(calls.some((c) => c.url.includes("signUp"))).toBe(true);
      expect(
        calls.some(
          (c) =>
            c.url.includes(":update") && c.body.displayName === "New Customer",
        ),
      ).toBe(true);
      results.push(
        "Registration rejects weak/mismatched passwords, creates the Firebase customer and saves the name",
      );
      await page.close();
    }
    if (staffOnly) {
      ({ page } = await pageFixture("professional"));
      await page
        .getByLabel("Email address", { exact: true })
        .fill("professional@example.test");
      await page
        .getByLabel("Password", { exact: true })
        .fill("fixture-password");
      await page
        .getByRole("button", { name: "Sign in with email", exact: true })
        .click();
      await expect(page.getByRole("alert")).toContainText(
        "Owner and Customer Care",
      );
      await page.goto(base + "/jobs");
      await page.waitForURL("**/welcome");
      results.push(
        "Professional account and job routes are excluded from the website portal",
      );
      await page.close();
    }
    for (const role of staffOnly
      ? ["owner", "care"]
      : ["owner", "professional"]) {
      ({ page } = await pageFixture(role));
      if (!staffOnly)
        await page
          .getByRole("button", {
            name: "Owner & professional sign in",
            exact: true,
          })
          .click();
      await expect(
        page.getByRole("button", { name: "Create account", exact: true }),
      ).toHaveCount(0);
      await page
        .getByLabel("Email address", { exact: true })
        .fill("fixture@example.test");
      await page
        .getByLabel("Password", { exact: true })
        .fill("fixture-password");
      await page
        .getByRole("button", { name: "Sign in with email", exact: true })
        .click();
      await page.waitForURL(
        role === "professional" ? "**/jobs" : "**/dashboard/home",
      );
      results.push(role + " sign-in opens its approved workspace");
      await page.close();
    }
    if (process.env.SKIP_GOOGLE_NETWORK_TEST !== "true") {
      // Fresh unauthenticated browser: real Google helper opens the account selection page.
      // No credentials are supplied. Abort every account exchange to prevent creating a live user.
      const google = await browser.newPage({
        viewport: { width: 393, height: 900 },
      });
      await google.route("**/api/state", (r) =>
        r.fulfill({
          status: 401,
          json: { code: "AUTH_REQUIRED", message: "Sign in" },
        }),
      );
      await google
        .context()
        .route("**/*accounts:signInWithIdp*", (r) => r.abort());
      await google.goto(base);
      const popupPromise = google.waitForEvent("popup", { timeout: 30000 });
      await google
        .getByRole("button", { name: "Continue with Google", exact: true })
        .click();
      const popup = await popupPromise;
      await popup.waitForURL(/accounts\.google\.com/, { timeout: 45000 });
      await expect(
        popup.getByRole("textbox", { name: /Email or phone/i }),
      ).toBeVisible({ timeout: 30000 });
      await popup.close();
      await expect(google.getByRole("alert")).toContainText("cancelled", {
        timeout: 15000,
      });
      await google.screenshot({
        path: "evidence/email-google-signin.png",
        fullPage: true,
      });
      results.push(
        "Real Firebase Google provider reaches Google account selection; cancellation recovers without a live user",
      );
    }
    expect(errors).toEqual([]);
    await mkdir("evidence", { recursive: true });
    await writeFile(
      "evidence/auth-browser-results.json",
      JSON.stringify(
        {
          results,
          errors,
          firebasePasswordRequests: "mocked",
          googleOAuth:
            process.env.SKIP_GOOGLE_NETWORK_TEST === "true"
              ? "not run; separate provider verification required"
              : "account-selection only, no credentials or live users",
        },
        null,
        2,
      ),
    );
    console.log(JSON.stringify({ passed: results.length, results }, null, 2));
  } catch (e) {
    for (const ctx of browser?.contexts() || [])
      for (const p of ctx.pages())
        console.error({
          url: p.url(),
          alerts: await p
            .getByRole("alert")
            .allTextContents()
            .catch(() => []),
        });
    console.error(e);
    process.exitCode = 1;
  } finally {
    await browser?.close();
    api.kill("SIGTERM");
    await new Promise((r) => api.once("exit", r));
    await rm(temp, { recursive: true, force: true });
  }
})();

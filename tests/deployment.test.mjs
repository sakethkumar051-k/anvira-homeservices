import { test } from "node:test";
import assert from "node:assert/strict";
import { websiteConfig } from "../deployment/vercel-config.mjs";
import { config } from "../server/lib/config.mjs";
import { createGateway } from "../server/lib/gateway.mjs";
test("website configuration requires an explicit public origin and proxies API/payment routes before the SPA", () => {
  for (const url of [
    undefined,
    "http://api.test",
    "https://a:b@api.test",
    "https://api.test/subpath",
    "https://localhost",
  ])
    assert.throws(() =>
      websiteConfig({
        ANVIRA_API_ORIGIN: url,
        EXPO_PUBLIC_AUTH_MODE: "firebase",
      }),
    );
  const cfg = websiteConfig({
    ANVIRA_API_ORIGIN: "https://api.anvira.test",
    EXPO_PUBLIC_AUTH_MODE: "firebase",
  });
  assert.equal(
    cfg.rewrites[0].destination,
    "https://api.anvira.test/api/:path*",
  );
  assert.equal(
    cfg.rewrites[1].destination,
    "https://api.anvira.test/payment-checkout/:path*",
  );
  assert.equal(cfg.rewrites.at(-1).destination, "/index.html");
  assert.equal(cfg.redirects[0].destination, "/welcome");
});
test("Razorpay environment cannot silently mismatch keys", () => {
  assert.throws(() =>
    config({
      RAZORPAY_ENVIRONMENT: "live",
      RAZORPAY_KEY_ID: "rzp_test_fixture",
    }),
  );
  assert.throws(() =>
    config({
      RAZORPAY_ENVIRONMENT: "test",
      RAZORPAY_KEY_ID: "rzp_live_fixture",
    }),
  );
  assert.equal(
    config({ RAZORPAY_KEY_ID: "rzp_test_fixture" }).paymentEnvironment,
    "test",
  );
  assert.equal(
    config({ RAZORPAY_KEY_ID: "rzp_live_fixture" }).paymentEnvironment,
    "live",
  );
});
test("Render's assigned HTTPS origin is usable without hardcoding an unassigned hostname", () => {
  const env = {
    APP_MODE: "firebase",
    NODE_ENV: "production",
    RENDER: "true",
    RENDER_EXTERNAL_URL: "https://assigned-api.onrender.com",
    ALLOWED_ORIGINS: "https://client-site.test",
  };
  assert.equal(config(env).publicUrl, env.RENDER_EXTERNAL_URL);
  assert.equal(
    config({ ...env, PUBLIC_API_URL: "https://custom-api.test" }).publicUrl,
    "https://custom-api.test",
  );
  assert.throws(() =>
    config({ ...env, RENDER_EXTERNAL_URL: "http://assigned-api.test" }),
  );
  assert.throws(() => config({ ...env, RENDER: "false" }));
});
test("Razorpay timeout or malformed provider response never looks like a successful payment", async () => {
  const cfg = {
    paymentMode: "razorpay",
    razorpayKeyId: "rzp_test_fixture",
    razorpayKeySecret: "fixture",
  };
  for (const transport of [
    async () => {
      throw Error("network");
    },
    async () => ({
      json: async () => {
        throw Error("invalid JSON");
      },
    }),
  ]) {
    const gateway = createGateway(cfg, transport);
    await assert.rejects(
      gateway.order({ id: "booking-fixture", total: 499 }),
      (e) => e.code === "GATEWAY_UNAVAILABLE" && e.status === 503,
    );
  }
});

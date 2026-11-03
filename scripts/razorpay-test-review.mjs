// Explicit provider smoke test. Local disposable SQLite only; never uses Firestore.
import "dotenv/config";
import express from "express";
import { createApplication } from "../server/app.mjs";
import { createSQLiteStore } from "../server/lib/store.mjs";
import { config } from "../server/lib/config.mjs";
import { slotFor } from "../server/lib/domain.mjs";
if (!process.argv.includes("--run-provider-test"))
  throw Error(
    "Pass --run-provider-test to create one disposable Razorpay TEST order.",
  );
if (
  !process.env.RAZORPAY_KEY_ID?.startsWith("rzp_test_") ||
  process.env.RAZORPAY_ENVIRONMENT === "live"
)
  throw Error("Only test credentials are accepted.");
const origin = "http://localhost:4310";
const cfg = config({
  APP_MODE: "demo",
  PAYMENT_MODE: "razorpay",
  RAZORPAY_ENVIRONMENT: "test",
  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID,
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET,
  RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET,
  PUBLIC_API_URL: origin,
  WEB_APP_URL: origin,
  ALLOWED_ORIGINS: origin,
});
const application = await createApplication({
  store: await createSQLiteStore(":memory:"),
  config: cfg,
});
let checkoutUrl, bookingId;
const outer = express();
outer.get("/review", (_req, res) => res.redirect(checkoutUrl || "/api/health"));
outer.get("/review-status", async (_req, res) => {
  const b = await application.store.get("bookings", bookingId);
  res.json({
    environment: "test",
    storage: "disposable-local-sqlite",
    payment: b?.payment,
    status: b?.status,
    amount: b?.total,
    refund: b?.refund,
  });
});
outer.use(application.app);
const server = outer.listen(4310, "127.0.0.1");
await new Promise((resolve) => server.once("listening", resolve));
async function request(path, token, body) {
  const r = await fetch(origin + "/api" + path, {
    method: body ? "POST" : "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const d = await r.json();
  if (!r.ok) throw Error(d.error || "Test request failed");
  return d;
}
try {
  const token = (await request("/session", "", { role: "customer" })).token;
  const b = await request("/bookings", token, {
    serviceId: "cleaning",
    address: { line: "Fictional test home, Shadnagar", pin: "509216" },
    slot: slotFor(
      new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10),
      12,
    ),
    idempotencyKey: "provider-review-" + Date.now(),
  });
  bookingId = b.id;
  checkoutUrl = (
    await request("/bookings/" + b.id + "/payment/order", token, {})
  ).checkoutUrl;
  console.log(
    JSON.stringify({
      ready: true,
      environment: "test",
      reviewUrl: origin + "/review",
      statusUrl: origin + "/review-status",
      realMoneyMoved: false,
      productionDataChanged: false,
    }),
  );
} catch (error) {
  console.error(error.message);
  server.close();
  application.store.close();
  process.exitCode = 1;
}
for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, () => {
    server.close(() => {
      application.store.close();
      process.exit(0);
    });
  });

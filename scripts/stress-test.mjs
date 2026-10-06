import { createApplication } from "../server/app.mjs";
import {
  createSQLiteStore,
  createFirestoreStore,
} from "../server/lib/store.mjs";
import { config } from "../server/lib/config.mjs";
import { seedDemo } from "../server/lib/seed.mjs";
import { slotFor } from "../server/lib/domain.mjs";
import { createHmac, createHash } from "node:crypto";
import { performance, monitorEventLoopDelay } from "node:perf_hooks";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
// Always creates a disposable local store. It cannot target Firebase, customers or live payments.
const emulator = process.argv.includes("--firestore-emulator");
let store, firestore;
if (emulator) {
  if (
    !/^(127\.0\.0\.1|localhost):\d+$/.test(
      process.env.FIRESTORE_EMULATOR_HOST || "",
    )
  )
    throw new Error(
      "Firestore stress tests require a local emulator. Cloud database targets are forbidden.",
    );
  const { initializeApp } = await import("firebase-admin/app");
  const { getFirestore } = await import("firebase-admin/firestore");
  firestore = getFirestore(
    initializeApp({ projectId: "demo-anvira-load" }, "load-fixture"),
  );
  store = createFirestoreStore(firestore);
} else store = await createSQLiteStore(":memory:");
await seedDemo(store);
await store.transaction(async (tx) => {
  for (const s of await tx.list("services"))
    tx.put("services", { ...s, sample: false });
});
const cfg = config({
  APP_MODE: "firebase",
  PAYMENT_MODE: "razorpay",
  RAZORPAY_ENVIRONMENT: "test",
  RAZORPAY_KEY_ID: "rzp_test_fixture",
  RAZORPAY_KEY_SECRET: "fixture-secret",
  RAZORPAY_WEBHOOK_SECRET: "fixture-webhook",
  ALLOWED_ORIGINS: "http://127.0.0.1",
});
const application = await createApplication({
  config: cfg,
  store,
  firebase: {
    auth: {
      verifyIdToken: async (token) => ({
        uid: token,
        name: "Load fixture",
        auth_time: Date.now() / 1000,
      }),
    },
  },
  gateway: {
    order: async (b) => ({
      id: "order_" + b.id.replaceAll("-", ""),
      amount: b.total * 100,
      currency: "INR",
    }),
  },
});
const server = application.app.listen(0, "127.0.0.1");
await new Promise((r) => server.once("listening", r));
const base = "http://127.0.0.1:" + server.address().port;
const actors = Array.from({ length: 12 }, (_, i) => "load-customer-" + i);
const report = {
  createdAt: new Date().toISOString(),
  target: "isolated local API",
  database: emulator
    ? "local Firestore emulator; isolated demo-anvira-load"
    : "in-memory SQLite",
  identity: "Firebase protocol fixture",
  payments: "Razorpay protocol fixture; no provider requests",
  stages: [],
  invariants: [],
  productionCapacityCertified: false,
};
const lag = monitorEventLoopDelay({ resolution: 10 });
lag.enable();
const rssSamples = [process.memoryUsage().rss];
async function request(route, actor, body, extra = {}) {
  const t = performance.now();
  const r = await fetch(base + route, {
    method: body ? "POST" : "GET",
    headers: {
      "Content-Type": "application/json",
      ...(actor ? { Authorization: "Bearer " + actor } : {}),
      ...extra,
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30000),
  });
  const data = await r.json();
  return { status: r.status, data, ms: performance.now() - t };
}
async function batch(n, concurrency, work) {
  const out = [];
  let index = 0;
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (index < n) {
        const i = index++;
        out[i] = await work(i);
      }
    }),
  );
  return out;
}
try {
  await Promise.all(actors.map((a) => request("/api/state", a)));
  for (const concurrency of [1, 10, 25, 50]) {
    const started = performance.now();
    const out = await batch(120, concurrency, (i) =>
      request(
        ["/api/catalog", "/api/state", "/api/ready"][i % 3],
        actors[i % actors.length],
      ),
    );
    const times = out.map((r) => r.ms).sort((a, b) => a - b);
    const statuses = out.reduce(
      (m, r) => ((m[r.status] = (m[r.status] || 0) + 1), m),
      {},
    );
    assert.ok(out.every((r) => r.status === 200));
    report.stages.push({
      concurrency,
      requests: out.length,
      statuses,
      requestsPerSecond: +(
        out.length /
        ((performance.now() - started) / 1000)
      ).toFixed(1),
      p50Ms: +times[Math.floor(times.length * 0.5)].toFixed(1),
      p95Ms: +times[Math.floor(times.length * 0.95)].toFixed(1),
      maxMs: +times.at(-1).toFixed(1),
    });
  }
  const day = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const input = (key, hour) => ({
    serviceId: "car-cleaning",
    slot: slotFor(day, hour),
    addons: [],
    packageId: "inside-out",
    options: { "vehicle-size": "suv", water: "tap" },
    details: { vehicle: "Tata Nexon fixture", parking: "Fixture driveway" },
    address: { line: "Fixture driveway, Shadnagar", pin: "509216" },
    idempotencyKey: key,
  });
  const retries = await batch(20, 20, () =>
    request("/api/bookings", actors[0], input("stress-retry-same", 9)),
  );
  assert.ok(retries.every((r) => r.status === 201));
  assert.equal(new Set(retries.map((r) => r.data.id)).size, 1);
  report.invariants.push(
    "20 concurrent identical checkouts produce exactly one booking",
  );
  const contenders = await batch(30, 30, (i) =>
    request(
      "/api/bookings",
      actors[1 + (i % 11)],
      input("stress-contention-" + i, 15),
    ),
  );
  report.contentionStatuses = contenders.reduce(
    (m, r) => (
      (m[r.status + ":" + (r.data.code || "OK")] =
        (m[r.status + ":" + (r.data.code || "OK")] || 0) + 1),
      m
    ),
    {},
  );
  assert.equal(contenders.filter((r) => r.status === 201).length, 1);
  assert.equal(contenders.filter((r) => r.status === 409).length, 29);
  report.invariants.push(
    "30 competing checkouts reserve one professional slot exactly once; 29 receive availability conflicts",
  );
  const order = await request(
    "/api/bookings/" + retries[0].data.id + "/payment/order",
    actors[0],
    {},
  );
  assert.equal(order.status, 200);
  const booked = await store.get("bookings", retries[0].data.id);
  const webhook = {
    event: "payment.captured",
    payload: {
      payment: {
        entity: {
          id: "pay_stressfixture",
          order_id: booked.orderId,
          amount: booked.total * 100,
          currency: "INR",
          status: "captured",
        },
      },
    },
  };
  const signature = createHmac("sha256", cfg.webhookSecret)
    .update(JSON.stringify(webhook))
    .digest("hex");
  const replays = await batch(20, 20, () =>
    request("/api/webhooks/razorpay", null, webhook, {
      "x-razorpay-signature": signature,
      "x-razorpay-event-id": "evt_stressfixture",
    }),
  );
  assert.ok(replays.every((r) => r.status === 200));
  assert.equal(
    (
      await store.list("events", [
        [
          "id",
          "==",
          createHash("sha256").update("evt_stressfixture").digest("hex"),
        ],
      ])
    ).length,
    1,
  );
  assert.equal(
    (await store.list("bookings", [["paymentId", "==", "pay_stressfixture"]]))
      .length,
    1,
  );
  assert.equal((await store.get("bookings", booked.id)).payment, "paid");
  report.invariants.push(
    "20 repeated signed provider events confirm one payment and deduplicate once",
  );
  const unknown = {
    event: "payment.captured",
    payload: {
      payment: {
        entity: {
          id: "pay_unknownfixture",
          order_id: "order_unknownfixture",
          amount: 109900,
          currency: "INR",
          status: "captured",
        },
      },
    },
  };
  const rejected = await request("/api/webhooks/razorpay", null, unknown, {
    "x-razorpay-signature": createHmac("sha256", cfg.webhookSecret)
      .update(JSON.stringify(unknown))
      .digest("hex"),
  });
  assert.equal(rejected.status, 409);
  assert.equal(
    (await store.list("bookings", [["paymentId", "==", "pay_unknownfixture"]]))
      .length,
    0,
  );
  report.invariants.push("Unknown provider order cannot mark a booking paid");
  const soakStart = performance.now();
  for (let round = 0; round < 20; round++) {
    const out = await batch(16, 16, (i) =>
      request(
        ["/api/catalog", "/api/ready", "/api/state"][i % 3],
        actors[(round * 16 + i) % 11],
      ),
    );
    assert.ok(out.every((r) => r.status === 200));
    rssSamples.push(process.memoryUsage().rss);
    await new Promise((r) => setTimeout(r, 1000));
  }
  report.soak = {
    rounds: 20,
    requests: 320,
    elapsedSeconds: +((performance.now() - soakStart) / 1000).toFixed(1),
    serverErrors: 0,
  };
  const throttled = await batch(210, 25, () =>
    request("/api/state", actors[11]),
  );
  assert.ok(throttled.some((r) => r.status === 429));
  assert.ok(throttled.every((r) => [200, 429].includes(r.status)));
  report.invariants.push(
    "Account burst protection returns 429 without server errors",
  );
  report.totalRequests = 12 + 480 + 20 + 30 + 1 + 20 + 1 + 320 + 210;
  report.eventLoopP95Ms = +(lag.percentile(95) / 1e6).toFixed(1);
  report.peakObservedRssMB = +(
    Math.max(...rssSamples, process.memoryUsage().rss) /
    1024 /
    1024
  ).toFixed(1);
  report.passed = true;
} catch (e) {
  report.passed = false;
  report.failure = e.message;
  process.exitCode = 1;
} finally {
  lag.disable();
  await new Promise((r) => server.close(r));
  store.close?.();
  await firestore?.terminate();
  await mkdir("evidence", { recursive: true });
  await writeFile(
    emulator
      ? "evidence/stress-firestore-results.json"
      : "evidence/stress-results.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
}

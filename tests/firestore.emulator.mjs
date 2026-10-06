import { test, after, before } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { initializeApp, deleteApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import {
  initializeTestEnvironment,
  assertFails,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { createFirestoreStore } from "../server/lib/store.mjs";
import { seedDemo } from "../server/lib/seed.mjs";
import { domain, slotFor } from "../server/lib/domain.mjs";
import { reportSummary } from "../server/lib/reporting.mjs";
let app, environment, store, business;
before(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST)
    throw new Error(
      "Run with npm run test:firestore to isolate this suite from production.",
    );
  const projectId = "demo-anvira";
  app = initializeApp({ projectId }, "emulator-test");
  environment = await initializeTestEnvironment({
    projectId,
    firestore: { rules: await readFile("firestore.rules", "utf8") },
  });
  await environment.clearFirestore();
  store = createFirestoreStore(getFirestore(app));
  await seedDemo(store);
  business = domain(store, { live: false, paymentMode: "demo" });
});
test("Firestore server aggregation counts and sums all 205 matching records beyond the dashboard list cap", async () => {
  const createdAt = Date.now();
  await store.transaction(async (tx) => {
    for (let i = 0; i < 205; i++)
      tx.put("aggregation", {
        id: "aggregate-" + i,
        createdAt,
        status: "completed",
        total: 10,
      });
  });
  const result = await store.aggregate(
    "aggregation",
    [["status", "==", "completed"]],
    ["total"],
  );
  assert.equal(result.count, 205);
  assert.equal(result.total, 2050);
  const overview = await reportSummary(store, "owner");
  assert.equal(overview.bookings, (await store.aggregate("bookings")).count);
  assert.equal(overview.days.length, 7);
});
after(async () => {
  await environment?.cleanup();
  if (app) await deleteApp(app);
});
test("Firestore denies direct customer/Owner reads and writes; API alone owns datastore access", async () => {
  for (const role of ["customer", "owner"]) {
    const db = environment.authenticatedContext(role, { role }).firestore();
    await assertFails(getDoc(doc(db, "services", "cleaning")));
    await assertFails(setDoc(doc(db, "users", role), { role: "owner" }));
  }
});
test("Firestore transactions allow only two simultaneous overlapping reservations for two qualified professionals", async () => {
  const date = new Date(Date.now() + 6 * 86400000).toISOString().slice(0, 10);
  const attempts = await Promise.allSettled(
    Array.from({ length: 6 }, (_, i) =>
      business.createBooking(
        { id: "customer-" + i, role: "customer", name: "Customer" },
        {
          serviceId: "cleaning",
          addons: [],
          slot: slotFor(date, 12),
          address: { line: "12 Garden Street, Shadnagar", pin: "509216" },
          idempotencyKey: "concurrent-firestore-" + i,
        },
      ),
    ),
  );
  assert.equal(attempts.filter((r) => r.status === "fulfilled").length, 2);
  assert.equal(
    attempts.filter(
      (r) => r.status === "rejected" && r.reason.code === "SLOT_FULL",
    ).length,
    4,
  );
  assert.equal((await store.list("bookings")).length, 2);
  assert.equal((await store.list("locks")).length, 14);
});
test("Firestore duplicate checkout returns one booking and recent-first cursor preserves tied timestamps", async () => {
  const date = new Date(Date.now() + 8 * 86400000).toISOString().slice(0, 10),
    user = { id: "retry-user", role: "customer", name: "Retry" },
    input = {
      serviceId: "plumbing",
      addons: [],
      slot: slotFor(date, 12),
      address: { line: "12 Garden Street, Shadnagar", pin: "509216" },
      idempotencyKey: "firestore-repeat-001",
    };
  const [a, b] = await Promise.all([
    business.createBooking(user, input),
    business.createBooking(user, input),
  ]);
  assert.equal(a.id, b.id);
  await store.transaction(async (tx) => {
    for (const id of ["test-a", "test-b", "test-c"])
      tx.put("pagination", { id, createdAt: 100 });
  });
  const order = [
      ["createdAt", "desc"],
      ["id", "desc"],
    ],
    first = await store.list("pagination", [], 2, { order }),
    second = await store.list("pagination", [], 2, {
      order,
      cursor: [first[1].createdAt, first[1].id],
    });
  assert.deepEqual(
    first.map((x) => x.id),
    ["test-c", "test-b"],
  );
  assert.deepEqual(
    second.map((x) => x.id),
    ["test-a"],
  );
});

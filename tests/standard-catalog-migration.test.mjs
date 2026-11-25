import { test } from "node:test";
import assert from "node:assert/strict";
import { createSQLiteStore } from "../server/lib/store.mjs";
import {
  buildStandardCatalogPlan,
  applyStandardCatalogPlan,
} from "../scripts/apply-standard-catalog.mjs";
import { standardServices } from "../server/lib/standard-catalog.mjs";
const originals = standardServices
  .filter((s) => s.id !== "review-car-wash")
  .map((s) => ({
    ...s,
    bookingMode: "quote",
    price: 9876,
    packages: [],
    addons: [],
    reviewOnly: true,
  }));
const worker = {
  id: "review-internal-booking-1",
  reviewOnly: true,
  sample: true,
  accountless: true,
  skills: originals.map((s) => s.id),
};
test("plan changes only the named standard services and test worker skills; monthly plan and other records stay intact", () => {
  const monthly = { id: "review-car-cleaning", bookingMode: "quote", price: 0 };
  const plan = buildStandardCatalogPlan(
    [...originals, monthly, { id: "custom-service", price: 4321 }],
    [worker, { id: "real-worker", skills: [] }],
  );
  assert.equal(plan.operations.filter((o) => o.kind === "services").length, 6);
  assert.deepEqual(
    plan.operations.filter((o) => o.kind === "professionals").map((o) => o.id),
    [worker.id],
  );
  assert.ok(
    !plan.operations.some((o) =>
      ["review-car-cleaning", "custom-service", "real-worker"].includes(o.id),
    ),
  );
});
test("application detects a concurrent price edit before making any mutation", async () => {
  const store = await createSQLiteStore(":memory:");
  try {
    await store.transaction((tx) =>
      originals.forEach((s) => tx.put("services", s)),
    );
    const plan = buildStandardCatalogPlan(originals, []);
    await store.transaction((tx) =>
      tx.put("services", { ...originals[0], price: 2222 }),
    );
    await assert.rejects(
      () => applyStandardCatalogPlan(store, plan),
      /changed/,
    );
    assert.equal(
      (await store.get("services", originals[1].id)).bookingMode,
      "quote",
    );
    assert.equal(await store.get("services", "review-car-wash"), null);
  } finally {
    store.close();
  }
});
test("applying the menu is idempotent and never resets prices later edited by admin", async () => {
  const store = await createSQLiteStore(":memory:");
  try {
    await store.transaction((tx) => {
      originals.forEach((s) => tx.put("services", s));
      tx.put("bookings", { id: "old", total: 123 });
      tx.put("professionals", worker);
    });
    const plan = buildStandardCatalogPlan(originals, [worker]);
    await applyStandardCatalogPlan(store, plan);
    assert.deepEqual(await store.get("bookings", "old"), {
      id: "old",
      total: 123,
    });
    await store.transaction(async (tx) =>
      tx.put("services", {
        ...(await tx.get("services", originals[0].id)),
        price: 777,
        packages: [],
      }),
    );
    const retry = buildStandardCatalogPlan(
      await store.list("services"),
      await store.list("professionals"),
    );
    assert.equal(retry.operations.length, 0);
    assert.equal((await store.get("services", originals[0].id)).price, 777);
  } finally {
    store.close();
  }
});

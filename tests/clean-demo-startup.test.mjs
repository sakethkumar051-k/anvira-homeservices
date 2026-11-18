import test from "node:test";
import assert from "node:assert/strict";
import { createSQLiteStore } from "../server/lib/store.mjs";
import { seedDemo } from "../server/lib/seed.mjs";

test("clean demo startup publishes discovery catalog and staff without inventing customers, workers or history", async () => {
  const previous = process.env.SEED_DEMO_PEOPLE;
  process.env.SEED_DEMO_PEOPLE = "false";
  const store = await createSQLiteStore(":memory:");
  try {
    await seedDemo(store);
    assert.equal((await store.list("professionals")).length, 0);
    assert.deepEqual((await store.list("users")).map((u) => u.role).sort(), [
      "care",
      "owner",
    ]);
    assert.equal((await store.list("services")).length, 6);
    assert.equal((await store.list("bookings")).length, 0);
    assert.ok(await store.get("settings", "company"));
    await store.transaction(async (tx) => {
      tx.put("users", {
        id: "customer-1",
        name: "Actual customer",
        role: "customer",
      });
      tx.put("professionals", { id: "real-worker", name: "Actual worker" });
    });
    await seedDemo(store);
    assert.equal(
      (await store.get("users", "customer-1")).name,
      "Actual customer",
    );
    assert.deepEqual(await store.get("professionals", "real-worker"), {
      id: "real-worker",
      name: "Actual worker",
    });
  } finally {
    if (previous === undefined) delete process.env.SEED_DEMO_PEOPLE;
    else process.env.SEED_DEMO_PEOPLE = previous;
    store.close();
  }
});

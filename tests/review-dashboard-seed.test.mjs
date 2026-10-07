import test from "node:test";
import assert from "node:assert/strict";
import { createSQLiteStore } from "../server/lib/store.mjs";
import { seedDemo } from "../server/lib/seed.mjs";
import { seedReviewDashboard } from "../server/lib/review-dashboard-seed.mjs";

test("local dashboard seed is repeatable and keeps sample money balanced", async () => {
  const store = await createSQLiteStore(":memory:");
  try {
    await seedDemo(store);
    await seedReviewDashboard(store);
    const bookings = await store.list("bookings");
    assert.equal(bookings.length, 26);
    for (const status of ["completed", "cancelled", "confirmed", "assigned", "in_progress", "payment_pending"])
      assert.ok(bookings.some((b) => b.status === status), status);
    assert.equal((await store.list("professionals")).length, 8);
    assert.equal((await store.list("payouts")).length, 2);
    assert.ok(bookings.some((b) => b.refund === "refunded"));
    const ledger = await store.list("ledger");
    for (const wallet of await store.list("wallets")) {
      const earned = ledger.filter((l) => l.professionalId === wallet.id).reduce((sum, l) => sum + l.amount, 0);
      assert.equal(wallet.available + wallet.held + wallet.paid, earned);
    }
    await seedReviewDashboard(store);
    assert.equal((await store.list("bookings")).length, 26);
    assert.equal((await store.list("payouts")).length, 2);
    assert.equal((await store.list("ledger")).length, ledger.length);
  } finally {
    store.close();
  }
});

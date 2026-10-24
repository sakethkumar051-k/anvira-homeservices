import { test } from "node:test";
import assert from "node:assert/strict";
import { advanceLaundry } from "../server/lib/laundry.mjs";
const pro = { id: "p1", role: "professional" },
  customer = { id: "c1", role: "customer" };
function booking() {
  return {
    id: "b",
    customerId: "c1",
    professionalId: "p1",
    fulfillmentType: "laundry",
    payment: "paid",
    status: "in_progress",
  };
}
test("laundry progresses in order with revision checking and delivery acknowledgement", () => {
  const b = booking();
  assert.throws(
    () =>
      advanceLaundry(b, pro, {
        stage: "processing",
        revision: 0,
        note: "checked",
      }),
    /next/,
  );
  const stages = [
    "collected",
    "received",
    "processing",
    "ready",
    "out_for_delivery",
    "delivered",
  ];
  for (const [i, stage] of stages.entries())
    advanceLaundry(b, pro, {
      stage,
      revision: i,
      note:
        stage === "delivered"
          ? "Received by resident, Anita"
          : "Bag sealed, 12 garments",
    });
  assert.equal(b.laundry.stage, "delivered");
  assert.equal(b.laundry.history.length, 6);
  assert.throws(
    () =>
      advanceLaundry(b, pro, {
        stage: "delivered",
        revision: 5,
        note: "duplicate",
      }),
    /changed/,
  );
});
test("laundry rejects unpaid, cancelled, unrelated professionals, and customer writes", () => {
  for (const b of [
    { ...booking(), payment: "pending" },
    { ...booking(), status: "cancelled" },
    { ...booking(), fulfillmentType: "visit" },
  ])
    assert.throws(() =>
      advanceLaundry(b, pro, {
        stage: "collected",
        revision: 0,
        note: "12 items",
      }),
    );
  assert.throws(() =>
    advanceLaundry(booking(), customer, {
      stage: "collected",
      revision: 0,
      note: "12 items",
    }),
  );
  assert.throws(() =>
    advanceLaundry(
      booking(),
      { id: "p2", role: "professional" },
      { stage: "collected", revision: 0, note: "12 items" },
    ),
  );
  assert.throws(() =>
    advanceLaundry(booking(), pro, {
      stage: "collected",
      revision: 0,
      note: "",
    }),
  );
});

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dispatchSummary,
  offerSecondsRemaining,
  canOperateInternalBooking,
} from "../src/lib/dispatch.ts";

const booking = (changes = {}) => ({
  status: "awaiting_assignment",
  payment: "paid",
  dispatch: { version: 1, state: "awaiting_staff", revision: 0 },
  ...changes,
});

test("office queue explains next steps without asking internal workers to use an app", () => {
  assert.equal(dispatchSummary(booking()).label, "Office arranging your visit");
  assert.equal(
    dispatchSummary(booking(), "staff").label,
    "Awaiting office dispatch",
  );
  assert.match(dispatchSummary(booking()).detail, /office/i);
  assert.equal(dispatchSummary({ status: "assigned", payment: "paid" }), null);
});
test("expired partner offers become office follow-up before any maintenance runs", () => {
  const b = booking({
    dispatch: { version: 1, state: "offering", revision: 1, expiresAt: 5000 },
  });
  assert.equal(
    dispatchSummary(b, "staff", 5000).label,
    "Partner offer expired",
  );
  assert.equal(
    dispatchSummary(b, "customer", 5000).label,
    "Office arranging your visit",
  );
  assert.equal(
    dispatchSummary(b, "staff", 4999).label,
    "Waiting for a partner",
  );
});
test("assignment, dispatch and arrival have distinct understandable customer states", () => {
  const b = booking({ status: "confirmed", professionalType: "In-house" });
  b.dispatch.state = "assigned";
  assert.equal(dispatchSummary(b).label, "Team assigned");
  b.dispatch.state = "dispatched";
  assert.equal(dispatchSummary(b).label, "Team dispatched");
  b.arrivedAt = 4000;
  assert.equal(dispatchSummary(b).label, "Team arrived");
});
test("terminal, unpaid and in-progress states take precedence over stale dispatch metadata", () => {
  for (const status of [
    "completed",
    "cancelled",
    "payment_expired",
    "in_progress",
    "payment_pending",
  ])
    assert.equal(dispatchSummary(booking({ status })), null);
  assert.equal(dispatchSummary(booking({ payment: "refunded" })), null);
});
test("countdowns never show negative or invalid time and expire at the server boundary", () => {
  assert.equal(offerSecondsRemaining(2001, 1000), 2);
  assert.equal(offerSecondsRemaining(2000, 1000), 1);
  assert.equal(offerSecondsRemaining(1000, 1000), 0);
  assert.equal(offerSecondsRemaining(999, 1000), 0);
  assert.equal(offerSecondsRemaining(NaN, 1000), 0);
});
test("only office staff can operate paid internal jobs, not partners, refunds or legacy assignments", () => {
  const b = booking({ status: "confirmed", professionalType: "In-house" });
  for (const role of ["owner", "care"])
    assert.equal(canOperateInternalBooking(b, role), true);
  for (const role of ["customer", "professional"])
    assert.equal(canOperateInternalBooking(b, role), false);
  assert.equal(
    canOperateInternalBooking({ ...b, professionalType: "Partner" }, "owner"),
    false,
  );
  assert.equal(
    canOperateInternalBooking({ ...b, payment: "pending" }, "care"),
    false,
  );
  assert.equal(
    canOperateInternalBooking({ ...b, refund: "requested" }, "owner"),
    false,
  );
  assert.equal(
    canOperateInternalBooking({ ...b, dispatch: undefined }, "owner"),
    false,
  );
  assert.equal(
    canOperateInternalBooking({ ...b, status: "completed" }, "care"),
    false,
  );
});

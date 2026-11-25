import test from "node:test";
import assert from "node:assert/strict";
import {
  orderNextAction,
  staffNavigationGroups,
} from "../src/lib/admin-workflow.ts";
test("next action never dispatches unpaid or refunded orders", () => {
  assert.equal(
    orderNextAction({
      status: "awaiting_assignment",
      payment: "pending",
      refund: "none",
    }),
    "Await payment",
  );
  assert.equal(
    orderNextAction({
      status: "confirmed",
      payment: "paid",
      refund: "requested",
    }),
    "Review refund",
  );
  assert.equal(
    orderNextAction({
      status: "awaiting_assignment",
      payment: "paid",
      refund: "none",
    }),
    "Assign a worker",
  );
  assert.equal(
    orderNextAction({ status: "completed", payment: "paid", refund: "none" }),
    "View completed visit",
  );
});
test("grouped navigation preserves role and platform boundaries", () => {
  const keys = (role, platform) =>
    staffNavigationGroups(role, platform).flatMap((g) =>
      g.items.map((x) => x[0]),
    );
  assert.ok(keys("owner", "web").includes("automations"));
  assert.ok(!keys("care", "web").includes("automations"));
  assert.ok(!keys("owner", "ios").includes("settings"));
  assert.deepEqual(keys("customer", "web"), []);
  assert.equal(new Set(keys("owner", "web")).size, keys("owner", "web").length);
});

test("banner schedule uses inclusive India dates and checks service publication", async () => {
  const { bannerScheduleStatus } = await import("../src/lib/admin-workflow.ts");
  const b = { active: true, startsOn: "2026-11-25", endsOn: "2026-11-26" };
  assert.equal(bannerScheduleStatus(b, true, "2026-11-24"), "Scheduled");
  assert.equal(bannerScheduleStatus(b, true, "2026-11-26"), "Showing now");
  assert.equal(bannerScheduleStatus(b, true, "2026-11-27"), "Ended");
  assert.equal(
    bannerScheduleStatus(b, false, "2026-11-25"),
    "Service unavailable",
  );
  assert.equal(
    bannerScheduleStatus({ ...b, active: false }, true, "2026-11-25"),
    "Disabled",
  );
});

test("next actions distinguish expired payments, completed refunds, partner visits and team arrival", () => {
  const base = {
    payment: "paid",
    status: "confirmed",
    professionalType: "In-house",
    dispatch: { version: 1, state: "dispatched" },
  };
  assert.equal(
    orderNextAction({ ...base, arrivedAt: 1 }),
    "Start internal service",
  );
  assert.equal(
    orderNextAction({ ...base, professionalType: "Partner" }),
    "Track professional arrival",
  );
  assert.equal(
    orderNextAction({ ...base, status: "payment_expired", payment: "pending" }),
    "View expired reservation",
  );
  assert.equal(
    orderNextAction({ ...base, refund: "refunded" }),
    "View refund receipt",
  );
});

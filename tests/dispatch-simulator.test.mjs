import test from "node:test";
import assert from "node:assert/strict";
import { simulateDispatch } from "../server/lib/dispatch-simulator.mjs";
test("isolated simulator uses actual dispatch for internal, outside and expiry scenarios", async () => {
  const internal = await simulateDispatch({ scenario: "internal" });
  assert.equal(internal.simulation, true);
  assert.equal(internal.state, "assigned");
  assert.equal(internal.offers.length, 0);
  const outside = await simulateDispatch({ scenario: "external" });
  assert.equal(outside.state, "claimed");
  assert.ok(outside.offers.some((o) => o.status === "accepted"));
  assert.equal(outside.realNotificationsSent, 0);
  const expired = await simulateDispatch({ scenario: "timeout" });
  assert.equal(expired.state, "attention");
  assert.equal(expired.reason, "NO_PARTNER_ACCEPTED");
  assert.equal(expired.round, 2);
  assert.equal(expired.offers.length, 10);
  const race = await simulateDispatch({ scenario: "race" });
  assert.equal(race.acceptedCount, 1);
});
test("simulator reports no capacity and notification failure honestly", async () => {
  const busy = await simulateDispatch({ scenario: "busy" });
  assert.equal(busy.reason, "NO_ELIGIBLE_PARTNERS");
  const failure = await simulateDispatch({ scenario: "notification_failure" });
  assert.equal(failure.state, "offering");
  assert.equal(failure.delivery, "failed_simulated");
  assert.equal(failure.realNotificationsSent, 0);
});

test("simulated push failure exercises retry logic without making a network request", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    throw Error("Simulator escaped its transport");
  };
  try {
    const result = await simulateDispatch({ scenario: "notification_failure" });
    assert.equal(calls, 0);
    assert.ok(result.pushAttempts > 0);
    assert.equal(result.retryQueued, true);
  } finally {
    globalThis.fetch = original;
  }
});

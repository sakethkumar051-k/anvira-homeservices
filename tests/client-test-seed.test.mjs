import { test } from "node:test";
import assert from "node:assert/strict";
import { buildClientTestSeed, matchesSeedArchive } from "../server/lib/client-test-seed.mjs";
const accounts = ["customer", "professional"].flatMap((role) => Array.from({ length: 10 }, (_, i) => ({
  id: `${role}-${i}`, role, name: "SAMPLE " + role + i, email: `${role}${i}@review.anvira.test`, password: "must-not-persist",
})));
const company = { commissionBps: 2000 };
test("reset comparison ignores only the preserved heartbeat clock and still detects business changes", () => {
  assert.equal(matchesSeedArchive("settings/workerHeartbeat", { id: "workerHeartbeat", at: 2 }, { id: "workerHeartbeat", at: 1 }), true);
  assert.equal(matchesSeedArchive("settings/company", { id: "company", at: 2 }, { id: "company", at: 1 }), false);
  assert.equal(matchesSeedArchive("users/staff", { id: "staff", role: "care" }, { id: "staff", role: "owner" }), false);
  assert.equal(matchesSeedArchive("settings/workerHeartbeat", { id: "workerHeartbeat", at: 2, unexpected: true }, { id: "workerHeartbeat", at: 1 }), false);
  assert.equal(matchesSeedArchive("bookings/new", { id: "new" }, undefined), false);
});
test("test seed has 20 login profiles, accountless workers and no staff credentials or provider jobs", () => {
  const result = buildClientTestSeed({ accounts, company, batch: "fixture", now: Date.now() });
  const rows = (kind) => result.records.filter((r) => r.kind === kind).map((r) => r.value);
  assert.equal(rows("users").length, 20);
  assert.equal(rows("professionals").filter((p) => p.accountless).length, 5);
  assert.equal(rows("bookings").length, 40);
  assert.equal(rows("serviceQuotes").length, 10);
  assert.equal(rows("reviewWallets").length, 10);
  assert.ok(result.records.every((r) => r.value.reviewOnly && r.value.sample && r.value.seedBatch === "fixture"));
  assert.ok(rows("bookings").every((b) => b.paymentEnvironment === "test" && !b.paymentId && !b.orderId && !["processing", "requested"].includes(b.refund)));
  assert.ok(rows("users").every((u) => !["owner", "care"].includes(u.role) && !u.password));
  assert.equal(rows("jobs").length, 0);
  assert.equal(rows("outbox").length, 0);
  assert.equal(rows("payouts").length, 0);
  assert.equal(rows("wallets").length, 0);
  assert.equal(rows("ledger").length, 0);
  assert.ok(result.records.length + 45 < 500);
  assert.doesNotMatch(JSON.stringify(result), /must-not-persist/);
});
test("seed refuses missing or staff identities", () => {
  assert.throws(() => buildClientTestSeed({ accounts: accounts.slice(1), company }), /20 distinct/);
  assert.throws(() => buildClientTestSeed({ accounts: accounts.map((a, i) => i ? a : { ...a, role: "owner" }), company }), /staff identities/);
});

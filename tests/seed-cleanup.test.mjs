import test from "node:test";
import assert from "node:assert/strict";
import { planSeedCleanup } from "../scripts/clear-seeded-data.mjs";

const row = (kind, id, value = {}) => ({ kind, value: { id, ...value } });
test("cleanup removes proven seed history and its dependants while preserving real bookings, settings, staff and catalog", () => {
  const records = [
    row("bookings", "seed", {
      sample: true,
      reviewOnly: true,
      seededHistory: true,
    }),
    row("bookings", "real", {
      paymentEnvironment: "test",
      customerId: "real-user",
    }),
    row("bookings", "provider", {
      sample: true,
      reviewOnly: true,
      paymentId: "pay_real",
    }),
    row("notifications", "linked", { bookingId: "seed" }),
    row("notifications", "real-linked", { bookingId: "real" }),
    row("users", "owner", { role: "owner", sample: true }),
    row("settings", "company", { sample: true }),
    row("services", "cleaning", { sample: true }),
    row("users", "real-user", { role: "customer" }),
    row("users", "marked", {
      role: "customer",
      sample: true,
      reviewOnly: true,
    }),
  ];
  const plan = planSeedCleanup(records);
  assert.deepEqual(plan.remove.map((r) => r.kind + "/" + r.value.id).sort(), [
    "bookings/seed",
    "notifications/linked",
    "users/marked",
  ]);
  assert.ok(plan.keep.some((r) => r.value.id === "provider"));
});
test("a review-looking name or ID does not establish cloud provenance and mixed accounts stay", () => {
  const records = [
    row("users", "review-customer-1", { role: "customer", name: "SAMPLE" }),
    row("users", "marked", {
      role: "customer",
      sample: true,
      reviewOnly: true,
    }),
    row("bookings", "runtime", {
      customerId: "marked",
      idempotencyKey: "booking-123",
    }),
  ];
  assert.equal(planSeedCleanup(records).remove.length, 0);
});
test("a marked child cannot remove history for a surviving provider-paid booking", () => {
  const records = [
    row("bookings", "provider", { sample: true, paymentId: "pay_actual" }),
    row("messages", "child", {
      sample: true,
      reviewOnly: true,
      bookingId: "provider",
    }),
    row("ledger", "money", {
      sample: true,
      bookingId: "provider",
      amount: 500,
    }),
  ];
  assert.equal(planSeedCleanup(records).remove.length, 0);
});
test("review-only is a payment-environment marker, so it never establishes seed provenance by itself", () => {
  const records = [
    row("bookings", "runtime-test", {
      reviewOnly: true,
      paymentEnvironment: "test",
      idempotencyKey: "booking-123",
    }),
    row("reviewLedger", "runtime-money", {
      reviewOnly: true,
      bookingId: "runtime-test",
      amount: 500,
    }),
    row("users", "real-reviewer", { role: "customer", reviewOnly: true }),
  ];
  assert.equal(planSeedCleanup(records).remove.length, 0);
});
test("local cleanup recognizes shipped seed booking keys but preserves manually created demo history and its account", () => {
  const records = [
    row("bookings", "seed", {
      customerId: "customer-1",
      idempotencyKey: "reviewDashboardV6-0",
      paymentId: "demo_payment_seed",
    }),
    row("bookings", "runtime", {
      customerId: "customer-1",
      idempotencyKey: "booking-123",
      paymentId: "demo_payment_runtime",
    }),
    row("users", "customer-1", { role: "customer" }),
    row("ledger", "seed-ledger", {
      bookingId: "seed",
      professionalId: "pro-1",
      amount: 500,
    }),
    row("ledger", "real-ledger", {
      bookingId: "runtime",
      professionalId: "pro-1",
      amount: 120,
    }),
    row("wallets", "pro-1", { available: 620, held: 0, paid: 0 }),
    row("users", "pro-1", { role: "professional" }),
    row("professionals", "pro-1", { name: "Ravi Kumar" }),
  ];
  const plan = planSeedCleanup(records, { localDemo: true });
  assert.deepEqual(plan.remove.map((r) => r.value.id).sort(), [
    "seed",
    "seed-ledger",
  ]);
  assert.deepEqual(plan.update, [
    row("wallets", "pro-1", { available: 120, held: 0, paid: 0 }),
  ]);
  assert.ok(plan.keep.some((r) => r.value.id === "runtime"));
  assert.ok(
    plan.keep.some((r) => r.kind === "users" && r.value.id === "customer-1"),
  );
});
test("local seed bank-verification and profile are removed together, but edited real profiles are preserved", () => {
  const records = [
    row("users", "review-pro-1", {
      name: "Naveen Kumar (sample)",
      role: "professional",
    }),
    row("professionals", "review-pro-1", { name: "Naveen Kumar (sample)" }),
    row("bankVerifications", "bank", {
      professionalId: "review-pro-1",
      gatewayId: "demo_fav_bank",
      fundAccountId: "demo_fund_review-pro-1",
    }),
    row("users", "customer-1", {
      role: "customer",
      name: "Actual client",
      email: "client@example.com",
    }),
  ];
  assert.deepEqual(
    planSeedCleanup(records, { localDemo: true })
      .remove.map((r) => r.value.id)
      .sort(),
    ["bank", "review-pro-1", "review-pro-1"],
  );
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { createSQLiteStore } from "../server/lib/store.mjs";
import { config } from "../server/lib/config.mjs";
import { createGateway } from "../server/lib/gateway.mjs";
import { domain } from "../server/lib/domain.mjs";
import {
  payoutOperations,
  defaultPayoutSchedule,
  payoutWindow,
} from "../server/lib/payouts.mjs";
import { workers } from "../server/lib/workers.mjs";
const now = Date.parse("2026-10-07T13:00:00Z");
async function fixture() {
  const store = await createSQLiteStore(":memory:"),
    cfg = config({ APP_MODE: "demo" }),
    business = domain(store, cfg),
    gateway = createGateway(cfg);
  const finance = payoutOperations(store, business, gateway, cfg);
  await store.transaction(async (tx) => {
    tx.put("users", { id: "partner", role: "professional", active: true });
    tx.put("professionals", {
      id: "partner",
      name: "Sample Partner",
      type: "Partner",
      approved: true,
    });
    tx.put("wallets", { id: "partner", available: 2500, held: 0, paid: 0 });
  });
  return {
    store,
    cfg,
    business,
    gateway,
    finance,
    user: { id: "partner", role: "professional" },
    close: () => store.close(),
  };
}
const details = {
  name: "Sample Partner",
  accountNumber: "123456789012",
  ifsc: "SBIN0001234",
};
async function verified(f) {
  await f.finance.saveBank(f.user, details);
  return f.finance.verifyBank(f.user);
}
test("daily and weekly payout windows use IST, including the hour before a weekly cutoff", () => {
  assert.equal(
    new Date(
      payoutWindow({ ...defaultPayoutSchedule, frequency: "daily" }, now).due,
    ).toISOString(),
    "2026-10-07T12:30:00.000Z",
  );
  assert.equal(
    new Date(
      payoutWindow(
        { ...defaultPayoutSchedule, frequency: "weekly", weekday: 3 },
        Date.parse("2026-10-07T12:00Z"),
      ).due,
    ).toISOString(),
    "2026-09-30T12:30:00.000Z",
  );
});
test("bank verification uses a masked business record and repeated verification never sends a second rupee", async () => {
  const f = await fixture();
  try {
    let calls = 0;
    const original = f.gateway.validateBank;
    f.gateway.validateBank = async (...args) => {
      calls++;
      return original(...args);
    };
    assert.equal((await verified(f)).status, "verified");
    assert.equal((await f.finance.verifyBank(f.user)).status, "verified");
    assert.equal(calls, 1);
    const profile = await f.store.get("professionals", f.user.id);
    assert.equal(profile.bankLast4, "9012");
    assert.equal(profile.accountNumber, undefined);
    assert.equal(
      JSON.stringify(await f.store.list("bankVerifications")).includes(
        details.accountNumber,
      ),
      false,
    );
  } finally {
    f.close();
  }
});
test("scheduled cycles reserve exactly once under concurrency, respect the reserve, and settle once", async () => {
  const f = await fixture();
  try {
    await verified(f);
    await f.store.transaction(async (tx) =>
      tx.put("settings", {
        id: "payoutSchedule",
        ...defaultPayoutSchedule,
        frequency: "daily",
        maximum: 1000,
        reserve: 300,
        approvalRequired: false,
        enabledAt: now - 86400000,
        updatedAt: 1,
      }),
    );
    const results = await Promise.all(
      Array.from({ length: 5 }, () => f.finance.scheduled(now)),
    );
    assert.equal(
      results.reduce((sum, result) => sum + result.queued, 0),
      1,
    );
    assert.equal((await f.store.list("payouts")).length, 1);
    assert.deepEqual(await f.store.get("wallets", "partner"), {
      id: "partner",
      available: 1500,
      held: 1000,
      paid: 0,
    });
    const job = workers(f.store, f.business, f.gateway, f.cfg, {}, f.finance);
    // Advance these queued jobs to the worker clock used by the test process.
    await f.store.transaction(async (tx) => {
      for (const pending of await tx.list("jobs")) tx.put("jobs", {...pending, dueAt: 0});
    });
    await job.financialJobs();
    await job.financialJobs();
    assert.deepEqual(await f.store.get("wallets", "partner"), {
      id: "partner",
      available: 1500,
      held: 0,
      paid: 1000,
    });
  } finally {
    f.close();
  }
});
test("unverified, disabled and cooling-period accounts never qualify for automatic payouts", async () => {
  const f = await fixture();
  try {
    await f.finance.saveBank(f.user, details);
    await f.store.transaction(async (tx) =>
      tx.put("settings", {
        id: "payoutSchedule",
        ...defaultPayoutSchedule,
        frequency: "daily",
        enabledAt: now - 86400000,
        updatedAt: 1,
      }),
    );
    assert.equal((await f.finance.scheduled(now, true)).queued, 0);
    await f.finance.verifyBank(f.user);
    await f.store.transaction(async (tx) => {
      const p = await tx.get("professionals", "partner");
      tx.put("professionals", { ...p, bankEligibleAt: now + 3600000 });
    });
    assert.equal((await f.finance.scheduled(now, true)).queued, 0);
    await f.store.transaction(async (tx) => {
      const p = await tx.get("professionals", "partner");
      tx.put("professionals", { ...p, bankEligibleAt: 0 });
      tx.put("users", { id: "partner", role: "professional", active: false });
    });
    assert.equal((await f.finance.scheduled(now, true)).queued, 0);
    assert.equal((await f.store.get("wallets", "partner")).available, 2500);
  } finally {
    f.close();
  }
});
test("bank holder name mismatch needs Owner review and cannot masquerade as verified", async () => {
  const f = await fixture();
  try {
    await f.finance.saveBank(f.user, details);
    const original = f.gateway.validateBank;
    f.gateway.validateBank = async (...args) => {
      const result = await original(...args);
      result.results.registered_name = "Another Holder";
      return result;
    };
    assert.equal((await f.finance.verifyBank(f.user)).status, "needs_review");
    assert.equal((await f.finance.preview()).total, 0);
  } finally {
    f.close();
  }
});
test("uncertain validation outcomes cannot be automatically retried or replaced with another bank", async () => {
  const f = await fixture();
  try {
    await f.finance.saveBank(f.user, details);
    let calls = 0;
    f.gateway.validateBank = async () => {
      calls++;
      throw Object.assign(Error("Timeout"), { code: "GATEWAY_UNAVAILABLE" });
    };
    await assert.rejects(f.finance.verifyBank(f.user));
    await assert.rejects(f.finance.verifyBank(f.user), /existing verification/);
    await assert.rejects(
      f.finance.saveBank(f.user, { ...details, accountNumber: "999456789012" }),
      /reconcile pending/,
    );
    assert.equal(calls, 1);
    assert.equal(
      (await f.store.get("professionals", "partner")).bankVerification,
      "unknown",
    );
  } finally {
    f.close();
  }
});
test("held earnings block bank replacement and payout schedules start paused", async () => {
  const f = await fixture();
  try {
    assert.equal((await f.finance.settings()).frequency, "paused");
    assert.equal((await f.finance.scheduled(now)).queued, 0);
    await verified(f);
    await f.store.transaction(async (tx) =>
      tx.put("wallets", {
        id: "partner",
        available: 1500,
        held: 1000,
        paid: 0,
      }),
    );
    await assert.rejects(
      f.finance.saveBank(f.user, details),
      /pending payouts/,
    );
  } finally {
    f.close();
  }
});

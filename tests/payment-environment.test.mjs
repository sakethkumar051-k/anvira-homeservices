import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createSQLiteStore } from "../server/lib/store.mjs";
import { seedDemo, demoUsers } from "../server/lib/seed.mjs";
import { domain, slotFor } from "../server/lib/domain.mjs";
import { payoutOperations } from "../server/lib/payouts.mjs";
import { workers } from "../server/lib/workers.mjs";

async function fixture(environment = "test", reviewOnly = false) {
  const store = await createSQLiteStore(":memory:");
  await seedDemo(store);
  await store.transaction(async (tx) => {
    const company = await tx.get("settings", "company");
    tx.put("settings", { ...company, policyEnvironment: "production" });
    const service = await tx.get("services", "cleaning");
    tx.put("services", {
      ...service,
      price: 1000,
      packages: [],
      optionGroups: [],
      bookingFields: [],
      sample: false,
      reviewOnly,
    });
    const inhouse = await tx.get("professionals", "pro-1");
    tx.put("professionals", { ...inhouse, available: false });
  });
  const cfg = {
    live: environment !== "simulated",
    paymentMode: environment === "simulated" ? "demo" : "razorpay",
    paymentEnvironment: environment === "simulated" ? "test" : environment,
  };
  const business = domain(store, cfg);
  const create = () =>
    business.createBooking(demoUsers.customer, {
      serviceId: "cleaning",
      address: { line: "SAMPLE address for tests", pin: "509216" },
      slot: slotFor(
        new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10),
        12,
      ),
      idempotencyKey: randomUUID(),
    });
  const complete = async (b) => {
    await store.transaction(async (tx) =>
      tx.put("bookings", { ...b, orderId: "order_" + b.id }),
    );
    b = await business.paymentCaptured(
      {
        order_id: "order_" + b.id,
        id: "pay_" + b.id.replaceAll("-", ""),
        amount: 100000,
        currency: "INR",
        status: "captured",
      },
      randomUUID(),
    );
    await store.transaction(async (tx) =>
      tx.put("bookings", { ...b, slot: Date.now() - 60000 }),
    );
    const user = { id: b.professionalId, role: "professional" };
    for (const action of ["accept", "start", "complete"])
      b = await business.action(user, b.id, {
        action,
        checklist: Array(3 + b.serviceChecklist.length).fill(true),
      });
    return b;
  };
  return { store, cfg, business, create, complete };
}

for (const environment of ["simulated", "test", "live"])
  test(`new ${environment} bookings snapshot their money environment`, async () => {
    const f = await fixture(environment);
    try {
      const b = await f.create();
      assert.equal(b.paymentEnvironment, environment);
      assert.equal(b.reviewOnly, environment === "test");
    } finally {
      f.store.close();
    }
  });

for (const [environment, reviewOnly, walletKind, ledgerKind] of [
  ["test", false, "reviewWallets", "reviewLedger"],
  ["simulated", true, "reviewWallets", "reviewLedger"],
  ["simulated", false, "wallets", "ledger"],
  ["live", false, "wallets", "ledger"],
])
  test(`${environment} ${reviewOnly ? "review" : "ordinary"} completion credits only its own money collections`, async () => {
    const f = await fixture(environment, reviewOnly);
    try {
      const b = await f.complete(await f.create());
      const ledger = await f.store.get(ledgerKind, "job_" + b.id);
      assert.equal(ledger.amount, 800);
      assert.equal(ledger.gross, 1000);
      assert.equal(ledger.commission, 200);
      assert.equal((await f.store.get(walletKind, "pro-2")).available, 800);
      assert.equal(
        await f.store.get(
          walletKind === "wallets" ? "reviewWallets" : "wallets",
          "pro-2",
        ),
        null,
      );
      assert.equal(
        (
          await f.store.list(
            ledgerKind === "ledger" ? "reviewLedger" : "ledger",
          )
        ).length,
        0,
      );
    } finally {
      f.store.close();
    }
  });

test("live payout preview cannot spend a completed sandbox booking's net earnings", async () => {
  const f = await fixture();
  try {
    await f.complete(await f.create());
    await f.store.transaction(async (tx) => {
      const p = await tx.get("professionals", "pro-2");
      tx.put("professionals", {
        ...p,
        fundAccountId: "fa_example",
        bankVerification: "verified",
        bankEligibleAt: 0,
      });
    });
    const finance = payoutOperations(
      f.store,
      f.business,
      {},
      {
        ...f.cfg,
        paymentEnvironment: "live",
        payoutsEnabled: true,
        payoutAccount: "example",
        razorpayKeyId: "rzp_live_example",
        razorpayKeySecret: "example",
        payoutWebhookSecret: "example",
      },
    );
    const row = (await finance.preview()).rows.find((p) => p.id === "pro-2");
    assert.equal(row.amount, 0);
    assert.equal(row.available, 0);
    assert.equal((await f.store.get("reviewWallets", "pro-2")).available, 800);
  } finally {
    f.store.close();
  }
});

for (const [id, reviewOnly] of [
  ["pro-2", true],
  ["review-professional", false],
])
  test(`payout eligibility rejects fictional profile ${id} even with a verified bank`, async () => {
    const f = await fixture();
    try {
      await f.store.transaction(async (tx) => {
        const p = await tx.get("professionals", "pro-2");
        tx.put("professionals", {
          ...p,
          id,
          reviewOnly,
          fundAccountId: "fa_example",
          bankVerification: "verified",
        });
        tx.put("wallets", { id, available: 1000, held: 0, paid: 0 });
      });
      const row = (
        await payoutOperations(f.store, f.business, {}, f.cfg).preview()
      ).rows.find((p) => p.id === id);
      assert.equal(row.amount, 0);
      assert.match(row.reason, /review|fictional/i);
    } finally {
      f.store.close();
    }
  });

for (const [origin, current] of [
  ["test", "live"],
  ["live", "test"],
  ["simulated", "live"],
])
  test(`${origin} booking capture and assignment reject ${current} credentials without mutation`, async () => {
    const f = await fixture(origin);
    try {
      const b = await f.create();
      await f.store.transaction(async (tx) =>
        tx.put("bookings", { ...b, orderId: "order_cross_environment" }),
      );
      const other = domain(f.store, {
        ...f.cfg,
        live: true,
        paymentMode: "razorpay",
        paymentEnvironment: current,
      });
      const code =
        origin === "test" && current === "live"
          ? "REVIEW_ONLY"
          : "PAYMENT_ENVIRONMENT_MISMATCH";
      await assert.rejects(
        other.paymentCaptured(
          {
            order_id: "order_cross_environment",
            id: "pay_example",
            amount: 100000,
            currency: "INR",
            status: "captured",
          },
          "cross-environment-event",
        ),
        { code },
      );
      await assert.rejects(
        f.store.transaction(async (tx) =>
          other.assign(tx, await tx.get("bookings", b.id)),
        ),
        { code },
      );
      assert.equal((await f.store.get("bookings", b.id)).payment, "pending");
      assert.equal(
        await f.store.get("events", "cross-environment-event"),
        null,
      );
    } finally {
      f.store.close();
    }
  });

for (const [origin, current, reviewOnly] of [
  ["test", "live", false],
  ["live", "test", false],
  [undefined, "live", true],
])
  test(`refund worker quarantines ${origin || "legacy review"} money under ${current} credentials`, async () => {
    const f = await fixture();
    try {
      await f.store.transaction(async (tx) => {
        tx.put("bookings", {
          id: "refund-booking",
          paymentEnvironment: origin,
          reviewOnly,
          payment: "paid",
          paymentId: "pay_example",
          total: 1000,
          refund: "processing",
        });
        tx.put("jobs", {
          id: "refund-job",
          type: "refund",
          bookingId: "refund-booking",
          status: "pending",
          attempts: 0,
          dueAt: 0,
        });
      });
      let calls = 0;
      const gateway = {
        refund: async () => {
          calls++;
          return { id: "rfnd_example", status: "processed" };
        },
      };
      await workers(f.store, f.business, gateway, {
        ...f.cfg,
        paymentEnvironment: current,
      }).financialJobs();
      assert.equal(calls, 0);
      const job = await f.store.get("jobs", "refund-job");
      assert.equal(job.status, "needs_reconciliation");
      assert.equal(
        job.errorCode,
        current === "live" ? "REVIEW_ONLY" : "PAYMENT_ENVIRONMENT_MISMATCH",
      );
      assert.equal(
        (await f.store.get("bookings", "refund-booking")).payment,
        "paid",
      );
    } finally {
      f.store.close();
    }
  });

test("matching test environment refund is still processed normally", async () => {
  const f = await fixture();
  try {
    await f.store.transaction(async (tx) => {
      tx.put("bookings", {
        id: "test-refund",
        paymentEnvironment: "test",
        reviewOnly: true,
        customerId: "customer-1",
        payment: "paid",
        total: 1000,
        refund: "processing",
      });
      tx.put("jobs", {
        id: "test-refund-job",
        type: "refund",
        bookingId: "test-refund",
        status: "pending",
        attempts: 0,
        dueAt: 0,
      });
    });
    let calls = 0;
    await workers(
      f.store,
      f.business,
      {
        refund: async () => {
          calls++;
          return { id: "rfnd_test", status: "processed" };
        },
      },
      f.cfg,
    ).financialJobs();
    assert.equal(calls, 1);
    assert.equal((await f.store.get("jobs", "test-refund-job")).status, "done");
  } finally {
    f.store.close();
  }
});

test("refund reconciliation never queries a sandbox refund with live credentials", async () => {
  const f = await fixture();
  try {
    await f.store.transaction(async (tx) => {
      tx.put("bookings", {
        id: "reconcile-test",
        paymentEnvironment: "test",
        reviewOnly: true,
        payment: "paid",
        total: 1000,
        refund: "processing",
      });
      tx.put("jobs", {
        id: "reconcile-job",
        type: "refund",
        bookingId: "reconcile-test",
        status: "awaiting_webhook",
        gatewayId: "rfnd_test",
      });
    });
    let calls = 0;
    await workers(
      f.store,
      f.business,
      {
        refundStatus: async () => {
          calls++;
          return {};
        },
      },
      { ...f.cfg, paymentEnvironment: "live" },
    ).reconciliation();
    assert.equal(calls, 0);
    assert.equal(
      (await f.store.get("jobs", "reconcile-job")).status,
      "needs_reconciliation",
    );
  } finally {
    f.store.close();
  }
});

test("payout reconciliation never queries a simulated payout with live credentials", async () => {
  const f = await fixture();
  try {
    await f.store.transaction(async (tx) => {
      tx.put("payouts", {
        id: "reconcile-payout",
        professionalId: "pro-2",
        paymentEnvironment: "simulated",
        amount: 1000,
        status: "processing",
      });
      tx.put("jobs", {
        id: "reconcile-payout-job",
        type: "payout",
        payoutId: "reconcile-payout",
        status: "awaiting_webhook",
        gatewayId: "pout_example",
      });
    });
    let calls = 0;
    await workers(
      f.store,
      f.business,
      {
        payoutStatus: async () => {
          calls++;
          return {};
        },
      },
      { ...f.cfg, paymentEnvironment: "live" },
    ).reconciliation();
    assert.equal(calls, 0);
    assert.equal(
      (await f.store.get("jobs", "reconcile-payout-job")).status,
      "needs_reconciliation",
    );
  } finally {
    f.store.close();
  }
});

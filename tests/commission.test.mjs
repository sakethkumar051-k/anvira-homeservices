import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createSQLiteStore } from "../server/lib/store.mjs";
import { seedDemo, demoUsers } from "../server/lib/seed.mjs";
import { domain, slotFor } from "../server/lib/domain.mjs";
import { companySchema } from "../server/lib/schemas.mjs";
import * as model from "../src/lib/model.ts";

const tiers = [
  { minAmount: 0, commissionBps: 1000 },
  { minAmount: 1000, commissionBps: 1500 },
  { minAmount: 10000, commissionBps: 2000 },
  { minAmount: 20000, commissionBps: 2500 },
];
async function fixture(total = 1499, inhouse = false) {
  const store = await createSQLiteStore(":memory:");
  await seedDemo(store);
  await store.transaction(async (tx) => {
    const company = await tx.get("settings", "company");
    tx.put("settings", {
      ...company,
      commissionMode: "tiers",
      commissionTiers: tiers,
    });
    const service = await tx.get("services", "cleaning");
    tx.put("services", {
      ...service,
      price: total,
      packages: [],
      optionGroups: [],
      bookingFields: [],
    });
    const pro = await tx.get("professionals", "pro-1");
    tx.put("professionals", { ...pro, available: inhouse });
  });
  const business = domain(store, { live: false, paymentMode: "demo" });
  const create = () =>
    business.createBooking(demoUsers.customer, {
      serviceId: "cleaning",
      address: { line: "12 Garden Street, Shadnagar", pin: "509216" },
      slot: slotFor(
        new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10),
        12,
      ),
      idempotencyKey: randomUUID(),
    });
  const complete = async (booking) => {
    const assigned = await business.action(demoUsers.customer, booking.id, {
      action: "pay",
    });
    const professional = { id: assigned.professionalId, role: "professional" };
    for (const action of ["accept", "start", "complete"])
      await business.action(professional, booking.id, {
        action,
        checklist: Array(3 + booking.serviceChecklist.length).fill(true),
      });
    return store.get("bookings", booking.id);
  };
  return { store, business, create, complete };
}

for (const [total, rate, commission, net] of [
  [999, 1000, 100, 899],
  [1000, 1500, 150, 850],
  [9999, 1500, 1500, 8499],
  [10000, 2000, 2000, 8000],
  [19999, 2000, 4000, 15999],
  [20000, 2500, 5000, 15000],
])
  test(`completed ₹${total} partner booking uses its inclusive slab and whole-rupee net`, async () => {
    const f = await fixture(total);
    try {
      const booking = await f.create();
      const completed = await f.complete(booking);
      assert.equal(completed.commissionBps, rate);
      const ledger = await f.store.get("ledger", "job_" + booking.id);
      assert.equal(ledger.gross, total);
      assert.equal(ledger.commission, commission);
      assert.equal(ledger.amount, net);
      assert.equal((await f.store.get("wallets", "pro-2")).available, net);
    } finally {
      f.store.close();
    }
  });

test("checkout freezes the policy before payment; updates and reassignment preserve it", async () => {
  const f = await fixture(1000);
  try {
    const booking = await f.create();
    assert.equal(booking.commissionPolicy?.mode, "tiers");
    await f.store.transaction(async (tx) => {
      const company = await tx.get("settings", "company");
      tx.put("settings", {
        ...company,
        commissionTiers: [{ minAmount: 0, commissionBps: 4000 }],
      });
      const p = await tx.get("professionals", "pro-3");
      tx.put("professionals", { ...p, approved: true, skills: ["cleaning"] });
    });
    let assigned = await f.business.action(demoUsers.customer, booking.id, {
      action: "pay",
    });
    assert.equal(assigned.commissionBps, 1500);
    assigned = await f.business.action(
      { id: "pro-2", role: "professional" },
      booking.id,
      { action: "decline" },
    );
    assert.equal(assigned.professionalId, "pro-3");
    assert.equal(assigned.commissionBps, 1500);
    assert.deepEqual(assigned.commissionPolicy, booking.commissionPolicy);
    assert.equal(assigned.total, 1000);
    assert.equal(assigned.payment, "paid");
  } finally {
    f.store.close();
  }
});

test("discounted paid total selects the whole-booking slab", async () => {
  const f = await fixture(1000);
  try {
    await f.store.transaction(async (tx) =>
      tx.put("promotions", {
        id: "CUT",
        active: true,
        discountAmount: 1,
        minAmount: 0,
        maxUses: 10,
        uses: 0,
        expiresAt: Date.now() + 86400000,
      }),
    );
    const booking = await f.business.createBooking(demoUsers.customer, {
      serviceId: "cleaning",
      promoCode: "CUT",
      address: { line: "12 Garden Street, Shadnagar", pin: "509216" },
      slot: slotFor(
        new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10),
        12,
      ),
      idempotencyKey: randomUUID(),
    });
    const completed = await f.complete(booking);
    assert.equal(completed.total, 999);
    assert.equal(completed.commissionBps, 1000);
    assert.equal(
      (await f.store.get("ledger", "job_" + booking.id)).amount,
      899,
    );
  } finally {
    f.store.close();
  }
});

test("in-house work has zero commission and no partner wallet or ledger credit", async () => {
  const f = await fixture(20000, true);
  try {
    const completed = await f.complete(await f.create());
    assert.equal(completed.professionalType, "In-house");
    assert.equal(completed.commissionBps, 0);
    assert.equal((await f.store.list("ledger")).length, 0);
    assert.equal(await f.store.get("wallets", "pro-1"), null);
  } finally {
    f.store.close();
  }
});

test("new flat bookings freeze the flat rate before payment", async () => {
  const f = await fixture(1000);
  try {
    await f.store.transaction(async (tx) => {
      const company = await tx.get("settings", "company");
      tx.put("settings", {
        ...company,
        commissionMode: "flat",
        commissionBps: 1200,
      });
    });
    const booking = await f.create();
    await f.store.transaction(async (tx) => {
      const company = await tx.get("settings", "company");
      tx.put("settings", { ...company, commissionBps: 4000 });
    });
    assert.equal((await f.complete(booking)).commissionBps, 1200);
    assert.equal(
      (await f.store.get("ledger", "job_" + booking.id)).amount,
      880,
    );
  } finally {
    f.store.close();
  }
});

test("legacy bookings without a policy retain their existing flat rate", async () => {
  const f = await fixture(1000);
  try {
    const booking = await f.create();
    await f.store.transaction(async (tx) => {
      const old = await tx.get("bookings", booking.id);
      delete old.commissionPolicy;
      tx.put("bookings", { ...old, commissionBps: 1800 });
    });
    assert.equal((await f.complete(booking)).commissionBps, 1800);
    assert.equal(
      (await f.store.get("ledger", "job_" + booking.id)).amount,
      820,
    );
  } finally {
    f.store.close();
  }
});

const validCompany = {
  name: "ANVIRA",
  pins: ["509216"],
  commissionBps: 2000,
  cancelCutoffHours: 2,
  assignmentDeadlineMinutes: 30,
  termsVersion: "v1",
  termsUrl: "https://anvira.test/terms",
  privacyUrl: "https://anvira.test/privacy",
  supportPhone: "+919876543210",
  policyPublished: true,
};
test("company schema accepts legacy flat writes and preserves valid Owner slab configuration", () => {
  assert.equal(companySchema.safeParse(validCompany).success, true);
  const parsed = companySchema.parse({
    ...validCompany,
    commissionMode: "tiers",
    commissionTiers: tiers,
  });
  assert.equal(parsed.commissionMode, "tiers");
  assert.deepEqual(parsed.commissionTiers, tiers);
});
for (const [label, commissionTiers] of [
  ["missing", undefined],
  ["empty", []],
  ["nonzero first boundary", [{ minAmount: 1, commissionBps: 1000 }]],
  [
    "repeated boundaries",
    [
      { minAmount: 0, commissionBps: 1000 },
      { minAmount: 0, commissionBps: 2000 },
    ],
  ],
  [
    "descending boundaries",
    [
      { minAmount: 0, commissionBps: 1000 },
      { minAmount: 2000, commissionBps: 1500 },
      { minAmount: 1000, commissionBps: 2000 },
    ],
  ],
  [
    "fractional boundary",
    [
      { minAmount: 0, commissionBps: 1000 },
      { minAmount: 1000.5, commissionBps: 1500 },
    ],
  ],
  [
    "oversized boundary",
    [
      { minAmount: 0, commissionBps: 1000 },
      { minAmount: 100001, commissionBps: 1500 },
    ],
  ],
  ["negative rate", [{ minAmount: 0, commissionBps: -1 }]],
  ["oversized rate", [{ minAmount: 0, commissionBps: 5001 }]],
  ["fractional rate", [{ minAmount: 0, commissionBps: 1000.5 }]],
  ["string rate", [{ minAmount: 0, commissionBps: "1000" }]],
  [
    "too many slabs",
    Array.from({ length: 11 }, (_, i) => ({
      minAmount: i * 1000,
      commissionBps: 1000,
    })),
  ],
])
  test(`Owner slab validation rejects ${label}`, () => {
    assert.equal(
      companySchema.safeParse({
        ...validCompany,
        commissionMode: "tiers",
        commissionTiers,
      }).success,
      false,
    );
  });

test("Owner string fields parse exact hundredths of a percent without losing edits", () => {
  assert.deepEqual(
    model.parseCommissionForm({
      mode: "tiers",
      flatPercent: "20",
      tiers: [
        { minAmount: "0", percent: "10.25" },
        { minAmount: "1000", percent: "15" },
      ],
    }),
    {
      commissionMode: "tiers",
      commissionTiers: [
        { minAmount: 0, commissionBps: 1025 },
        { minAmount: 1000, commissionBps: 1500 },
      ],
    },
  );
});
test("switching to slabs does not validate the hidden inactive flat input", () => {
  assert.deepEqual(
    model.parseCommissionForm({
      mode: "tiers",
      flatPercent: "",
      tiers: [{ minAmount: "0", percent: "15" }],
    }),
    {
      commissionMode: "tiers",
      commissionTiers: [{ minAmount: 0, commissionBps: 1500 }],
    },
  );
});
for (const percent of ["", " ", "1e1", "-1", "50.01", "10.255", "abc"])
  test(`Owner string fields reject malformed percentage ${JSON.stringify(percent)}`, () => {
    assert.throws(
      () =>
        model.parseCommissionForm({
          mode: "flat",
          flatPercent: percent,
          tiers: [],
        }),
      /percentage/i,
    );
  });
for (const minAmount of ["", "1e3", "0.5", "-1", "100001"])
  test(`Owner string fields reject malformed boundary ${JSON.stringify(minAmount)}`, () => {
    assert.throws(
      () =>
        model.parseCommissionForm({
          mode: "tiers",
          flatPercent: "20",
          tiers: [
            { minAmount: "0", percent: "10" },
            { minAmount, percent: "15" },
          ],
        }),
      /slab/i,
    );
  });
test("Owner string form rejects repeated boundaries before submitting", () => {
  assert.throws(
    () =>
      model.parseCommissionForm({
        mode: "tiers",
        flatPercent: "20",
        tiers: [
          { minAmount: "0", percent: "10" },
          { minAmount: "0", percent: "15" },
        ],
      }),
    /increasing/i,
  );
});

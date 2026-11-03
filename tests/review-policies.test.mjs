import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createSQLiteStore } from "../server/lib/store.mjs";
import { seedDemo, demoUsers } from "../server/lib/seed.mjs";
import { domain, slotFor } from "../server/lib/domain.mjs";
import { companySchema } from "../server/lib/schemas.mjs";

const company = {
  name: "ANVIRA",
  pins: ["509216"],
  commissionBps: 2000,
  cancelCutoffHours: 2,
  assignmentDeadlineMinutes: 30,
  termsVersion: "review-only-v1",
  termsUrl: "https://review.example/review-terms",
  privacyUrl: "https://review.example/review-privacy",
  supportPhone: "",
  policyPublished: true,
  policyEnvironment: "test",
};
test("review policies may omit a phone; production and legacy policies require a valid phone", () => {
  assert.equal(companySchema.safeParse(company).success, true);
  for (const policyEnvironment of [undefined, "production", "invalid"])
    assert.equal(
      companySchema.safeParse({ ...company, policyEnvironment }).success,
      false,
    );
  assert.equal(
    companySchema.safeParse({
      ...company,
      policyEnvironment: "production",
      supportPhone: "+919876543210",
    }).success,
    true,
  );
});
async function fixture({
  paymentEnvironment = "test",
  policyEnvironment = "test",
  policyPublished = true,
  reviewService = false,
  reviewPro = false,
} = {}) {
  const store = await createSQLiteStore(":memory:");
  await seedDemo(store);
  await store.transaction(async (tx) => {
    tx.put("settings", {
      ...company,
      id: "company",
      policyEnvironment,
      policyPublished,
    });
    const service = await tx.get("services", "cleaning");
    tx.put("services", {
      ...service,
      sampleReviewed: true,
      reviewOnly: reviewService,
      optionGroups: [],
      bookingFields: [],
      packages: [],
    });
    for (const p of await tx.list("professionals"))
      tx.put("professionals", { ...p, reviewOnly: reviewPro });
  });
  const business = domain(store, {
    live: true,
    paymentMode: "razorpay",
    paymentEnvironment,
  });
  const date = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
  const input = {
    serviceId: "cleaning",
    address: { line: "SAMPLE review address", pin: "509216" },
    slot: slotFor(date, 12),
    idempotencyKey: randomUUID(),
  };
  return {
    store,
    business,
    input,
    date,
    create: () => business.createBooking(demoUsers.customer, input),
  };
}
for (const paymentEnvironment of ["test", "live"])
  test(`unpublished policies block Firebase ${paymentEnvironment} checkout`, async () => {
    const f = await fixture({ paymentEnvironment, policyPublished: false });
    try {
      await assert.rejects(f.create(), { code: "POLICY_NOT_PUBLISHED" });
    } finally {
      f.store.close();
    }
  });
test("published review policies allow test checkout and mark the booking review-only", async () => {
  const f = await fixture();
  try {
    assert.equal((await f.create()).reviewOnly, true);
  } finally {
    f.store.close();
  }
});
test("published review policies cannot enable live checkout", async () => {
  const f = await fixture({ paymentEnvironment: "live" });
  try {
    await assert.rejects(f.create(), { code: "REVIEW_ONLY" });
  } finally {
    f.store.close();
  }
});
test("review-only services stay blocked with live keys after production policies are approved", async () => {
  const f = await fixture({
    paymentEnvironment: "live",
    policyEnvironment: "production",
    reviewService: true,
  });
  try {
    await assert.rejects(f.create(), { code: "REVIEW_ONLY" });
  } finally {
    f.store.close();
  }
});
test("fictional professionals cannot fill real payment slots", async () => {
  const f = await fixture({
    paymentEnvironment: "live",
    policyEnvironment: "production",
    reviewPro: true,
  });
  try {
    await assert.rejects(f.create(), { code: "SLOT_FULL" });
    assert.equal(
      (
        await f.business.availability(demoUsers.customer, "cleaning", f.date)
      ).some((x) => x.available),
      false,
    );
  } finally {
    f.store.close();
  }
});
test("idempotent retries of a test booking cannot bypass live-mode guard", async () => {
  const f = await fixture();
  try {
    await f.create();
    const live = domain(f.store, {
      live: true,
      paymentMode: "razorpay",
      paymentEnvironment: "live",
    });
    await assert.rejects(live.createBooking(demoUsers.customer, f.input), {
      code: "REVIEW_ONLY",
    });
  } finally {
    f.store.close();
  }
});

async function seedModule() {
  return import("../scripts/prepare-client-review.mjs");
}
test("review catalog uses prefixed identities, SAMPLE labels and explicit fictitious prices", async () => {
  const { reviewCatalog } = await seedModule();
  const data = reviewCatalog();
  assert.ok(data.services.some((s) => s.fulfillmentType === "laundry"));
  for (const row of [...data.services, ...data.professionals, ...data.users]) {
    assert.ok(row.id.startsWith("review-"));
    assert.ok(row.name.startsWith("SAMPLE · "));
    assert.equal(row.reviewOnly, true);
  }
  for (const s of data.services) {
    assert.equal(s.sampleReviewed, true);
    assert.equal(s.active, true);
    assert.match(s.description, /fictional.*test/i);
  }
  assert.equal(data.professionals.length, 2);
  assert.ok(
    data.professionals.every(
      (p) => p.approved && p.available && p.jobs === 0 && p.rating === 0,
    ),
  );
  assert.ok(
    data.professionals.every(
      (p) => !p.email && !p.phone && p.skills.length === data.services.length,
    ),
  );
});
const cfg = {
  live: true,
  paymentMode: "razorpay",
  paymentEnvironment: "test",
  projectId: "staging-project",
  razorpayKeyId: "rzp_test_safe",
  razorpayKeySecret: "test-secret",
  publicUrl: "https://staging.example",
  payoutsEnabled: false,
};
function fakeFirestore(records = {}) {
  const data = new Map(Object.entries(records)),
    writes = [];
  const ref = (kind, id) => ({ kind, id });
  const snapshot = (r) => ({
    exists: data.has(r.kind + "/" + r.id),
    id: r.id,
    data: () => data.get(r.kind + "/" + r.id),
  });
  return {
    writes,
    data,
    collection: (kind) => ({
      doc: (id) => ref(kind, id),
      limit: (count) => ({ kind, count }),
    }),
    runTransaction: async (fn) =>
      fn({
        get: async (r) =>
          r.id
            ? snapshot(r)
            : {
                docs: [...data]
                  .filter(([key]) => key.startsWith(r.kind + "/"))
                  .slice(0, r.count)
                  .map(([key]) => snapshot(ref(r.kind, key.split("/")[1]))),
              },
        set: (r, value) => {
          writes.push([r, value]);
          data.set(r.kind + "/" + r.id, value);
        },
      }),
  };
}
test("review preparation defaults to dry-run without contacting Firebase", async () => {
  const { prepareClientReview } = await seedModule();
  const result = await prepareClientReview({
    cfg,
    db: new Proxy(
      {},
      {
        get() {
          throw Error("Unexpected Firebase access");
        },
      },
    ),
  });
  assert.equal(result.applied, false);
  assert.equal(result.policyEnvironment, "test");
  assert.ok(result.services > 0);
  assert.equal(JSON.stringify(result).includes(cfg.razorpayKeySecret), false);
});
test("apply requires a matching explicit project and complete test payment config", async () => {
  const { prepareClientReview } = await seedModule();
  for (const override of [
    { paymentEnvironment: "live", razorpayKeyId: "rzp_live_x" },
    { live: false },
    { razorpayKeySecret: "" },
    { payoutsEnabled: true },
  ])
    await assert.rejects(
      prepareClientReview({
        cfg: { ...cfg, ...override },
        apply: true,
        expectedProject: cfg.projectId,
      }),
    );
  await assert.rejects(
    prepareClientReview({ cfg, apply: true, expectedProject: "other-project" }),
  );
});
test("seed preserves company identity and unrelated data and is idempotent", async () => {
  const { prepareClientReview } = await seedModule();
  const db = fakeFirestore({
    "settings/company": {
      ...company,
      name: "Client registered name",
      policyPublished: false,
      policyEnvironment: "production",
      legalAddress: "Existing client-supplied address",
      custom: "keep",
    },
    "services/real-service": { id: "real-service", active: false },
  });
  await prepareClientReview({
    cfg,
    db,
    apply: true,
    expectedProject: cfg.projectId,
  });
  const saved = db.data.get("settings/company");
  assert.equal(saved.name, "Client registered name");
  assert.equal(saved.legalAddress, "Existing client-supplied address");
  assert.equal(saved.custom, "keep");
  assert.equal(saved.supportPhone, "+917989365699");
  assert.equal(saved.policyEnvironment, "test");
  assert.equal(saved.termsUrl, "https://staging.example/review-terms");
  assert.equal(db.data.get("services/real-service").active, false);
  const firstSize = db.data.size;
  await prepareClientReview({
    cfg,
    db,
    apply: true,
    expectedProject: cfg.projectId,
  });
  assert.equal(db.data.size, firstSize);
});
test("seed refuses production approval, non-review bookings and identity collisions before writes", async () => {
  const { prepareClientReview } = await seedModule();
  for (const data of [
    { "settings/company": { ...company, policyEnvironment: "production" } },
    {
      "bookings/real": {
        id: "real",
        serviceId: "cleaning",
        status: "assigned",
      },
    },
    {
      "services/review-cleaning": {
        id: "review-cleaning",
        name: "Existing service",
      },
    },
  ]) {
    const db = fakeFirestore(data);
    await assert.rejects(
      prepareClientReview({
        cfg,
        db,
        apply: true,
        expectedProject: cfg.projectId,
      }),
    );
    assert.equal(db.writes.length, 0);
  }
});

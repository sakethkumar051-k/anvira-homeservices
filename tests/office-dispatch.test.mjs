import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createApplication } from "../server/app.mjs";
import { createSQLiteStore } from "../server/lib/store.mjs";
import { seedDemo, demoUsers } from "../server/lib/seed.mjs";
import { config } from "../server/lib/config.mjs";
import { slotFor, segmentKeys } from "../server/lib/domain.mjs";

async function fixture({ internal = true, external = false } = {}) {
  const store = await createSQLiteStore(":memory:");
  await seedDemo(store);
  await store.transaction(async (tx) => {
    const company = await tx.get("settings", "company");
    tx.put("settings", {
      ...company,
      dispatchMode: "office_first",
      externalPartnersEnabled: external,
      partnerOfferSeconds: 120,
      termsUrl: "https://example.test/terms",
      privacyUrl: "https://example.test/privacy",
      supportPhone: "+919876543210",
    });
    const p = await tx.get("professionals", "pro-1");
    tx.put("professionals", { ...p, available: internal });
    for (const id of ["pro-2", "pro-4"]) {
      const partner = await tx.get("professionals", "pro-2");
      tx.put("professionals", { ...partner, id, name: id });
      tx.put("users", { id, name: id, role: "professional", active: true });
    }
  });
  const application = await createApplication({
    store,
    config: config({ APP_MODE: "demo", PAYMENT_MODE: "demo" }),
  });
  const server = application.app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const tokens = {};
  const request = async (path, role, body, method) => {
    const response = await fetch(
      `http://127.0.0.1:${server.address().port}/api${path}`,
      {
        method: method || (body ? "POST" : "GET"),
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokens[role] || ""}`,
        },
        body: body ? JSON.stringify(body) : undefined,
      },
    );
    return { status: response.status, data: await response.json() };
  };
  for (const role of ["owner", "care", "customer", "professional"])
    tokens[role] = (await request("/session", null, { role })).data.token;
  tokens.partner = (
    await request("/session", null, {
      role: "professional",
      professionalId: "pro-2",
    })
  ).data.token;
  const slot = slotFor(
    new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10),
    12,
  );
  const create = async (overrides = {}) =>
    application.business.createBooking(demoUsers.customer, {
      serviceId: "cleaning",
      slot,
      address: { line: "Private customer address", pin: "509216" },
      instructions: "Private key code 9876",
      idempotencyKey: randomUUID(),
      ...overrides,
    });
  const pay = (booking) =>
    application.business.action(demoUsers.customer, booking.id, {
      action: "pay",
    });
  return {
    ...application,
    store,
    request,
    create,
    pay,
    slot,
    close: async () => {
      await new Promise((r) => server.close(r));
      store.close();
    },
  };
}
const owner = { id: "owner-1", role: "owner" },
  care = { id: "care-1", role: "care" };
const partner = (id) => ({ id, role: "professional" });

// These tests catch permission bypasses and account provisioning by roster writes.
test("Owner creates accountless workers; Care only changes operational availability", async () => {
  const f = await fixture();
  try {
    const body = {
      name: "Office worker",
      phone: "+919876543210",
      skills: ["cleaning"],
      pins: ["509216"],
      schedule: {
        days: [0, 1, 2, 3, 4, 5, 6],
        hours: [9, 12, 15, 18],
        blockedDates: [],
      },
    };
    assert.equal(
      (await f.request("/inhouse-workers", "care", body)).status,
      403,
    );
    const response = await f.request("/inhouse-workers", "owner", body);
    assert.equal(response.status, 201);
    const worker = response.data;
    assert.equal(worker.accountless, true);
    assert.equal(worker.type, "In-house");
    assert.equal(await f.store.get("users", worker.id), null);
    assert.equal(
      (
        await f.request(
          `/inhouse-workers/${worker.id}`,
          "care",
          { name: "Changed" },
          "PATCH",
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await f.request(
          `/inhouse-workers/${worker.id}/availability`,
          "customer",
          { available: false },
          "PATCH",
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await f.request(
          `/inhouse-workers/${worker.id}/availability`,
          "care",
          { available: false },
          "PATCH",
        )
      ).data.available,
      false,
    );
    const state = await f.request("/state", "customer");
    assert.equal(
      state.data.professionals.find((p) => p.id === worker.id).phone,
      undefined,
    );
  } finally {
    await f.close();
  }
});

test("Owner dispatch controls validate expiry bounds and survive unrelated settings saves", async () => {
  const f = await fixture();
  try {
    const company = await f.business.settings(f.store);
    assert.equal(
      (await f.request("/settings", "care", company, "PUT")).status,
      403,
    );
    for (const partnerOfferSeconds of [59, 301])
      assert.equal(
        (
          await f.request(
            "/settings",
            "owner",
            { ...company, partnerOfferSeconds },
            "PUT",
          )
        ).status,
        400,
      );
    assert.equal(
      (
        await f.request(
          "/settings",
          "owner",
          { ...company, externalPartnersEnabled: true },
          "PUT",
        )
      ).status,
      200,
    );
    const {
      dispatchMode,
      externalPartnersEnabled,
      partnerOfferSeconds,
      ...legacyFields
    } = company;
    assert.equal(
      (await f.request("/settings", "owner", legacyFields, "PUT")).status,
      200,
    );
    assert.equal(
      (await f.business.settings(f.store)).externalPartnersEnabled,
      true,
    );
  } finally {
    await f.close();
  }
});

test("paid office booking retains one capacity hold and staff operate internal lifecycle without earnings", async () => {
  const f = await fixture();
  try {
    const b = await f.create();
    const paid = await f.pay(b);
    assert.equal(paid.status, "awaiting_assignment");
    assert.equal(paid.professionalId, undefined);
    assert.equal(paid.dispatch.state, "awaiting_staff");
    const locks = await f.store.list("locks", [["bookingId", "==", b.id]]);
    assert.equal(locks.length, segmentKeys(b).length);
    assert.ok(
      locks.every((l) => l.expiresAt === b.slot + (b.duration + 30) * 60000),
    );
    const assigned = await f.business.action(care, b.id, {
      action: "assign",
      professionalId: "pro-1",
    });
    assert.equal(assigned.status, "confirmed");
    assert.equal(assigned.dispatch.assignedBy, care.id);
    assert.equal(
      (
        await f.request(`/bookings/${b.id}/action`, "customer", {
          action: "dispatch",
        })
      ).status,
      403,
    );
    await assert.rejects(
      f.business.action(care, b.id, { action: "start" }),
      (e) => e.status === 409,
    );
    await f.business.action(care, b.id, { action: "dispatch" });
    await f.business.action(care, b.id, { action: "arrive" });
    await f.business.action(care, b.id, { action: "start" });
    await assert.rejects(
      f.business.action(care, b.id, { action: "complete", checklist: [] }),
      (e) => e.code === "INCOMPLETE_CHECKLIST",
    );
    const done = await f.business.action(care, b.id, {
      action: "complete",
      checklist: Array(3 + b.serviceChecklist.length).fill(true),
    });
    assert.equal(done.status, "completed");
    assert.equal(done.commissionBps, 0);
    assert.equal((await f.store.list("ledger")).length, 0);
    assert.equal((await f.store.list("wallets")).length, 0);
    assert.equal(
      (await f.store.list("locks", [["bookingId", "==", b.id]])).length,
      0,
    );
  } finally {
    await f.close();
  }
});

test("office deadlines escalate without automatic reassignment or refund", async () => {
  const f = await fixture();
  try {
    const b = await f.pay(await f.create());
    await f.jobs.maintenance(b.assignmentDueAt + 1);
    const current = await f.store.get("bookings", b.id);
    assert.equal(current.dispatch.state, "attention");
    assert.equal(current.status, "awaiting_assignment");
    assert.equal(current.refund, undefined);
    assert.equal((await f.store.list("jobs")).length, 0);
    assert.ok(
      (await f.store.list("locks", [["bookingId", "==", b.id]])).length > 0,
    );
  } finally {
    await f.close();
  }
});

test("external fallback needs company and service permission and exhausted internal capacity", async () => {
  const f = await fixture({ internal: false });
  try {
    await assert.rejects(f.create(), (e) => e.code === "SLOT_FULL");
    await f.store.transaction(async (tx) => {
      const company = await f.business.settings(tx);
      tx.put("settings", { ...company, externalPartnersEnabled: true });
      const s = await tx.get("services", "cleaning");
      tx.put("services", { ...s, partnerFulfillmentAllowed: false });
    });
    await assert.rejects(f.create(), (e) => e.code === "SLOT_FULL");
    await f.store.transaction(async (tx) => {
      const s = await tx.get("services", "cleaning");
      tx.put("services", { ...s, partnerFulfillmentAllowed: true });
    });
    const b = await f.pay(await f.create());
    assert.equal(b.dispatch.state, "offering");
    assert.equal((await f.store.list("dispatchOffers")).length, 2);
    assert.equal(
      (await f.store.list("locks", [["bookingId", "==", b.id]])).length,
      segmentKeys(b).length,
    );
  } finally {
    await f.close();
  }
});

test("partner inbox is private and first simultaneous eligible acceptance wins exactly once", async () => {
  const f = await fixture({ internal: false, external: true });
  try {
    const b = await f.pay(await f.create());
    const inbox = await f.request("/partner-offers", "partner");
    assert.equal(inbox.status, 200);
    assert.equal(inbox.data.offers.length, 1);
    assert.deepEqual(
      Object.keys(inbox.data.offers[0]).sort(),
      [
        "id",
        "bookingId",
        "roundId",
        "serviceName",
        "scope",
        "slot",
        "duration",
        "pin",
        "expiresAt",
        "gross",
        "commission",
        "net",
      ].sort(),
    );
    assert.equal((await f.request(`/bookings/${b.id}`, "partner")).status, 403);
    assert.equal(
      (await f.request(`/bookings/${b.id}/messages`, "partner")).status,
      403,
    );
    const offers = await f.store.list("dispatchOffers");
    const results = await Promise.allSettled(
      offers.map((offer) =>
        f.business.acceptPartnerOffer(partner(offer.professionalId), offer.id),
      ),
    );
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    const winner = await f.store.get("bookings", b.id);
    assert.equal(winner.status, "confirmed");
    assert.equal(winner.dispatch.state, "claimed");
    const winningOffer = offers.find(
      (o) => o.professionalId === winner.professionalId,
    );
    const again = await f.business.acceptPartnerOffer(
      partner(winner.professionalId),
      winningOffer.id,
    );
    assert.equal(again.id, winner.id);
    assert.equal(
      (await f.store.list("locks", [["bookingId", "==", b.id]])).length,
      segmentKeys(b).length,
    );
    assert.equal(
      (await f.request("/partner-offers", "partner")).data.offers.length,
      0,
    );
    await assert.rejects(
      f.business.action(care, b.id, { action: "start" }),
      (e) => e.status === 403,
    );
  } finally {
    await f.close();
  }
});

for (const change of [
  "expired",
  "revoked",
  "service_disabled",
  "disabled",
  "unapproved",
  "cancelled",
  "rescheduled",
  "refunding",
]) {
  test(`partner acceptance rejects ${change} offers before maintenance`, async () => {
    const f = await fixture({ internal: false, external: true });
    try {
      const b = await f.pay(await f.create());
      const offer = (await f.store.list("dispatchOffers"))[0];
      if (change === "cancelled")
        await f.business.action(owner, b.id, { action: "cancel" });
      else if (change === "rescheduled")
        await f.business.action(owner, b.id, {
          action: "reschedule",
          slot: b.slot + 86400000,
        });
      else
        await f.store.transaction(async (tx) => {
          if (change === "revoked") {
            const c = await f.business.settings(tx);
            tx.put("settings", { ...c, externalPartnersEnabled: false });
          }
          if (change === "service_disabled") {
            const s = await tx.get("services", b.serviceId);
            tx.put("services", { ...s, partnerFulfillmentAllowed: false });
          }
          if (change === "disabled") {
            const u = await tx.get("users", offer.professionalId);
            tx.put("users", { ...u, active: false });
          }
          if (change === "unapproved") {
            const p = await tx.get("professionals", offer.professionalId);
            tx.put("professionals", { ...p, approved: false });
          }
          if (change === "expired") {
            const current = await tx.get("bookings", b.id);
            tx.put("bookings", {
              ...current,
              dispatch: { ...current.dispatch, expiresAt: Date.now() - 1 },
            });
          }
          if (change === "refunding") {
            const current = await tx.get("bookings", b.id);
            tx.put("bookings", { ...current, refund: "requested" });
          }
        });
      await assert.rejects(
        f.business.acceptPartnerOffer(partner(offer.professionalId), offer.id),
        (e) => [403, 409].includes(e.status),
      );
      assert.equal(
        await f.business.isPartnerOfferCurrent(
          f.store,
          { ...offer, offerId: offer.id, userId: offer.professionalId },
          Date.now(),
        ),
        false,
      );
    } finally {
      await f.close();
    }
  });
}

test("one partner cannot win overlapping jobs and failed internal replacement preserves original hold", async () => {
  const f = await fixture({ internal: false, external: true });
  try {
    const a = await f.pay(await f.create());
    const b = await f.pay(await f.create());
    const offers = await f.store.list("dispatchOffers", [
      ["professionalId", "==", "pro-2"],
    ]);
    const results = await Promise.allSettled(
      offers.map((o) => f.business.acceptPartnerOffer(partner("pro-2"), o.id)),
    );
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    const before = await f.store.list("locks");
    await assert.rejects(
      f.business.action(owner, a.id, {
        action: "assign",
        professionalId: "pro-1",
      }),
      (e) => e.status === 409,
    );
    assert.deepEqual(await f.store.list("locks"), before);
    assert.equal((await f.store.get("bookings", b.id)).payment, "paid");
  } finally {
    await f.close();
  }
});

test("staff internal assignment invalidates a live partner round and decline never opens full booking access", async () => {
  const f = await fixture({ internal: false, external: true });
  try {
    const b = await f.pay(await f.create());
    const offers = await f.store.list("dispatchOffers");
    assert.equal(
      (
        await f.request(
          `/partner-offers/${offers.find((o) => o.professionalId === "pro-2").id}/decline`,
          "customer",
          {},
        )
      ).status,
      403,
    );
    await f.business.declinePartnerOffer(
      partner("pro-2"),
      offers.find((o) => o.professionalId === "pro-2").id,
    );
    assert.equal(
      (await f.request("/partner-offers", "partner")).data.offers.length,
      0,
    );
    await f.store.transaction(async (tx) => {
      const p = await tx.get("professionals", "pro-1");
      tx.put("professionals", { ...p, available: true });
    });
    await f.business.action(care, b.id, {
      action: "assign",
      professionalId: "pro-1",
    });
    await assert.rejects(
      f.business.acceptPartnerOffer(
        partner("pro-4"),
        offers.find((o) => o.professionalId === "pro-4").id,
      ),
      (e) => e.status === 409,
    );
    assert.equal((await f.request(`/bookings/${b.id}`, "partner")).status, 403);
  } finally {
    await f.close();
  }
});

test("stale staff revisions cannot replace assignments or bypass explicit dispatch", async () => {
  const f = await fixture();
  try {
    const b = await f.pay(await f.create());
    const assigned = await f.business.action(care, b.id, {
      action: "assign",
      professionalId: "pro-1",
      revision: b.dispatch.revision,
    });
    await assert.rejects(
      f.business.action(owner, b.id, {
        action: "dispatch",
        revision: b.dispatch.revision,
      }),
      (e) => e.code === "DISPATCH_CONFLICT",
    );
    await assert.rejects(
      f.business.action(care, b.id, { action: "arrive" }),
      (e) => e.code === "INVALID_JOB_STATE",
    );
    await f.business.action(owner, b.id, {
      action: "dispatch",
      revision: assigned.dispatch.revision,
    });
  } finally {
    await f.close();
  }
});

test("an active internal worker becoming available suppresses unclaimed partner offers", async () => {
  const f = await fixture({ internal: false, external: true });
  try {
    await f.pay(await f.create());
    const offer = (await f.store.list("dispatchOffers"))[0];
    await f.store.transaction(async (tx) => {
      const p = await tx.get("professionals", "pro-1");
      tx.put("professionals", { ...p, available: true });
    });
    await assert.rejects(
      f.business.acceptPartnerOffer(partner(offer.professionalId), offer.id),
      (e) => e.status === 409,
    );
    assert.equal(
      (await f.request("/partner-offers", "partner")).data.offers.length,
      0,
    );
  } finally {
    await f.close();
  }
});

test("invalid explicit dispatch settings do not silently become defaults", async () => {
  const f = await fixture();
  try {
    const company = await f.business.settings(f.store);
    for (const field of [
      "dispatchMode",
      "externalPartnersEnabled",
      "partnerOfferSeconds",
    ])
      assert.equal(
        (
          await f.request(
            "/settings",
            "owner",
            { ...company, [field]: null },
            "PUT",
          )
        ).status,
        400,
      );
  } finally {
    await f.close();
  }
});

for (const permission of ["company", "service"])
  test(`${permission} revocation permanently invalidates its previous offer round after re-enabling`, async () => {
    const f = await fixture({ internal: false, external: true });
    try {
      await f.pay(await f.create());
      const offer = (await f.store.list("dispatchOffers"))[0];
      if (permission === "company") {
        const company = await f.business.settings(f.store);
        for (const externalPartnersEnabled of [false, true])
          assert.equal(
            (
              await f.request(
                "/settings",
                "owner",
                { ...company, externalPartnersEnabled },
                "PUT",
              )
            ).status,
            200,
          );
      } else {
        const service = await f.store.get("services", "cleaning");
        for (const partnerFulfillmentAllowed of [false, true])
          assert.equal(
            (
              await f.request(
                "/services/cleaning",
                "owner",
                { ...service, partnerFulfillmentAllowed },
                "PATCH",
              )
            ).status,
            200,
          );
      }
      await assert.rejects(
        f.business.acceptPartnerOffer(partner(offer.professionalId), offer.id),
        (e) => e.status === 409,
      );
      assert.equal(
        (await f.request("/partner-offers", "partner")).data.offers.length,
        0,
      );
    } finally {
      await f.close();
    }
  });

test("a free third partner receives two overlapping rounds but can claim only one", async () => {
  const f = await fixture({ internal: false, external: true });
  try {
    await f.store.transaction(async (tx) => {
      const p = await tx.get("professionals", "pro-2");
      tx.put("professionals", { ...p, id: "pro-6" });
      tx.put("users", {
        id: "pro-6",
        name: "Third partner",
        role: "professional",
        active: true,
      });
    });
    await f.pay(await f.create());
    await f.pay(await f.create());
    const offers = await f.store.list("dispatchOffers", [
      ["professionalId", "==", "pro-6"],
    ]);
    assert.equal(offers.length, 2);
    const claims = await Promise.allSettled(
      offers.map((o) => f.business.acceptPartnerOffer(partner("pro-6"), o.id)),
    );
    assert.equal(claims.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(
      (await f.store.list("bookings", [["professionalId", "==", "pro-6"]]))
        .length,
      1,
    );
  } finally {
    await f.close();
  }
});

test("claimed partner completion credits the frozen rate exactly once", async () => {
  const f = await fixture({ internal: false, external: true });
  try {
    const b = await f.pay(await f.create());
    const offer = (await f.store.list("dispatchOffers"))[0];
    const u = partner(offer.professionalId);
    await f.business.acceptPartnerOffer(u, offer.id);
    await f.store.transaction(async (tx) => {
      const company = await f.business.settings(tx);
      tx.put("settings", { ...company, commissionBps: 4000 });
    });
    await f.business.action(u, b.id, { action: "start" });
    await f.business.action(u, b.id, {
      action: "complete",
      checklist: Array(3 + b.serviceChecklist.length).fill(true),
    });
    await assert.rejects(
      f.business.action(u, b.id, {
        action: "complete",
        checklist: Array(3 + b.serviceChecklist.length).fill(true),
      }),
      (e) => e.status === 409,
    );
    const ledger = await f.store.get("ledger", `job_${b.id}`);
    assert.equal(ledger.commission, 300);
    assert.equal(ledger.amount, 1199);
    assert.equal((await f.store.get("wallets", u.id)).available, 1199);
  } finally {
    await f.close();
  }
});

test("push freshness rejects mismatched offer expiration metadata", async () => {
  const f = await fixture({ internal: false, external: true });
  try {
    await f.pay(await f.create());
    const offer = (await f.store.list("dispatchOffers"))[0];
    const item = {
      offerId: offer.id,
      userId: offer.professionalId,
      bookingId: offer.bookingId,
      roundId: offer.roundId,
      expiresAt: offer.expiresAt,
    };
    assert.equal(await f.business.isPartnerOfferCurrent(f.store, item), true);
    assert.equal(
      await f.business.isPartnerOfferCurrent(f.store, {
        ...item,
        expiresAt: item.expiresAt + 60000,
      }),
      false,
    );
    assert.equal(
      await f.business.isPartnerOfferCurrent(f.store, {
        ...item,
        expiresAt: undefined,
      }),
      false,
    );
  } finally {
    await f.close();
  }
});

test("large eligible rosters open bounded rounds while keeping a single paid capacity hold", async () => {
  const f = await fixture({ internal: false, external: true });
  try {
    await f.store.transaction(async (tx) => {
      const template = await tx.get("professionals", "pro-2");
      for (let i = 0; i < 80; i++) {
        const id = "bulk-partner-" + i;
        tx.put("professionals", { ...template, id, name: id });
        tx.put("users", { id, role: "professional", active: true });
      }
    });
    const b = await f.pay(await f.create());
    const offers = await f.store.list("dispatchOffers", [
      ["bookingId", "==", b.id],
    ]);
    assert.equal(offers.length, 50);
    assert.equal(
      (await f.store.list("outbox", [["kind", "==", "partner_offer"]])).length,
      50,
    );
    const locks = await f.store.list("locks", [["bookingId", "==", b.id]]);
    assert.equal(locks.length, segmentKeys(b).length);
    assert.equal(new Set(locks.map((l) => l.professionalId)).size, 1);
    assert.equal(b.payment, "paid");
    assert.equal(b.dispatch.state, "offering");
  } finally {
    await f.close();
  }
});

test("office laundry progress uses its custody revision independently of dispatch", async () => {
  const f = await fixture();
  try {
    await f.store.transaction(async (tx) => {
      const s = await tx.get("services", "cleaning");
      tx.put("services", { ...s, fulfillmentType: "laundry" });
    });
    const b = await f.pay(await f.create());
    for (const input of [
      { action: "assign", professionalId: "pro-1" },
      { action: "dispatch" },
      { action: "arrive" },
      { action: "start" },
    ])
      await f.business.action(care, b.id, input);
    const collected = await f.business.action(care, b.id, {
      action: "laundry",
      stage: "collected",
      revision: 0,
      note: "12 garments sealed in bag",
    });
    assert.equal(collected.laundry.revision, 1);
    await assert.rejects(
      f.business.action(care, b.id, {
        action: "laundry",
        stage: "received",
        revision: 0,
        note: "Stale update",
      }),
      (e) => e.status === 409,
    );
    const returned = await f.business.action(care, b.id, {
      action: "laundry_return",
      revision: 1,
      returned: true,
      note: "All twelve garments returned to the customer by agreement.",
    });
    assert.equal(returned.laundry.stage, "returned");
    assert.equal(returned.status, "cancelled");
  } finally {
    await f.close();
  }
});

test("an arrived internal team cannot be reassigned and lose arrival history", async () => {
  const f = await fixture();
  try {
    const b = await f.pay(await f.create());
    for (const input of [
      { action: "assign", professionalId: "pro-1" },
      { action: "dispatch" },
      { action: "arrive" },
    ])
      await f.business.action(care, b.id, input);
    const before = await f.store.get("bookings", b.id);
    await assert.rejects(
      f.business.action(care, b.id, {
        action: "assign",
        professionalId: "pro-1",
      }),
      (e) => e.status === 409,
    );
    assert.equal(
      (await f.store.get("bookings", b.id)).arrivedAt,
      before.arrivedAt,
    );
  } finally {
    await f.close();
  }
});

test("late captured office payment cannot overwrite another booking's capacity", async () => {
  const f = await fixture();
  try {
    const a = await f.create();
    await f.store.transaction(async (tx) => {
      for (const lock of await tx.list("locks", [["bookingId", "==", a.id]]))
        tx.put("locks", { ...lock, expiresAt: Date.now() - 1 });
      tx.put("bookings", {
        ...a,
        orderId: "order_office_late",
        expiresAt: Date.now() - 1,
      });
    });
    const b = await f.pay(await f.create());
    const before = await f.store.list("locks", [["bookingId", "==", b.id]]);
    await f.business.paymentCaptured(
      {
        id: "pay_office_late",
        order_id: "order_office_late",
        amount: a.total * 100,
        currency: "INR",
        status: "captured",
      },
      "office_late_capture",
    );
    for (const lock of before)
      assert.equal((await f.store.get("locks", lock.id)).bookingId, b.id);
  } finally {
    await f.close();
  }
});

test("old in-house app credentials cannot bypass office dispatch", async () => {
  const f = await fixture();
  try {
    const b = await f.pay(await f.create());
    await f.business.action(care, b.id, {
      action: "assign",
      professionalId: "pro-1",
    });
    await assert.rejects(
      f.business.action(partner("pro-1"), b.id, { action: "start" }),
      (e) => [403, 409].includes(e.status),
    );
  } finally {
    await f.close();
  }
});

test("automatic mode never reserves an accountless internal worker", async () => {
  const f = await fixture({ internal: false });
  try {
    await f.store.transaction(async (tx) => {
      const c = await f.business.settings(tx);
      tx.put("settings", { ...c, dispatchMode: "automatic" });
      for (const p of await tx.list("professionals"))
        tx.put("professionals", { ...p, available: false });
      const template = await tx.get("professionals", "pro-1");
      tx.put("professionals", {
        ...template,
        id: "inhouse_accountless",
        available: true,
        accountless: true,
      });
    });
    await assert.rejects(f.create(), (e) => e.code === "SLOT_FULL");
  } finally {
    await f.close();
  }
});

test("customer availability includes accountless workers only in office mode", async () => {
  const f = await fixture({ internal: false });
  try {
    await f.store.transaction(async (tx) => {
      for (const p of await tx.list("professionals"))
        tx.put("professionals", { ...p, available: false });
      const p = await tx.get("professionals", "pro-1");
      tx.put("professionals", {
        ...p,
        id: "inhouse_only",
        available: true,
        accountless: true,
      });
    });
    const date = new Date(f.slot + 330 * 60000).toISOString().slice(0, 10);
    const slots = await f.business.availability(
      demoUsers.customer,
      "cleaning",
      date,
      undefined,
      "509216",
    );
    assert.equal(slots.find((s) => s.slot === f.slot)?.available, true);
    const created = await f.create();
    assert.equal(created.reservedProfessionalId, "inhouse_only");
    await f.store.transaction(async (tx) => {
      const c = await f.business.settings(tx);
      tx.put("settings", { ...c, dispatchMode: "automatic" });
    });
    const automatic = await f.business.availability(
      demoUsers.customer,
      "cleaning",
      date,
      undefined,
      "509216",
    );
    assert.ok(automatic.every((s) => !s.available));
  } finally {
    await f.close();
  }
});

test("legacy reschedule availability keeps its automatic workflow after office mode is enabled", async () => {
  const f = await fixture({ internal: false });
  try {
    await f.store.transaction(async (tx) => {
      const c = await f.business.settings(tx);
      tx.put("settings", { ...c, dispatchMode: "automatic" });
    });
    const b = await f.create();
    await f.store.transaction(async (tx) => {
      const c = await f.business.settings(tx);
      tx.put("settings", {
        ...c,
        dispatchMode: "office_first",
        externalPartnersEnabled: false,
      });
    });
    const date = new Date(f.slot + 330 * 60000).toISOString().slice(0, 10);
    const slots = await f.business.availability(
      demoUsers.customer,
      "cleaning",
      date,
      b.id,
      "509216",
    );
    assert.equal(slots.find((s) => s.slot === f.slot)?.available, true);
  } finally {
    await f.close();
  }
});

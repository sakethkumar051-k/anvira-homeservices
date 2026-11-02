import { test } from "node:test";
import assert from "node:assert/strict";
import { createSQLiteStore } from "../server/lib/store.mjs";
import { workers } from "../server/lib/workers.mjs";
import { domain, slotFor } from "../server/lib/domain.mjs";
import { seedDemo, demoUsers } from "../server/lib/seed.mjs";

async function fixture(options = {}) {
  const store = await createSQLiteStore(":memory:");
  const item = {
    id: "notification-1",
    userId: "partner-1",
    bookingId: "booking-private",
    kind: "partner_offer",
    offerId: "offer-1",
    roundId: "round-1",
    expiresAt: Date.now() + 90000,
    status: "pending",
    attempts: 0,
    dueAt: Date.now(),
    title: "Private customer name",
    body: "Private customer address",
    ...options.item,
  };
  await store.transaction(async (tx) => {
    tx.put("outbox", item);
    tx.put("devices", {
      id: "device-1",
      userId: item.userId,
      active: true,
      token: "ExpoPushToken[test]",
    });
  });
  let current = options.current ?? true;
  let checks = 0;
  const business = {
    async isPartnerOfferCurrent() {
      checks++;
      return current;
    },
  };
  const jobs = workers(store, business, {}, { live: true });
  return {
    store,
    item,
    jobs,
    setCurrent(value) {
      current = value;
    },
    checks: () => checks,
  };
}

test("partner push uses private minimal data, dedicated sound/channel, high priority and expiry-bounded transport", async () => {
  const f = await fixture();
  const original = globalThis.fetch;
  const sent = [];
  globalThis.fetch = async (_url, options) => {
    sent.push(JSON.parse(options.body));
    return {
      ok: true,
      json: async () => ({ data: [{ status: "ok", id: "ticket-1" }] }),
    };
  };
  try {
    await f.jobs.push();
    assert.equal(sent.length, 1);
    const payload = sent[0][0];
    assert.equal(payload.channelId, "partner-offers-v1");
    assert.equal(payload.sound, "partner-offer.wav");
    assert.equal(payload.priority, "high");
    assert.ok(payload.ttl > 0 && payload.ttl <= 90);
    assert.equal(payload.expiration, Math.floor(f.item.expiresAt / 1000));
    assert.deepEqual(payload.data, {
      kind: "partner_offer",
      offerId: "offer-1",
      roundId: "round-1",
      expiresAt: f.item.expiresAt,
      notificationId: f.item.id,
    });
    assert.equal(JSON.stringify(payload).includes("Private customer"), false);
    assert.ok(
      f.checks() >= 2,
      "validate during lease and immediately before transport",
    );
  } finally {
    globalThis.fetch = original;
    f.store.close();
  }
});

test("partner push suppresses offers rejected by the domain before sending", async () => {
  const f = await fixture({ current: false });
  const original = globalThis.fetch;
  let sends = 0;
  globalThis.fetch = async () => {
    sends++;
    throw Error("must not send");
  };
  try {
    await f.jobs.push();
    assert.equal(sends, 0);
    assert.equal((await f.store.get("outbox", f.item.id)).status, "suppressed");
  } finally {
    globalThis.fetch = original;
    f.store.close();
  }
});
test("expired partner push is suppressed even if domain transport hook returns true", async () => {
  const f = await fixture({ item: { expiresAt: Date.now() - 1 } });
  const original = globalThis.fetch;
  let sends = 0;
  globalThis.fetch = async () => {
    sends++;
    throw Error("must not send");
  };
  try {
    await f.jobs.push();
    assert.equal(sends, 0);
    assert.equal((await f.store.get("outbox", f.item.id)).status, "suppressed");
  } finally {
    globalThis.fetch = original;
    f.store.close();
  }
});
test("a partner push failure rechecks permission before creating a retry", async () => {
  const f = await fixture();
  const original = globalThis.fetch;
  globalThis.fetch = async () => {
    f.setCurrent(false);
    throw Error("connection reset");
  };
  try {
    await f.jobs.push();
    assert.equal((await f.store.get("outbox", f.item.id)).status, "suppressed");
  } finally {
    globalThis.fetch = original;
    f.store.close();
  }
});
test("a partner push is rechecked after device lookup before network delivery", async () => {
  const f = await fixture();
  const list = f.store.list;
  f.store.list = async (...args) => {
    const rows = await list(...args);
    if (args[0] === "devices") f.setCurrent(false);
    return rows;
  };
  const original = globalThis.fetch;
  let sends = 0;
  globalThis.fetch = async () => {
    sends++;
    throw Error("must not send");
  };
  try {
    await f.jobs.push();
    assert.equal(sends, 0);
    assert.equal((await f.store.get("outbox", f.item.id)).status, "suppressed");
  } finally {
    globalThis.fetch = original;
    f.store.close();
  }
});

for (const reason of [
  "cancelled",
  "claimed",
  "refunding",
  "revoked",
  "nonrecipient",
  "replaced round",
  "disabled partner",
  "unavailable partner",
]) {
  test(`real dispatch validation prevents ${reason} offer notifications`, async () => {
    const store = await createSQLiteStore(":memory:");
    await seedDemo(store);
    await store.transaction(async (tx) => {
      tx.put("settings", {
        ...(await tx.get("settings", "company")),
        dispatchMode: "office_first",
        externalPartnersEnabled: true,
        partnerOfferSeconds: 120,
      });
      tx.put("professionals", {
        ...(await tx.get("professionals", "pro-1")),
        available: false,
      });
      tx.put("users", { id: "pro-2", role: "professional", active: true });
      tx.put("devices", {
        id: "device-2",
        userId: "pro-2",
        token: "ExpoPushToken[partner]",
        active: true,
      });
    });
    const cfg = {
      live: false,
      paymentMode: "demo",
      paymentEnvironment: "test",
    };
    const business = domain(store, cfg);
    const booking = await business.createBooking(demoUsers.customer, {
      serviceId: "cleaning",
      slot: slotFor(
        new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10),
        12,
      ),
      address: { line: "Private customer address", pin: "509216" },
      idempotencyKey: "push-test-" + reason,
    });
    await business.action(demoUsers.customer, booking.id, { action: "pay" });
    const item = (await store.list("outbox")).find(
      (n) => n.kind === "partner_offer",
    );
    assert.ok(item);
    assert.equal(await business.isPartnerOfferCurrent(store, item), true);
    await store.transaction(async (tx) => {
      for (const n of await tx.list("outbox"))
        if (n.id !== item.id) tx.remove("outbox", n.id);
      const b = await tx.get("bookings", booking.id);
      if (reason === "cancelled")
        tx.put("bookings", { ...b, status: "cancelled" });
      if (reason === "claimed")
        tx.put("bookings", {
          ...b,
          professionalId: "pro-2",
          status: "confirmed",
          dispatch: { ...b.dispatch, state: "claimed" },
        });
      if (reason === "refunding")
        tx.put("bookings", { ...b, refund: "processing" });
      if (reason === "revoked")
        tx.put("settings", {
          ...(await tx.get("settings", "company")),
          externalPartnersEnabled: false,
        });
      if (reason === "nonrecipient")
        tx.put("outbox", { ...item, userId: "another-partner" });
      if (reason === "replaced round")
        tx.put("bookings", {
          ...b,
          dispatch: { ...b.dispatch, roundId: "new-round" },
        });
      if (reason === "disabled partner")
        tx.put("users", { ...(await tx.get("users", "pro-2")), active: false });
      if (reason === "unavailable partner")
        tx.put("professionals", {
          ...(await tx.get("professionals", "pro-2")),
          available: false,
        });
    });
    const original = globalThis.fetch;
    let sends = 0;
    globalThis.fetch = async () => {
      sends++;
      throw Error("must not send");
    };
    try {
      await workers(store, business, {}, { ...cfg, live: true }).push();
      assert.equal(sends, 0);
      assert.equal((await store.get("outbox", item.id)).status, "suppressed");
    } finally {
      globalThis.fetch = original;
      store.close();
    }
  });
}

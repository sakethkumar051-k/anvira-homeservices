import { randomUUID } from "node:crypto";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createSQLiteStore } from "../server/lib/store.mjs";
import { createApplication } from "../server/app.mjs";
import { config } from "../server/lib/config.mjs";
import { slotFor } from "../server/lib/domain.mjs";
let application, server, base, quote;
const tokens = {};
async function req(path, role, body, method) {
  if (path === "/service-quotes" && body)
    body = { idempotencyKey: randomUUID(), ...body };
  const r = await fetch(base + path, {
    method: method || (body ? "POST" : "GET"),
    headers: {
      Authorization: "Bearer " + (tokens[role] || ""),
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, data: await r.json() };
}
before(async () => {
  application = await createApplication({
    store: await createSQLiteStore(":memory:"),
    config: config({ APP_MODE: "demo", PAYMENT_MODE: "demo" }),
  });
  server = application.app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  base = "http://127.0.0.1:" + server.address().port + "/api";
  for (const role of ["customer", "owner", "care", "professional"])
    tokens[role] = (await req("/session", "", { role })).data.token;
});
after(async () => {
  await new Promise((r) => server.close(r));
  application.store.close();
});
test("customers request scoped quotes; professionals cannot read them", async () => {
  const service = (await req("/catalog")).data.services[0];
  const r = await req("/service-quotes", "customer", {
    serviceId: service.id,
    description: "Please quote additional cleaning for three rooms.",
    address: { line: "House 42, Shadnagar", pin: "509216" },
  });
  assert.equal(r.status, 201);
  quote = r.data;
  assert.equal(quote.status, "requested");
  assert.equal((await req("/service-quotes", "professional")).status, 403);
  assert.equal(
    (await req("/service-quotes/" + quote.id, "professional")).status,
    403,
  );
});
test("only Owner prices and acceptance requires exact current revision", async () => {
  const body = {
    revision: 0,
    items: [{ label: "Three room cleaning", quantity: 1, unitPrice: 700 }],
    duration: 60,
    scope: "Three rooms; excludes consumables",
    expiresAt: Date.now() + 86400000,
  };
  assert.equal(
    (await req("/service-quotes/" + quote.id + "/propose", "care", body))
      .status,
    403,
  );
  let r = await req("/service-quotes/" + quote.id + "/propose", "owner", body);
  assert.equal(r.status, 200);
  assert.equal(r.data.total, 700);
  assert.equal(
    (
      await req("/service-quotes/" + quote.id + "/accept", "customer", {
        revision: 0,
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await req("/service-quotes/" + quote.id + "/accept", "customer", {
        revision: 1,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await req("/service-quotes/" + quote.id + "/propose", "owner", {
        ...body,
        revision: 1,
      })
    ).status,
    409,
  );
});
test("quote checkout snapshots approved price and prevents a second booking", async () => {
  const body = {
    serviceId: quote.serviceId,
    quoteId: quote.id,
    address: quote.address,
    slot: slotFor(
      new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      9,
    ),
    idempotencyKey: "quoted-booking-one",
  };
  const r = await req("/bookings", "customer", body);
  assert.equal(r.status, 201);
  assert.equal(r.data.total, 700);
  assert.equal(r.data.scope[0], "Three rooms; excludes consumables");
  assert.equal(r.data.quoteId, quote.id);
  assert.equal((await req("/bookings", "customer", body)).data.id, r.data.id);
  assert.equal(
    (
      await req("/bookings", "customer", {
        ...body,
        idempotencyKey: "quoted-booking-two",
      })
    ).status,
    409,
  );
});

test("expired, mismatched and tampered quotes cannot create bookings", async () => {
  const create = await req("/service-quotes", "customer", {
    serviceId: quote.serviceId,
    description: "Please clean another property with a tailored scope.",
    address: quote.address,
  });
  const id = create.data.id;
  const proposal = {
    revision: 0,
    items: [{ label: "Deep clean", quantity: 2, unitPrice: 500 }],
    duration: 90,
    scope: "Two rooms, materials included, no structural repairs.",
    expiresAt: Date.now() + 86400000,
  };
  assert.equal(
    (
      await req("/service-quotes/" + id + "/propose", "owner", {
        ...proposal,
        items: [{ label: "Over limit", quantity: 100, unitPrice: 100000 }],
      })
    ).status,
    400,
  );
  assert.equal(
    (await req("/service-quotes/" + id + "/propose", "owner", proposal)).status,
    200,
  );
  assert.equal(
    (
      await req("/service-quotes/" + id + "/accept", "customer", {
        revision: 1,
      })
    ).status,
    200,
  );
  const body = {
    serviceId: quote.serviceId,
    quoteId: id,
    address: quote.address,
    slot: slotFor(
      new Date(Date.now() + 8 * 86400000).toISOString().slice(0, 10),
      12,
    ),
    idempotencyKey: "quote-tampering-test",
  };
  assert.equal(
    (
      await req("/bookings", "customer", {
        ...body,
        address: { ...quote.address, line: "Different property, Shadnagar" },
      })
    ).status,
    409,
  );
  assert.equal(
    (await req("/bookings", "customer", { ...body, promoCode: "WELCOME" }))
      .status,
    400,
  );
  await application.store.transaction(async (tx) => {
    const q = await tx.get("serviceQuotes", id);
    tx.put("serviceQuotes", { ...q, expiresAt: Date.now() - 1 });
  });
  assert.equal((await req("/bookings", "customer", body)).status, 409);
});

test("laundry API blocks early completion, updates in order, and retains original payment total", async () => {
  const service = await application.store.get("services", quote.serviceId);
  await application.store.transaction(async (tx) =>
    tx.put("services", { ...service, fulfillmentType: "laundry" }),
  );
  const body = {
    serviceId: quote.serviceId,
    address: quote.address,
    slot: slotFor(
      new Date(Date.now() + 9 * 86400000).toISOString().slice(0, 10),
      15,
    ),
    idempotencyKey: "laundry-journey-booking",
  };
  const created = await req("/bookings", "customer", body);
  assert.equal(created.status, 201);
  const b = created.data;
  const act = (role, body) => req("/bookings/" + b.id + "/action", role, body);
  assert.equal((await act("customer", { action: "pay" })).status, 200);
  assert.equal((await act("professional", { action: "accept" })).status, 200);
  assert.equal((await act("professional", { action: "start" })).status, 200);
  assert.equal(
    (
      await act("professional", {
        action: "complete",
        checklist: Array(3 + (b.serviceChecklist?.length || 0)).fill(true),
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await act("customer", {
        action: "laundry",
        stage: "collected",
        revision: 0,
        note: "12 items",
      })
    ).status,
    403,
  );
  let result;
  for (const [revision, stage] of [
    "collected",
    "received",
    "processing",
    "ready",
    "out_for_delivery",
    "delivered",
  ].entries()) {
    result = await act("professional", {
      action: "laundry",
      stage,
      revision,
      note:
        stage === "delivered"
          ? "Handed to customer Ananya"
          : "Sealed bag, 12 items",
    });
    assert.equal(result.status, 200);
  }
  assert.equal(result.data.total, b.total);
  assert.equal(
    (
      await act("professional", {
        action: "complete",
        checklist: Array(3 + (b.serviceChecklist?.length || 0)).fill(true),
        completionNotes: "Delivery acknowledged",
      })
    ).status,
    200,
  );
});

test("quote ownership is checked even for a known id and competing proposals serialize", async () => {
  const { quoteAccess, cleanupServiceQuotes } =
    await import("../server/lib/service-quotes.mjs");
  assert.throws(
    () => quoteAccess({ id: "other-customer", role: "customer" }, quote),
    /not found/,
  );
  const created = await req("/service-quotes", "customer", {
    serviceId: quote.serviceId,
    description: "Please provide a new estimate for the study room.",
    address: quote.address,
  });
  const proposal = {
    revision: 0,
    items: [{ label: "Study room", quantity: 1, unitPrice: 400 }],
    duration: 60,
    scope: "Clean accessible surfaces in study room only.",
    expiresAt: Date.now() + 86400000,
  };
  const results = await Promise.all([
    req("/service-quotes/" + created.data.id + "/propose", "owner", proposal),
    req("/service-quotes/" + created.data.id + "/propose", "owner", {
      ...proposal,
      items: [{ label: "Study room", quantity: 1, unitPrice: 600 }],
    }),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  await application.store.transaction(async (tx) => {
    tx.put("serviceQuotes", {
      id: "private-other",
      customerId: "deleted-user",
      description: "Personal work details",
    });
    await cleanupServiceQuotes(tx, "deleted-user");
  });
  assert.equal(
    await application.store.get("serviceQuotes", "private-other"),
    null,
  );
  assert.ok(await application.store.get("serviceQuotes", quote.id));
});

test("quote request retries are idempotent and changed payloads conflict", async () => {
  const input = {
    idempotencyKey: "new-request-deduplication",
    serviceId: quote.serviceId,
    description: "Please quote a safe new cleaning job for two rooms.",
    address: quote.address,
  };
  const first = await req("/service-quotes", "customer", input),
    retry = await req("/service-quotes", "customer", input);
  assert.equal(first.status, 201);
  assert.equal(retry.data.id, first.data.id);
  assert.equal(
    (
      await req("/service-quotes", "customer", {
        ...input,
        description: "This is changed work using the same request key.",
      })
    ).status,
    409,
  );
});
test("staff can record a physical laundry return without fabricating delivery or partner earnings", async () => {
  const created = await req("/bookings", "customer", {
    serviceId: quote.serviceId,
    address: quote.address,
    slot: slotFor(
      new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10),
      15,
    ),
    idempotencyKey: "laundry-return-job",
  });
  assert.equal(created.status, 201);
  const b = created.data;
  const act = (role, input) =>
    req("/bookings/" + b.id + "/action", role, input);
  for (const [role, action] of [
    ["customer", "pay"],
    ["professional", "accept"],
    ["professional", "start"],
  ])
    assert.equal((await act(role, { action })).status, 200);
  assert.equal(
    (
      await act("professional", {
        action: "laundry",
        stage: "collected",
        revision: 0,
        note: "12 garments, bag sealed",
      })
    ).status,
    200,
  );
  const input = {
    action: "laundry_return",
    revision: 1,
    returned: true,
    note: "Returned all 12 garments to customer Ananya; service cancelled by agreement.",
  };
  assert.equal((await act("professional", input)).status, 403);
  assert.equal((await act("care", { ...input, returned: false })).status, 400);
  const result = await act("care", input);
  assert.equal(result.status, 200);
  assert.equal(result.data.status, "cancelled");
  assert.equal(result.data.refund, "requested");
  assert.equal(result.data.laundry.stage, "returned");
  assert.equal(result.data.total, b.total);
  assert.equal(await application.store.get("ledger", "job_" + b.id), null);
  assert.equal((await act("care", input)).status, 409);
});

test("staff can cancel a started laundry job before custody, without claiming a return", async () => {
  const created = await req("/bookings", "customer", {
    serviceId: quote.serviceId,
    address: quote.address,
    slot: slotFor(
      new Date(Date.now() + 11 * 86400000).toISOString().slice(0, 10),
      15,
    ),
    idempotencyKey: "laundry-before-collection",
  });
  assert.equal(created.status, 201);
  const id = created.data.id;
  const act = (role, action) =>
    req("/bookings/" + id + "/action", role, { action });
  for (const [role, action] of [
    ["customer", "pay"],
    ["professional", "accept"],
    ["professional", "start"],
  ])
    assert.equal((await act(role, action)).status, 200);
  assert.equal((await act("customer", "cancel")).status, 409);
  const cancelled = await act("care", "cancel");
  assert.equal(cancelled.status, 200);
  assert.equal(cancelled.data.refund, "requested");
  assert.equal(cancelled.data.laundry, undefined);
});

import { createHash, randomUUID } from "node:crypto";
import { test, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { createSQLiteStore } from "../server/lib/store.mjs";
import { createApplication } from "../server/app.mjs";
import { config } from "../server/lib/config.mjs";
import { serviceSchema } from "../server/lib/schemas.mjs";
import { serviceSelection } from "../server/lib/service-selection.mjs";
import { slotFor } from "../server/lib/domain.mjs";

let application, server, base, original;
const tokens = {};
const date = new Date(Date.now() + 12 * 86400000).toISOString().slice(0, 10);
const address = {
  line: "42 Garden Street, Shadnagar",
  pin: "509216",
  label: "Home",
};
async function req(path, role = "customer", body, method) {
  const response = await fetch(base + path, {
    method: method || (body ? "POST" : "GET"),
    headers: {
      Authorization: "Bearer " + (tokens[role] || ""),
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, data: await response.json() };
}
const booking = (extra = {}) => ({
  serviceId: "cleaning",
  address,
  slot: slotFor(date, 9),
  idempotencyKey: randomUUID(),
  ...extra,
});
const configured = (extra = {}) => ({
  ...original,
  packageRequired: true,
  excludes: ["Structural repairs"],
  packages: [
    {
      id: "rooms",
      name: "Two rooms",
      price: 1400,
      duration: 90,
      includes: ["Clean two rooms"],
      excludes: ["Balcony"],
    },
  ],
  ...extra,
});
async function save(service) {
  await application.store.transaction(async (tx) =>
    tx.put("services", service),
  );
}
before(async () => {
  application = await createApplication({
    store: await createSQLiteStore(":memory:"),
    config: config({ APP_MODE: "demo", PAYMENT_MODE: "demo" }),
  });
  server = application.app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  base = "http://127.0.0.1:" + server.address().port + "/api";
  for (const role of ["customer", "owner"])
    tokens[role] = (await req("/session", "", { role })).data.token;
  original = await application.store.get("services", "cleaning");
});
beforeEach(async () => save(original));
after(async () => {
  await new Promise((resolve) => server.close(resolve));
  application.store.close();
});

test("schema preserves legacy defaults and package exclusions", () => {
  const legacy = serviceSchema.parse(original);
  assert.equal(legacy.bookingMode, "instant");
  assert.equal(legacy.packageRequired, false);
  assert.equal(legacy.priceUnit, "");
  const service = serviceSchema.parse(
    configured({ priceUnit: "per two room booking" }),
  );
  assert.equal(service.priceUnit, "per two room booking");
  assert.deepEqual(service.packages[0].excludes, ["Balcony"]);
  assert.deepEqual(
    serviceSchema.parse(
      configured({
        packages: [{ ...configured().packages[0], excludes: undefined }],
      }),
    ).packages[0].excludes,
    [],
  );
  assert.equal(
    serviceSchema.safeParse(configured({ bookingMode: "invalid" })).success,
    false,
  );
  assert.equal(
    serviceSchema.safeParse(configured({ priceUnit: "x".repeat(101) })).success,
    false,
  );
});

test("publishing required packages needs packages with useful scope while drafts remain editable", () => {
  assert.equal(
    serviceSchema.safeParse(configured({ packages: [] })).success,
    false,
  );
  assert.equal(
    serviceSchema.safeParse(
      configured({ packages: [{ ...configured().packages[0], includes: [] }] }),
    ).success,
    false,
  );
  assert.equal(
    serviceSchema.safeParse(configured({ active: false, packages: [] }))
      .success,
    true,
  );
});

test("quote-only publication ignores package settings left over from instant booking", () => {
  assert.equal(
    serviceSchema.safeParse(configured({ bookingMode: "quote", packages: [] }))
      .success,
    true,
  );
});

test("required package cannot be skipped through booking, instant quote or availability", async () => {
  await save(configured());
  for (const result of [
    await req("/bookings", "customer", booking()),
    await req("/quote", "customer", { serviceId: "cleaning" }),
    await req(`/availability?serviceId=cleaning&date=${date}`),
  ]) {
    assert.equal(result.status, 400);
    assert.equal(result.data.code, "PACKAGE_REQUIRED");
  }
});

test("tampered package IDs and missing required options still fail", () => {
  assert.throws(() => serviceSelection(configured(), { packageId: "forged" }), {
    code: "INVALID_PACKAGE",
  });
  const service = configured({
    optionGroups: [
      {
        id: "size",
        name: "Size",
        required: true,
        options: [{ id: "large", name: "Large", price: 200, duration: 30 }],
      },
    ],
  });
  assert.throws(() => serviceSelection(service, { packageId: "rooms" }), {
    code: "INVALID_OPTIONS",
  });
  assert.throws(
    () =>
      serviceSelection(service, {
        packageId: "rooms",
        options: { size: "forged" },
      }),
    { code: "INVALID_OPTIONS" },
  );
});

test("booking freezes chosen package price, scope and combined exclusions", async () => {
  await save(configured());
  const result = await req(
    "/bookings",
    "customer",
    booking({
      packageId: "rooms",
      total: 1,
      price: 1,
      exclusions: ["Forged exclusion"],
    }),
  );
  assert.equal(result.status, 201);
  assert.equal(result.data.price, 1400);
  assert.equal(result.data.total, 1400);
  assert.equal(result.data.duration, 90);
  assert.deepEqual(result.data.scope, ["Clean two rooms"]);
  assert.deepEqual(result.data.exclusions, ["Structural repairs", "Balcony"]);
  await save(configured({ excludes: ["Changed later"], packages: [] }));
  const stored = await application.store.get("bookings", result.data.id);
  assert.equal(stored.total, 1400);
  assert.deepEqual(stored.scope, ["Clean two rooms"]);
  assert.deepEqual(stored.exclusions, ["Structural repairs", "Balcony"]);
});

test("legacy services retain direct base pricing and common exclusions", () => {
  const selection = serviceSelection(
    { ...original, excludes: ["Special equipment"] },
    {},
  );
  assert.equal(selection.price, original.price);
  assert.deepEqual(selection.scope, original.includes);
  assert.deepEqual(selection.exclusions, ["Special equipment"]);
});

test("quote-only services reject direct booking, instant quote and availability despite client bypass flags", async () => {
  await save(configured({ bookingMode: "quote" }));
  for (const result of [
    await req(
      "/bookings",
      "customer",
      booking({ packageId: "rooms", acceptedQuote: true, allowQuote: true }),
    ),
    await req("/quote", "customer", {
      serviceId: "cleaning",
      packageId: "rooms",
      allowQuote: true,
    }),
    await req(
      `/availability?serviceId=cleaning&date=${date}&selection=${encodeURIComponent(JSON.stringify({ packageId: "rooms", allowQuote: true }))}`,
    ),
  ]) {
    assert.equal(result.status, 400);
    assert.equal(result.data.code, "QUOTE_REQUIRED");
  }
});

test("only an accepted owned tailored quote books a quote-only service", async () => {
  await save(configured({ bookingMode: "quote" }));
  const requested = await req("/service-quotes", "customer", {
    serviceId: "cleaning",
    address,
    description: "Please quote the whole property with agreed scope.",
    idempotencyKey: randomUUID(),
  });
  assert.equal(requested.status, 201);
  const quoteId = requested.data.id;
  assert.equal(
    (await req("/bookings", "customer", booking({ quoteId }))).status,
    409,
  );
  assert.equal(
    (
      await req(`/service-quotes/${quoteId}/propose`, "owner", {
        revision: 0,
        items: [{ label: "Whole property", quantity: 1, unitPrice: 2300 }],
        duration: 60,
        scope: "Whole property as agreed during inspection.",
        expiresAt: Date.now() + 86400000,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await req(`/service-quotes/${quoteId}/accept`, "customer", {
        revision: 1,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await req(
        "/bookings",
        "customer",
        booking({ quoteId, packageId: "rooms" }),
      )
    ).status,
    400,
  );
  const result = await req(
    "/bookings",
    "customer",
    booking({ quoteId, slot: slotFor(date, 15) }),
  );
  assert.equal(result.status, 201);
  assert.equal(result.data.total, 2300);
  assert.equal(result.data.quoteId, quoteId);
  assert.equal(
    result.data.scope[0],
    "Whole property as agreed during inspection.",
  );
  assert.deepEqual(result.data.exclusions, ["Structural repairs"]);
  assert.equal(
    (await req("/bookings", "customer", booking({ quoteId }))).status,
    409,
  );
});

const quoteQuestions = [
  {
    id: "rooms",
    label: "Number of rooms",
    required: true,
    placeholder: "",
    help: "",
  },
];
const quoteRequest = (extra = {}) => ({
  serviceId: "cleaning",
  address,
  description: "Please inspect and quote all requested rooms.",
  idempotencyKey: randomUUID(),
  ...extra,
});
async function approveQuote(quoteId) {
  assert.equal(
    (
      await req(`/service-quotes/${quoteId}/propose`, "owner", {
        revision: 0,
        items: [{ label: "Agreed work", quantity: 1, unitPrice: 2300 }],
        duration: 60,
        scope: "Work covers all rooms agreed during inspection.",
        expiresAt: Date.now() + 86400000,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await req(`/service-quotes/${quoteId}/accept`, "customer", {
        revision: 1,
      })
    ).status,
    200,
  );
}

test("quote requests validate required questions and reject unknown answer IDs", async () => {
  await save(
    configured({ bookingMode: "quote", bookingFields: quoteQuestions }),
  );
  const missing = await req("/service-quotes", "customer", quoteRequest());
  assert.equal(missing.status, 400);
  assert.equal(missing.data.code, "MISSING_SERVICE_DETAILS");
  const unknown = await req(
    "/service-quotes",
    "customer",
    quoteRequest({ details: { rooms: "Three", forged: "Ignored?" } }),
  );
  assert.equal(unknown.status, 400);
  assert.equal(unknown.data.code, "INVALID_SERVICE_DETAILS");
});

test("approved quote retains submitted answer snapshots through question edits and conversion", async () => {
  await save(
    configured({ bookingMode: "quote", bookingFields: quoteQuestions }),
  );
  const input = quoteRequest({ details: { rooms: "  Three rooms  " } });
  const requested = await req("/service-quotes", "customer", input);
  assert.equal(requested.status, 201);
  assert.deepEqual(requested.data.details, { rooms: "Three rooms" });
  assert.deepEqual(requested.data.serviceDetails, [
    { id: "rooms", label: "Number of rooms", value: "Three rooms" },
  ]);
  const quoteId = requested.data.id;
  assert.equal(
    (await req("/service-quotes", "customer", input)).data.id,
    quoteId,
  );
  assert.equal(
    (
      await req("/service-quotes", "customer", {
        ...input,
        details: { rooms: "Four rooms" },
      })
    ).status,
    409,
  );
  await approveQuote(quoteId);
  await save(
    configured({
      bookingMode: "quote",
      bookingFields: [
        {
          ...quoteQuestions[0],
          id: "inspection",
          label: "New inspection question",
        },
      ],
    }),
  );
  const result = await req(
    "/bookings",
    "customer",
    booking({
      quoteId,
      details: { inspection: "Client tries to replace approved answer" },
      slot: slotFor(date, 18),
    }),
  );
  assert.equal(result.status, 201);
  assert.deepEqual(result.data.details, [
    { id: "rooms", label: "Number of rooms", value: "Three rooms" },
  ]);
  assert.deepEqual(
    (await application.store.get("bookings", result.data.id)).details,
    [{ id: "rooms", label: "Number of rooms", value: "Three rooms" }],
  );
});

test("legacy approved quotes without answer snapshots remain bookable after required questions are added", async () => {
  await save(configured({ bookingMode: "quote" }));
  const requested = await req("/service-quotes", "customer", quoteRequest());
  assert.equal(requested.status, 201);
  const quoteId = requested.data.id;
  await approveQuote(quoteId);
  await application.store.transaction(async (tx) => {
    const quote = await tx.get("serviceQuotes", quoteId);
    delete quote.serviceDetails;
    delete quote.details;
    tx.put("serviceQuotes", quote);
  });
  await save(
    configured({ bookingMode: "quote", bookingFields: quoteQuestions }),
  );
  const result = await req(
    "/bookings",
    "customer",
    booking({ quoteId, slot: slotFor(date, 12) }),
  );
  assert.equal(result.status, 201);
  assert.deepEqual(result.data.details, []);
});

test("quote request retries remain idempotent for legacy requests without details", async () => {
  const input = quoteRequest();
  const requested = await req("/service-quotes", "customer", input);
  assert.equal(requested.status, 201);
  await application.store.transaction(async (tx) => {
    const quote = await tx.get("serviceQuotes", requested.data.id);
    quote.requestHash = createHash("sha256")
      .update(
        JSON.stringify({
          idempotencyKey: input.idempotencyKey,
          serviceId: input.serviceId,
          description: input.description,
          address: input.address,
        }),
      )
      .digest("hex");
    delete quote.details;
    delete quote.serviceDetails;
    tx.put("serviceQuotes", quote);
  });
  const retry = await req("/service-quotes", "customer", input);
  assert.equal(retry.status, 201);
  assert.equal(retry.data.id, requested.data.id);
});

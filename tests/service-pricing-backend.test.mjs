import { test } from "node:test";
import assert from "node:assert/strict";
import { serviceSchema } from "../server/lib/schemas.mjs";
import { minimumServicePrice } from "../server/lib/service-pricing.mjs";

const pack = (id, price, duration) => ({
  id: id.replaceAll(" ", "_"),
  name: id,
  price,
  duration,
  includes: ["Agreed work"],
});
const group = (options, extra = {}) => ({
  id: "required",
  name: "Work size",
  required: true,
  options,
  ...extra,
});
const option = (id, price, duration) => ({
  id: id.replaceAll(" ", "_"),
  name: id,
  price,
  duration,
});
const service = (extra = {}) => ({
  name: "Service care",
  category: "General",
  icon: "tool",
  price: 300,
  duration: 60,
  headline: "Care for your property",
  description: "A scoped service for your property.",
  includes: ["Agreed work"],
  addons: [],
  active: true,
  ...extra,
});

test("publishing rejects instant services whose every required combination exceeds duration", () => {
  const result = serviceSchema.safeParse(
    service({
      packageRequired: true,
      packages: [pack("Long work", 100, 240)],
      optionGroups: [group([option("Required visit", 100, 30)])],
    }),
  );
  assert.equal(result.success, false);
  assert.match(
    result.error.issues.map((issue) => issue.message).join(" "),
    /combination/i,
  );
});

test("publishing rejects required choices that push all prices above the checkout limit", () => {
  assert.equal(
    serviceSchema.safeParse(
      service({
        price: 99950,
        optionGroups: [group([option("Required extra", 100, 0)])],
      }),
    ).success,
    false,
  );
});

test("an over-limit instant configuration remains editable as a draft or quote service", () => {
  const impossible = {
    duration: 240,
    optionGroups: [group([option("Required extra", 100, 30)])],
  };
  assert.equal(
    serviceSchema.safeParse(service({ ...impossible, active: false })).success,
    true,
  );
  assert.equal(
    serviceSchema.safeParse(service({ ...impossible, bookingMode: "quote" }))
      .success,
    true,
  );
});

test("publishing keeps higher valid packages and ignores optional extras that exceed limits", () => {
  assert.equal(
    serviceSchema.safeParse(
      service({
        packageRequired: true,
        packages: [
          pack("Cheap long work", 100, 240),
          pack("Short work", 2000, 60),
        ],
        optionGroups: [
          group([option("Required extra", 100, 30)]),
          group([option("Optional extra", 100000, 120)], {
            id: "optional",
            required: false,
          }),
        ],
      }),
    ).success,
    true,
  );
});

test("public catalog skips legacy unbookable records while Owner can still edit them", async () => {
  const { createSQLiteStore } = await import("../server/lib/store.mjs");
  const { createApplication } = await import("../server/app.mjs");
  const { config } = await import("../server/lib/config.mjs");
  const application = await createApplication({
    store: await createSQLiteStore(":memory:"),
    config: config({ APP_MODE: "demo", PAYMENT_MODE: "demo" }),
  });
  const server = application.app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const base = "http://127.0.0.1:" + server.address().port + "/api";
  try {
    await application.store.transaction(async (tx) => {
      tx.put("services", {
        id: "unbookable-legacy",
        ...service({
          duration: 240,
          optionGroups: [group([option("Required visit", 100, 30)])],
        }),
      });
    });
    const catalog = await fetch(base + "/catalog");
    assert.equal(catalog.status, 200);
    const publicServices = (await catalog.json()).services;
    assert.ok(publicServices.some((item) => item.id === "cleaning"));
    assert.equal(
      publicServices.some((item) => item.id === "unbookable-legacy"),
      false,
    );
    const customerSession = await fetch(base + "/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "customer" }),
    });
    const customerState = await fetch(base + "/state", {
      headers: {
        Authorization: "Bearer " + (await customerSession.json()).token,
      },
    });
    assert.equal(customerState.status, 200);
    assert.equal(
      (await customerState.json()).services.some(
        (item) => item.id === "unbookable-legacy",
      ),
      false,
    );
    const session = await fetch(base + "/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "owner" }),
    });
    const state = await fetch(base + "/state", {
      headers: { Authorization: "Bearer " + (await session.json()).token },
    });
    assert.equal(state.status, 200);
    assert.ok(
      (await state.json()).services.some(
        (item) => item.id === "unbookable-legacy",
      ),
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
    application.store.close();
  }
});

test("minimum price excludes cheap over-duration packages and includes mandatory choice prices", () => {
  assert.equal(
    minimumServicePrice(
      service({
        packageRequired: true,
        packages: [
          pack("Cheap long work", 100, 240),
          pack("Short work", 2000, 60),
        ],
        optionGroups: [group([option("Required extra", 100, 30)])],
      }),
    ),
    2100,
  );
});

test("minimum price keeps faster choices when cheap choices cannot fit later required groups", () => {
  assert.equal(
    minimumServicePrice(
      service({
        duration: 120,
        optionGroups: [
          group([
            option("Cheap long choice", 0, 120),
            option("Fast choice", 700, 0),
          ]),
          group([option("Second required choice", 100, 30)], { id: "second" }),
        ],
      }),
    ),
    1100,
  );
});

test("minimum price respects exact limits, base fallback and absent combinations", () => {
  assert.equal(
    minimumServicePrice(
      service({
        price: 99900,
        duration: 210,
        optionGroups: [group([option("Required extra", 100, 30)])],
      }),
    ),
    100000,
  );
  assert.equal(
    minimumServicePrice(
      service({
        price: 99901,
        duration: 210,
        optionGroups: [group([option("Required extra", 100, 30)])],
      }),
    ),
    null,
  );
  assert.equal(
    minimumServicePrice(
      service({
        duration: 240,
        optionGroups: [group([option("Required extra", 100, 30)])],
      }),
    ),
    null,
  );
  assert.equal(
    minimumServicePrice(service({ packages: [pack("Dear package", 700, 60)] })),
    300,
  );
  assert.equal(
    minimumServicePrice(service({ packageRequired: true, packages: [] })),
    null,
  );
  assert.equal(minimumServicePrice(service({ bookingMode: "quote" })), null);
});

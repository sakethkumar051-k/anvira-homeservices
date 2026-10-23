import { test } from "node:test";
import assert from "node:assert/strict";
import { createApplication } from "../server/app.mjs";
import { createSQLiteStore } from "../server/lib/store.mjs";
import { config } from "../server/lib/config.mjs";

test("home-care HTTP routes enforce authentication, customer roles, ownership and schema boundaries", async (t) => {
  const store = await createSQLiteStore(":memory:");
  const application = await createApplication({
    store,
    config: config({ APP_MODE: "demo", PAYMENT_MODE: "demo" }),
  });
  const server = application.app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    store.close();
  });
  const base = "http://127.0.0.1:" + server.address().port + "/api";
  async function req(path, token, body, method = body ? "POST" : "GET") {
    const response = await fetch(base + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: "Bearer " + token } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return {
      status: response.status,
      data: await response.json(),
      cache: response.headers.get("cache-control"),
    };
  }
  const customer = (await req("/session", "", { role: "customer" })).data.token;
  const owner = (await req("/session", "", { role: "owner" })).data.token;
  const professional = (await req("/session", "", { role: "professional" }))
    .data.token;
  assert.equal((await req("/home-care")).status, 401);
  for (const token of [owner, professional]) {
    assert.equal((await req("/home-care", token)).status, 403);
    assert.equal(
      (await req("/home-care/favorites/ac", token, {}, "PUT")).status,
      403,
    );
  }
  const location = await req("/addresses", customer, {
    label: "Home",
    line: "Customer test home, Shadnagar",
    pin: "509216",
  });
  assert.equal(location.status, 201);
  const addressId = location.data.id;
  assert.equal(
    (await req("/home-care/favorites/ac", customer, {}, "PUT")).status,
    200,
  );
  const created = await req("/home-care/reminders/request-1", customer, {
    serviceId: "ac",
    addressId,
    intervalDays: 90,
    dueAt: Date.now() + 86400000,
  });
  assert.equal(created.status, 201);
  assert.equal(
    (
      await req(
        "/home-care/reminders/" + created.data.id,
        customer,
        { customerId: "forged" },
        "PATCH",
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await req(
        "/home-care/reminders/" + created.data.id,
        customer,
        { status: "paused" },
        "PATCH",
      )
    ).data.status,
    "paused",
  );
  const asset = await req("/home-care/assets/request-1", customer, {
    addressId,
    label: "Main AC",
    category: "Air conditioner",
  });
  assert.equal(asset.status, 201);
  assert.equal(
    (
      await req(
        "/home-care/assets/" + asset.data.id,
        customer,
        { installedAt: "2026-02-30" },
        "PATCH",
      )
    ).status,
    400,
  );
  const passport = await req("/home-care", customer);
  assert.equal(passport.status, 200);
  assert.equal(passport.cache, "no-store");
  assert.deepEqual(passport.data.favorites, ["ac"]);
  assert.equal(passport.data.assets.length, 1);
  assert.equal(
    (
      await req(
        "/home-care/reminders/" + created.data.id,
        customer,
        undefined,
        "DELETE",
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await req(
        "/home-care/assets/" + asset.data.id,
        customer,
        undefined,
        "DELETE",
      )
    ).status,
    200,
  );
  assert.equal(
    (await req("/home-care/favorites/ac", customer, undefined, "DELETE"))
      .status,
    200,
  );
  assert.equal((await req("/home-care", customer)).data.assets.length, 0);
});

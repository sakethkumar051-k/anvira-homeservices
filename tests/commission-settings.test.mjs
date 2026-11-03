import { test } from "node:test";
import assert from "node:assert/strict";
import { createApplication } from "../server/app.mjs";
import { createSQLiteStore } from "../server/lib/store.mjs";
import { config } from "../server/lib/config.mjs";
test("Owner settings preserve slab policy for legacy clients; reject null, duplicates and Care writes", async (t) => {
  const application = await createApplication({
    store: await createSQLiteStore(":memory:"),
    config: config({ APP_MODE: "demo", PAYMENT_MODE: "demo" }),
  });
  const server = application.app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  t.after(async () => {
    await new Promise((r) => server.close(r));
    application.store.close();
  });
  const base = "http://127.0.0.1:" + server.address().port + "/api";
  async function req(path, token, body, method) {
    const r = await fetch(base + path, {
      method: method || (body ? "POST" : "GET"),
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + (token || ""),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: r.status, data: await r.json() };
  }
  const owner = (await req("/session", "", { role: "owner" })).data.token,
    care = (await req("/session", "", { role: "care" })).data.token;
  const { settings } = (await req("/state", owner)).data;
  const tiers = [
    { minAmount: 0, commissionBps: 1000 },
    { minAmount: 1000, commissionBps: 1500 },
    { minAmount: 10000, commissionBps: 2000 },
    { minAmount: 20000, commissionBps: 2500 },
  ];
  await application.store.transaction(async tx=>tx.put("settings",{...settings,id:"company",supportEmail:"support@example.test",currency:"INR",legalAddress:"Client-provided address"}));
  const body = {
    ...settings,
    termsUrl: "https://example.test/terms",
    privacyUrl: "https://example.test/privacy",
    supportPhone: "+919876543210",
    commissionMode: "tiers",
    commissionTiers: tiers,
  };
  assert.equal((await req("/settings", owner, body, "PUT")).status, 200);
  const legacy = { ...body, commissionBps: 2200 };
  delete legacy.commissionMode;
  delete legacy.commissionTiers;
  assert.equal((await req("/settings", owner, legacy, "PUT")).status, 200);
  const current = await application.store.get("settings", "company");
  assert.equal(current.commissionMode, "tiers");
  assert.equal(current.supportEmail,"support@example.test");
  assert.equal(current.currency,"INR");
  assert.equal(current.legalAddress,"Client-provided address");
  assert.deepEqual(current.commissionTiers, tiers);
  assert.equal(
    (await req("/settings", owner, { ...body, commissionMode: null }, "PUT"))
      .status,
    400,
  );
  assert.equal(
    (
      await req(
        "/settings",
        owner,
        { ...body, commissionTiers: [tiers[0], tiers[0]] },
        "PUT",
      )
    ).status,
    400,
  );
  assert.equal((await req("/settings", care, body, "PUT")).status, 403);
});

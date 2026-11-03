import { test } from "node:test";
import assert from "node:assert/strict";
import { createSQLiteStore } from "../server/lib/store.mjs";
import { domain } from "../server/lib/domain.mjs";
import {
  homeCare,
  runHomeCareReminders,
  cleanupHomeCare,
} from "../server/lib/home-care.mjs";

const now = Date.UTC(2026, 9, 22, 8);
const day = 86400000;
const customer = { id: "customer-1", role: "customer" };
async function fixture(t) {
  const store = await createSQLiteStore(":memory:");
  t.after(() => store.close());
  await store.transaction(async (tx) => {
    tx.put("users", { ...customer, active: true });
    tx.put("users", { id: "customer-2", role: "customer", active: true });
    tx.put("services", { id: "ac", name: "AC service", active: true });
    tx.put("services", { id: "inactive", name: "Unavailable", active: false });
    tx.put("services", {
      id: "sample",
      name: "Unapproved sample",
      active: true,
      sample: true,
      sampleReviewed: false,
    });
    tx.put("addresses", {
      id: "address-1",
      customerId: customer.id,
      line: "House one, Shadnagar",
      pin: "509216",
    });
    tx.put("addresses", {
      id: "address-2",
      customerId: "customer-2",
      line: "Private second house",
      pin: "509216",
    });
  });
  const business = domain(store, { live: true });
  return {
    store,
    business,
    care: homeCare(store, business, { live: true }, () => now),
  };
}
const reminder = {
  serviceId: "ac",
  addressId: "address-1",
  intervalDays: 30,
  dueAt: now + day,
};
const asset = {
  addressId: "address-1",
  label: "Bedroom AC",
  category: "Air conditioner",
  model: "Model 1",
  installedAt: "2025-06-01",
  warrantyUntil: "2027-06-01",
};

test("favorites are customer-only, idempotent and never publish inactive or unreviewed services", async (t) => {
  const { care, store } = await fixture(t);
  await assert.rejects(
    () => care.favorite({ id: "owner", role: "owner" }, "ac", true),
    { status: 403 },
  );
  for (const id of ["inactive", "sample", "missing"])
    await assert.rejects(() => care.favorite(customer, id, true), {
      status: 400,
    });
  await Promise.all([
    care.favorite(customer, "ac", true),
    care.favorite(customer, "ac", true),
  ]);
  assert.equal((await store.list("homeCareFavorites")).length, 1);
  assert.deepEqual((await care.read(customer)).favorites, ["ac"]);
  await care.favorite(customer, "ac", false);
  assert.deepEqual((await care.read(customer)).favorites, []);
});
test("reminders require an owned address, valid dates and one schedule per service/address", async (t) => {
  const { care } = await fixture(t);
  await assert.rejects(
    () =>
      care.createReminder(customer, "foreign", {
        ...reminder,
        addressId: "address-2",
      }),
    { status: 404 },
  );
  for (const input of [
    { ...reminder, dueAt: now },
    { ...reminder, intervalDays: 6 },
    { ...reminder, intervalDays: 366 },
    { ...reminder, serviceId: "inactive" },
  ])
    await assert.rejects(() => care.createReminder(customer, "invalid", input));
  const first = await care.createReminder(customer, "request-1", reminder);
  const retry = await care.createReminder(customer, "request-1", reminder);
  assert.equal(first.id, retry.id);
  await assert.rejects(
    () => care.createReminder(customer, "request-2", reminder),
    { status: 409 },
  );
  await assert.rejects(
    () =>
      care.patchReminder({ id: "customer-2", role: "customer" }, first.id, {
        status: "paused",
      }),
    { status: 404 },
  );
});
test("due reminders notify once under concurrent runs, advance without catch-up spam and pause safely", async (t) => {
  const { care, store, business } = await fixture(t);
  const created = await care.createReminder(customer, "request-1", reminder);
  const later = now + 100 * day;
  const runs = await Promise.all([
    runHomeCareReminders(store, business, later),
    runHomeCareReminders(store, business, later),
  ]);
  assert.equal(
    runs.reduce((sum, run) => sum + run.sent, 0),
    1,
  );
  assert.equal((await store.list("notifications")).length, 1);
  assert.equal(
    (await store.get("homeCareReminders", created.id)).dueAt,
    later + 30 * day,
  );
  assert.equal((await store.list("bookings")).length, 0);
  await care.patchReminder(customer, created.id, { status: "paused" });
  assert.equal(
    (await runHomeCareReminders(store, business, later + 60 * day)).sent,
    0,
  );
  await store.transaction(async (tx) => tx.remove("addresses", "address-1"));
  await assert.rejects(
    () => care.patchReminder(customer, created.id, { status: "active" }),
    { status: 404 },
  );
});
test("a due reminder pauses when its customer, service or address becomes unavailable", async (t) => {
  for (const kind of ["users", "services", "addresses"]) {
    const { care, store, business } = await fixture(t);
    const created = await care.createReminder(customer, kind, reminder);
    await store.transaction(async (tx) => {
      const id =
        kind === "users"
          ? customer.id
          : kind === "services"
            ? "ac"
            : "address-1";
      const saved = await tx.get(kind, id);
      if (kind === "addresses") tx.remove(kind, id);
      else tx.put(kind, { ...saved, active: false });
    });
    const result = await runHomeCareReminders(store, business, now + 2 * day);
    assert.equal(result.sent, 0);
    assert.equal(
      (await store.get("homeCareReminders", created.id)).status,
      "paused",
    );
  }
});
test("assets are private editable customer records with real calendar dates and no inferred warranty", async (t) => {
  const { care } = await fixture(t);
  for (const input of [
    { ...asset, installedAt: "2026-02-30" },
    { ...asset, warrantyUntil: "2024-01-01" },
    { ...asset, addressId: "address-2" },
  ])
    await assert.rejects(() => care.createAsset(customer, "bad", input));
  const first = await care.createAsset(customer, "asset-1", asset);
  assert.equal(
    (await care.createAsset(customer, "asset-1", asset)).id,
    first.id,
  );
  const minimal = await care.createAsset(customer, "asset-2", {
    addressId: "address-1",
    label: "Living room fan",
    category: "Fan",
  });
  assert.equal(minimal.warrantyUntil, undefined);
  await assert.rejects(
    () =>
      care.patchAsset({ id: "customer-2", role: "customer" }, first.id, {
        label: "Stolen",
      }),
    { status: 404 },
  );
  assert.equal(
    (await care.patchAsset(customer, first.id, { label: "Main bedroom AC" }))
      .label,
    "Main bedroom AC",
  );
  assert.equal(
    (await care.patchAsset(customer, first.id, { warrantyUntil: null }))
      .warrantyUntil,
    undefined,
  );
  await care.removeAsset(customer, first.id);
  assert.equal((await care.read(customer)).assets.length, 1);
});
test("passport exposes only the latest 200 owned completed bookings grouped by address", async (t) => {
  const { care, store } = await fixture(t);
  await store.transaction(async (tx) => {
    for (let i = 0; i < 201; i++)
      tx.put("bookings", {
        id: "own-" + i,
        customerId: customer.id,
        serviceName: "AC service",
        status: "completed",
        completedAt: now - i,
        slot: now - day,
        address: { line: "House one, Shadnagar", pin: "509216" },
        paymentId: "private-provider-data",
      });
    tx.put("bookings", {
      id: "foreign",
      customerId: "customer-2",
      serviceName: "Secret service",
      status: "completed",
      completedAt: now + day,
      address: { line: "Secret address", pin: "509216" },
    });
    tx.put("bookings", {
      id: "pending",
      customerId: customer.id,
      status: "assigned",
      completedAt: now,
    });
  });
  const result = await care.read(customer);
  assert.equal(result.history.hasMore, true);
  assert.equal(result.history.groups.length, 1);
  assert.equal(result.history.groups[0].bookings.length, 200);
  assert.equal(result.history.groups[0].bookings[0].id, "own-0");
  assert.equal(JSON.stringify(result).includes("private-provider-data"), false);
  assert.equal(JSON.stringify(result).includes("Secret"), false);
});
test("cleanup removes all owned home-care data and fails before writing on oversized accounts", async (t) => {
  const { care, store } = await fixture(t);
  await care.favorite(customer, "ac", true);
  await care.createReminder(customer, "reminder", reminder);
  await care.createAsset(customer, "asset", asset);
  await store.transaction(async (tx) =>
    tx.put("homeCareAssets", { id: "other", customerId: "customer-2" }),
  );
  await store.transaction((tx) => cleanupHomeCare(tx, customer.id));
  assert.equal((await store.list("homeCareFavorites")).length, 0);
  assert.equal((await store.list("homeCareReminders")).length, 0);
  assert.deepEqual(
    (await store.list("homeCareAssets")).map((x) => x.id),
    ["other"],
  );
  await store.transaction(async (tx) => {
    for (let i = 0; i < 201; i++)
      tx.put("homeCareAssets", { id: "large-" + i, customerId: customer.id });
  });
  await assert.rejects(
    () => store.transaction((tx) => cleanupHomeCare(tx, customer.id)),
    { status: 409 },
  );
  assert.equal(
    (await store.list("homeCareAssets", [["customerId", "==", customer.id]]))
      .length,
    201,
  );
});

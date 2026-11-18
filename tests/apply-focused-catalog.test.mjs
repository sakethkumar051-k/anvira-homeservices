import test from "node:test";
import assert from "node:assert/strict";
import { sampleServices } from "../server/lib/sample-catalog.mjs";
import { createSQLiteStore } from "../server/lib/store.mjs";
import { buildFocusedCatalogDraft } from "../scripts/draft-focused-catalog.mjs";
import {
  applyCatalogDraft,
  catalogSnapshotHash,
  readCatalogSnapshot,
} from "../scripts/apply-focused-catalog.mjs";

async function fixture() {
  const store = await createSQLiteStore(":memory:");
  const catalog = sampleServices
    .filter((s) => s.id !== "ro")
    .map((s) => ({
      ...s,
      id: "review-" + s.id,
      sample: s.id !== "ac",
      sampleReviewed: true,
      reviewOnly: true,
    }));
  catalog.push({
    ...catalog[0],
    id: "review-painting",
    name: "Reviewed painting",
    sample: false,
    price: 199,
  });
  await store.transaction(async (tx) => {
    for (const service of catalog) tx.put("services", service);
    tx.put("bookings", {
      id: "runtime",
      status: "awaiting_assignment",
      paymentId: "pay_real_test",
      reviewOnly: true,
    });
    tx.put("settings", {
      id: "company",
      policyEnvironment: "test",
      policyPublished: true,
    });
    tx.put("users", { id: "staff", role: "owner", active: true });
  });
  return { store, draft: buildFocusedCatalogDraft(catalog) };
}
test("catalog application writes six active focus services and preserves runtime bookings, staff and policies", async () => {
  const { store, draft } = await fixture();
  try {
    const before = await readCatalogSnapshot(store);
    await applyCatalogDraft(store, draft, catalogSnapshotHash(before));
    const services = await store.list("services");
    assert.equal(services.filter((s) => s.active).length, 6);
    assert.deepEqual(await store.get("bookings", "runtime"), {
      id: "runtime",
      status: "awaiting_assignment",
      paymentId: "pay_real_test",
      reviewOnly: true,
    });
    assert.deepEqual(await store.get("settings", "company"), {
      id: "company",
      policyEnvironment: "test",
      policyPublished: true,
    });
    assert.deepEqual(await store.get("users", "staff"), {
      id: "staff",
      role: "owner",
      active: true,
    });
    assert.deepEqual(
      await store.get("services", "review-ac"),
      before.find((r) => r.kind === "services" && r.value.id === "review-ac")
        .value,
    );
  } finally {
    store.close();
  }
});
test("catalog beforeHash rejects edited scope even with a fresh overall snapshot", async () => {
  const { store, draft } = await fixture();
  try {
    await store.transaction(async (tx) =>
      tx.put("services", {
        ...(await tx.get("services", "review-cleaning")),
        description:
          "A newly edited service scope that must not be overwritten.",
      }),
    );
    const fresh = await readCatalogSnapshot(store);
    await assert.rejects(
      applyCatalogDraft(store, draft, catalogSnapshotHash(fresh)),
      /catalog changed/i,
    );
    assert.equal(await store.get("services", "review-ro"), null);
  } finally {
    store.close();
  }
});
test("whole-recordset guard rejects a new runtime booking after backup without touching catalog", async () => {
  const { store, draft } = await fixture();
  try {
    const before = await readCatalogSnapshot(store);
    await store.transaction(async (tx) =>
      tx.put("bookings", { id: "new-runtime", status: "payment_pending" }),
    );
    await assert.rejects(
      applyCatalogDraft(store, draft, catalogSnapshotHash(before)),
      /database changed/i,
    );
    assert.equal(await store.get("services", "review-ro"), null);
    assert.equal(
      (await store.get("bookings", "new-runtime")).status,
      "payment_pending",
    );
  } finally {
    store.close();
  }
});

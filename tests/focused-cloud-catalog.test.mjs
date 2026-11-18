import test from "node:test";
import assert from "node:assert/strict";
import { buildFocusedCatalogDraft } from "../scripts/draft-focused-catalog.mjs";
import { sampleServices } from "../server/lib/sample-catalog.mjs";

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
  category: "Painting",
  price: 199,
  sample: false,
});

test("catalog draft preserves reviewed AC and archives reviewed painting without losing its scope or price", () => {
  const draft = buildFocusedCatalogDraft(catalog);
  const ac = catalog.find((s) => s.id === "review-ac");
  assert.deepEqual(
    draft.after.find((s) => s.id === "review-ac"),
    ac,
  );
  const painting = catalog.find((s) => s.id === "review-painting");
  assert.deepEqual(
    draft.after.find((s) => s.id === painting.id),
    { ...painting, active: false },
  );
  assert.equal(
    draft.operations.some((o) => o.id === "review-ac"),
    false,
  );
  assert.equal(
    draft.operations.some((o) => o.action === "delete"),
    false,
  );
});
test("unapproved focus services use quote-only booking and the draft creates RO without a public fixed price", () => {
  const draft = buildFocusedCatalogDraft(catalog);
  assert.deepEqual(
    draft.after
      .filter((s) => s.active)
      .map((s) => s.id)
      .sort(),
    [
      "review-ac",
      "review-car-cleaning",
      "review-cleaning",
      "review-electrical",
      "review-plumbing",
      "review-ro",
    ],
  );
  for (const id of [
    "review-car-cleaning",
    "review-cleaning",
    "review-electrical",
    "review-plumbing",
    "review-ro",
  ]) {
    const service = draft.after.find((s) => s.id === id);
    assert.equal(service.bookingMode, "quote");
    assert.doesNotMatch(
      service.description + service.headline + service.name,
      /SAMPLE|fictional|₹\d|REVIEW ONLY/i,
    );
  }
  assert.ok(
    draft.operations.every(
      (o) => o.before === null || o.beforeHash.length === 64,
    ),
  );
  assert.ok(draft.operations.every((o) => o.after.id === o.id));
});
test("a non-sample extra category is never archived silently", () => {
  assert.throws(
    () =>
      buildFocusedCatalogDraft([
        ...catalog,
        {
          ...catalog[0],
          id: "real-custom",
          category: "Other",
          sample: false,
          reviewOnly: false,
        },
      ]),
    /non-review|custom/i,
  );
});

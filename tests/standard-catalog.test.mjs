import { test } from "node:test";
import assert from "node:assert/strict";
import { standardServices } from "../server/lib/standard-catalog.mjs";
import { serviceSchema } from "../server/lib/schemas.mjs";
import { serviceSelection } from "../server/lib/service-selection.mjs";
import { cartSelection } from "../src/lib/visit-cart.ts";

test("six standard menus cover all launch categories with real bookable choices", () => {
  assert.equal(standardServices.length, 6);
  assert.equal(new Set(standardServices.map((s) => s.category)).size, 6);
  for (const s of standardServices) {
    assert.equal(serviceSchema.safeParse(s).success, true, s.id);
    assert.equal(s.bookingMode, "instant");
    assert.equal(s.billingPeriod, "one_time");
    assert.equal(s.packageRequired, true);
    assert.ok(s.packages.length >= 4);
    assert.ok(s.nameTe && s.descriptionTe);
    assert.equal(s.optionGroups.length, 0);
    for (const p of s.packages) {
      const input = { packageId: p.id, addons: [], options: {} };
      const quote = serviceSelection(s, input);
      assert.equal(quote.subtotal, p.price);
      assert.ok(quote.duration <= 240);
      assert.ok(
        p.description.length > 20 &&
          p.includes.length >= 2 &&
          p.excludes.length >= 1,
        p.id,
      );
      const cart = cartSelection(s, {
        packageId: p.id,
        addon: [],
        options: {},
      });
      assert.equal(cart.complete, true);
      assert.equal(cart.subtotal, quote.subtotal);
      assert.equal(cart.chosenAddons.length, 0);
      const extras = s.addons.filter((a) => a.packageIds.includes(p.id));
      const withExtras = serviceSelection(s, {
        ...input,
        addons: extras.map((a) => a.id),
      });
      assert.ok(
        withExtras.duration <= 240,
        p.id + " extras exceed visit length",
      );
      for (const a of s.addons.filter((a) => !a.packageIds.includes(p.id)))
        assert.throws(
          () => serviceSelection(s, { ...input, addons: [a.id] }),
          /available/,
        );
    }
  }
});

test("inspection and labour-only work disclose that parts are excluded", () => {
  for (const id of [
    "review-ac",
    "review-ro",
    "review-plumbing",
    "review-electrical",
  ]) {
    const service = standardServices.find((s) => s.id === id);
    assert.ok(service.packages.some((p) => /check|sure/i.test(p.name)));
    for (const pack of service.packages)
      assert.match(
        pack.excludes.join(" "),
        /parts|material|filters|gas|fittings|fixture|wiring/i,
        pack.id,
      );
  }
});

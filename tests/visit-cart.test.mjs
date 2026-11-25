import assert from "node:assert/strict";
import { test } from "node:test";
import { serviceSelection } from "../server/lib/service-selection.mjs";
import { cartSelection } from "../src/lib/visit-cart.ts";

const service = {
  price: 200,
  duration: 30,
  maxQuantity: 3,
  quantityUnit: "bathroom",
  packages: [{ id: "intensive", name: "Intensive", duration: 60, price: 350 }],
  optionGroups: [
    {
      id: "floor",
      name: "Floor",
      required: true,
      options: [{ id: "stone", name: "Stone", price: 40, duration: 30 }],
    },
  ],
  addons: [
    {
      id: "fan",
      name: "Extra fan",
      price: 60,
      duration: 30,
      packageIds: ["intensive"],
    },
    { id: "door", name: "Extra door", price: 45, packageIds: [""] },
    { id: "old", name: "Unavailable extra", price: 50, enabled: false },
  ],
};

test("cart, quote, availability and booking agree on per-unit work and per-visit extras", () => {
  const selection = {
    packageId: "intensive",
    quantity: 2,
    options: { floor: "stone" },
    addons: ["fan"],
  };
  const cart = cartSelection(service, {
    ...selection,
    addon: selection.addons,
  });
  const checked = serviceSelection(service, selection);
  assert.equal(cart.complete, true);
  assert.equal(cart.count, 2);
  assert.equal(checked.subtotal, 840);
  assert.equal(checked.duration, 210);
  assert.equal(cart.subtotal, checked.subtotal);
  assert.equal(cart.duration, checked.duration);
  assert.deepEqual(
    cart.availableAddons.map((a) => a.id),
    ["fan"],
  );
});

test("checkout rejects duplicate, disabled and incompatible extras plus excess quantity and duration", () => {
  const input = {
    packageId: "intensive",
    quantity: 2,
    options: { floor: "stone" },
  };
  for (const addons of [["fan", "fan"], ["old"], ["door"], ["unknown"]])
    assert.throws(() => serviceSelection(service, { ...input, addons }), {
      code: "INVALID_ADDONS",
    });
  assert.throws(() => serviceSelection(service, { ...input, quantity: 4 }), {
    code: "INVALID_QUANTITY",
  });
  assert.throws(() => serviceSelection(service, { ...input, quantity: 3 }), {
    code: "SELECTION_LIMIT",
  });
  const base = serviceSelection(service, {
    ...input,
    packageId: undefined,
    addons: ["door"],
  });
  assert.equal(base.subtotal, 525);
});

test("a legacy service defaults to one unit and its existing service-wide extras", () => {
  const old = {
    price: 120,
    duration: 30,
    addons: [{ id: "extra", name: "Extra", price: 15 }],
  };
  assert.equal(serviceSelection(old, { addons: ["extra"] }).subtotal, 135);
  assert.throws(() => serviceSelection(old, { quantity: 2 }), {
    code: "INVALID_QUANTITY",
  });
});

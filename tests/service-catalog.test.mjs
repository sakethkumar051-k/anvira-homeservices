import { test } from "node:test";
import assert from "node:assert/strict";
import {
  servicePricing,
  filterServices,
  serviceCategories,
  selectionProblem,
} from "../src/lib/service-catalog.ts";
const base = {
  id: "one",
  name: "Appliance care",
  category: "Repairs",
  description: "Service for one appliance",
  price: 500,
  duration: 60,
  active: true,
  includes: ["One unit"],
  addons: [],
};
test("required packages exclude the cheap base from starting price and require explicit selection", () => {
  const s = {
    ...base,
    packageRequired: true,
    packages: [
      {
        id: "large",
        name: "Large job",
        price: 3000,
        duration: 120,
        includes: ["Large unit"],
      },
      {
        id: "small",
        name: "Small job",
        price: 1000,
        duration: 60,
        includes: ["Small unit"],
      },
    ],
    optionGroups: [
      {
        id: "type",
        name: "Appliance type",
        required: true,
        options: [{ id: "one", price: 200, duration: 0 }],
      },
    ],
  };
  assert.equal(servicePricing(s).minimum, 1200);
  assert.equal(
    selectionProblem(s, "", {}, {}),
    "Choose a package for this service.",
  );
  assert.equal(selectionProblem(s, "small", { type: "one" }, {}), "");
  assert.match(
    selectionProblem(s, "retired", { type: "one" }, {}),
    /available package/i,
  );
});
test("quote-only services never advertise a placeholder price", () => {
  const s = { ...base, bookingMode: "quote", price: 1 };
  assert.equal(servicePricing(s).minimum, null);
  assert.equal(servicePricing(s).quoteOnly, true);
  assert.match(selectionProblem(s, "", {}, {}), /quote/i);
});
test("categories and search are service-driven, preserve Telugu, ignore case and hide drafts", () => {
  const services = [
    base,
    { ...base, id: "two", name: "కార్ శుభ్రత", category: "Vehicle care" },
    { ...base, id: "three", category: "repairs" },
    { ...base, id: "draft", category: "Hidden", active: false },
  ];
  assert.deepEqual(serviceCategories(services), ["Repairs", "Vehicle care"]);
  assert.deepEqual(
    filterServices(services, {
      category: "REPAIRS",
      query: "appliance",
      sort: "recommended",
    }).map((s) => s.id),
    ["one", "three"],
  );
  assert.equal(
    filterServices(services, {
      query: "కార్",
      category: "",
      sort: "recommended",
    })[0].id,
    "two",
  );
  assert.equal(
    filterServices(services, {
      query: "nothing",
      category: "",
      sort: "recommended",
    }).length,
    0,
  );
});
test("price sorting uses required-package and required-option prices and keeps quote-only last", () => {
  const services = [
    { ...base, id: "quote", bookingMode: "quote", price: 1 },
    { ...base, id: "standard", price: 1200 },
    {
      ...base,
      id: "required",
      price: 100,
      packageRequired: true,
      packages: [{ id: "p", price: 2000, duration: 60, includes: ["work"] }],
    },
  ];
  assert.deepEqual(
    filterServices(services, {
      category: "",
      query: "",
      sort: "price_low",
    }).map((s) => s.id),
    ["standard", "required", "quote"],
  );
  assert.deepEqual(
    filterServices(services, {
      category: "",
      query: "",
      sort: "price_high",
    }).map((s) => s.id),
    ["required", "standard", "quote"],
  );
});
test("selection validation detects required answers and invalid options across any service", () => {
  const s = {
    ...base,
    optionGroups: [
      {
        id: "size",
        name: "Load size",
        required: true,
        options: [{ id: "light", price: 0, duration: 0 }],
      },
    ],
    bookingFields: [{ id: "item", label: "Item details", required: true }],
  };
  assert.match(selectionProblem(s, "", {}, {}), /Load size/);
  assert.match(selectionProblem(s, "", { size: "old" }, {}), /Load size/);
  assert.match(selectionProblem(s, "", { size: "light" }, {}), /Item details/);
  assert.equal(
    selectionProblem(s, "", { size: "light" }, { item: "Two bags" }),
    "",
  );
});

test("starting price uses only combinations within booking time and total limits", () => {
  const s = {
    ...base,
    packageRequired: true,
    packages: [
      { id: "long", price: 1000, duration: 240, includes: ["Long work"] },
      { id: "short", price: 2000, duration: 60, includes: ["Short work"] },
    ],
    optionGroups: [
      {
        id: "extra",
        required: true,
        options: [
          { id: "o", name: "Required finish", price: 100, duration: 30 },
        ],
      },
    ],
  };
  assert.equal(servicePricing(s).minimum, 2100);
  assert.equal(
    servicePricing({ ...s, packages: [s.packages[0]] }).minimum,
    null,
  );
  assert.equal(
    servicePricing({ ...base, price: 99999, optionGroups: s.optionGroups })
      .minimum,
    null,
  );
});

test("catalog and server price floors agree with exhaustive valid combinations", async () => {
  const { minimumServicePrice } =
    await import("../server/lib/service-pricing.mjs");
  let seed = 31;
  const rand = (n) => (seed = (seed * 16807) % 2147483647) % n;
  for (let i = 0; i < 120; i++) {
    const packages = Array.from({ length: 3 }, (_, j) => ({
      id: "p" + j,
      price: 1 + rand(100000),
      duration: (1 + rand(8)) * 30,
      includes: ["Work"],
    }));
    const groups = Array.from({ length: 3 }, (_, j) => ({
      id: "g" + j,
      required: rand(2) === 1,
      options: Array.from({ length: 2 }, (_, k) => ({
        id: "o" + k,
        price: rand(40000),
        duration: rand(5) * 30,
      })),
    }));
    const s = {
      ...base,
      price: 1 + rand(100000),
      duration: (1 + rand(8)) * 30,
      packageRequired: rand(2) === 1,
      packages,
      optionGroups: groups,
    };
    let combinations = [
      ...(!s.packageRequired ? [{ price: s.price, duration: s.duration }] : []),
      ...packages,
    ];
    for (const group of groups.filter((g) => g.required))
      combinations = combinations.flatMap((b) =>
        group.options.map((o) => ({
          price: b.price + o.price,
          duration: b.duration + o.duration,
        })),
      );
    const values = combinations
      .filter((b) => b.price <= 100000 && b.duration <= 240)
      .map((b) => b.price);
    const expected = values.length ? Math.min(...values) : null;
    assert.equal(servicePricing(s).minimum, expected);
    assert.equal(minimumServicePrice(s), expected);
  }
});

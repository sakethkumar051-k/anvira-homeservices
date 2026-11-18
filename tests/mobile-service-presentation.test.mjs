import test from "node:test";
import assert from "node:assert/strict";
import { sampleServices } from "../server/lib/sample-catalog.mjs";
import {
  categoryServices,
  mainServiceCategories,
  serviceCategoryKey,
} from "../src/lib/service-presentation.ts";

const service = (id, name, category, active = true) => ({
  id,
  name,
  category,
  active,
});

test("mobile discovery keeps legacy laundry and commercial cleaning out of the six household categories", () => {
  const unrelated = [
    service("laundry", "Laundry & dry cleaning", "Cleaning"),
    service("commercial", "Commercial cleaning", "Cleaning"),
    service("office-care", "Office cleaning", "Cleaning"),
    service("beauty", "Beauty & makeup", "Personal care"),
    service("painting", "Painting consultation", "Painting"),
  ];
  for (const row of unrelated)
    assert.equal(serviceCategoryKey(row), "other", row.id);
  assert.deepEqual(categoryServices(unrelated, "home"), []);
});

test("mobile discovery retains every core service and residential cleaning scope, without inactive services", () => {
  assert.deepEqual(
    mainServiceCategories.map(({ id }) => id),
    ["home", "car", "ac", "ro", "plumbing", "electrical"],
  );
  for (const category of mainServiceCategories) {
    assert.ok(
      categoryServices(sampleServices, category.id).length > 0,
      category.id,
    );
  }
  for (const row of [
    service("sofa-care", "Sofa & upholstery care", "Cleaning"),
    service("bathroom", "Bathroom cleaning", "Home care"),
    service("kitchen", "Kitchen deep cleaning", "Home care"),
  ])
    assert.equal(serviceCategoryKey(row), "home", row.id);
  assert.deepEqual(
    categoryServices(
      [service("cleaning", "Home cleaning", "Cleaning", false)],
      "home",
    ),
    [],
  );
});

import test from "node:test";
import assert from "node:assert/strict";
import {
  categoryForService,
  discoverServices,
  categoryTopics,
} from "../src/lib/marketplace.ts";
const service = (id, name, category, active = true) => ({
  id,
  name,
  category,
  active,
  description: "",
  packages: [],
});
test("marketplace classifies RO and subcategory cleaning without treating generic care as car cleaning", () => {
  assert.equal(
    categoryForService(
      service("water-purifier", "RO filter replacement", "Appliances"),
    ),
    "ro",
  );
  assert.equal(
    categoryForService(
      service("bathroom", "Bathroom deep cleaning", "Cleaning"),
    ),
    "home",
  );
  assert.equal(
    categoryForService(
      service("car-cleaning", "Doorstep car wash", "Vehicle care"),
    ),
    "car",
  );
  assert.equal(
    categoryForService(
      service("laundry", "Laundry & dry cleaning", "Cleaning"),
    ),
    null,
  );
  assert.equal(
    categoryForService(service("commercial", "Office cleaning", "Commercial")),
    null,
  );
  assert.equal(
    categoryForService(service("care", "Beauty care", "Personal care")),
    null,
  );
});
test("marketplace search includes package names, excludes unpublished or unrelated services and respects category", () => {
  const services = [
    service("cleaning", "Home cleaning", "Cleaning"),
    service("car-cleaning", "Car cleaning", "Vehicle care"),
    service("ac", "AC repair", "Repairs", false),
    service("beauty", "Beauty care", "Personal care"),
  ];
  services[0].packages = [{ name: "Kitchen degreasing" }];
  assert.deepEqual(
    discoverServices(services, "", "kitchen").map((x) => x.id),
    ["cleaning"],
  );
  assert.deepEqual(
    discoverServices(services, "home", "car").map((x) => x.id),
    [],
  );
  assert.deepEqual(
    discoverServices(services).map((x) => x.id),
    ["cleaning", "car-cleaning"],
  );
});
test("category information is still useful without a published catalogue", () => {
  assert.deepEqual(discoverServices([]), []);
  for (const id of ["home", "car", "ac", "ro", "plumbing", "electrical"]) {
    assert.ok(categoryTopics[id].length >= 3);
    assert.ok(
      categoryTopics[id].every((x) => x.title && x.description && x.image),
    );
  }
});
test("a fresh explicit package selection wins over a saved checkout draft and retired packages are ignored", async () => {
  const { checkoutPackageChoice } = await import("../src/lib/marketplace.ts");
  const available = ["small", "large"];
  assert.equal(checkoutPackageChoice(available, "large", "small"), "large");
  assert.equal(checkoutPackageChoice(available, "retired", "small"), "small");
  assert.equal(checkoutPackageChoice(available, undefined, "retired"), "");
});

test("web and native agree on owner-authored household service categories", async () => {
  const { serviceCategoryKey } = await import("../src/lib/service-presentation.ts");
  const cases = [
    [service("ac-filter", "AC filter cleaning", "AC repair"), "ac"],
    [service("office", "Office cleaning", "Cleaning"), null],
    [service("socket", "Socket repair", "Repairs"), "electrical"],
    [service("pipe", "Pipe repair", "Home repairs"), "plumbing"],
    [service("salon", "Salon cleaning", "Personal care"), null],
    [service("handyman", "Handyman cleaning", "Repairs"), null],
  ];
  for (const [row, expected] of cases) {
    assert.equal(categoryForService(row), expected, row.name);
    assert.equal(serviceCategoryKey(row), expected || "other", row.name);
  }
});

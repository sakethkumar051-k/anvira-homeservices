import test from "node:test";
import assert from "node:assert/strict";
import { sampleServices } from "../server/lib/sample-catalog.mjs";
import { marketingServices } from "../src/lib/marketing.ts";
import { serviceSchema } from "../server/lib/schemas.mjs";
import { serviceSelection } from "../server/lib/service-selection.mjs";

test("the six core services expose bookable, scoped packages including RO care", () => {
  assert.deepEqual(
    sampleServices.map((s) => s.id),
    ["cleaning", "car-cleaning", "ac", "ro", "plumbing", "electrical"],
  );
  for (const service of sampleServices) {
    serviceSchema.parse(service);
    assert.equal(service.sample, true);
    assert.ok(service.packages.length >= 2, service.id);
    for (const pack of service.packages) {
      assert.ok(pack.includes.length > 0);
      const selection = serviceSelection(service, {
        packageId: pack.id,
        options: Object.fromEntries(
          (service.optionGroups || [])
            .filter((g) => g.required)
            .map((g) => [g.id, g.options[0].id]),
        ),
      });
      assert.ok(selection.subtotal > 0 && selection.duration <= 240);
    }
  }
  const ro = sampleServices.find((s) => s.id === "ro");
  assert.ok(ro.excludes.some((line) => /filter|membrane/i.test(line)));
});
test("public discovery offers exactly the six requested services without advertising demo prices", () => {
  assert.deepEqual(
    marketingServices.map((s) => s.id),
    ["home", "car", "ac", "ro", "plumbing", "electrical"],
  );
  assert.deepEqual(
    marketingServices.map((s) => s.image),
    ["cleaning", "car", "ac", "ro", "plumbing", "electrical"],
  );
  assert.ok(marketingServices.every((s) => !/₹\d/.test(s.price)));
});

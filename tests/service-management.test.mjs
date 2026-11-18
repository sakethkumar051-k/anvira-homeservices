import test from "node:test";
import assert from "node:assert/strict";
import {
  validateServiceConfiguration,
  ownerSetupProgress,
} from "../src/lib/service-management.ts";
test("required packages cannot be saved empty, but legacy optional base remains valid", () => {
  assert.equal(validateServiceConfiguration({}), "");
  assert.match(
    validateServiceConfiguration({
      active: true,
      packageRequired: true,
      packages: [],
    }),
    /package/i,
  );
  assert.equal(
    validateServiceConfiguration({
      packageRequired: true,
      active: true,
      packages: [{ id: "a", includes: ["Defined work"] }],
    }),
    "",
  );
});
test("setup uses published reviewed services and active staff rather than draft or disabled records", () => {
  const progress = ownerSetupProgress({
    services: [
      { active: true, sample: true, sampleReviewed: false },
      { active: false },
    ],
    staff: [{ role: "care", active: false }],
    settings: { pins: [] },
    professionals: [],
  });
  assert.deepEqual(progress, [false, false, false, false]);
  assert.deepEqual(
    ownerSetupProgress({
      services: [{ active: true }],
      staff: [{ role: "care", active: true }],
      settings: { pins: ["500001"] },
      professionals: [
        { accountless: true, active: true, skills: ["s"], pins: ["500001"] },
      ],
    }),
    [true, true, true, true],
  );
});

test("draft and quote-only services can be saved before packages are finished", () => {
  assert.equal(
    validateServiceConfiguration({ active: false, packageRequired: true }),
    "",
  );
  assert.equal(
    validateServiceConfiguration({
      active: true,
      bookingMode: "quote",
      packageRequired: true,
    }),
    "",
  );
  assert.match(
    validateServiceConfiguration({
      active: true,
      packageRequired: true,
      packages: [{ id: "p", includes: [] }],
    }),
    /included work/i,
  );
});

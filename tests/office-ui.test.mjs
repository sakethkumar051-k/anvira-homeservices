import test from "node:test";
import assert from "node:assert/strict";
import {
  staffNavigation,
  validateServiceBasics,
  workerFormPayload,
} from "../src/lib/office-ui.ts";

test("mobile staff navigation keeps operations available and excludes business configuration", () => {
  const owner = staffNavigation("owner", "ios").map(([key]) => key);
  for (const key of ["bookings", "workers", "support"])
    assert.ok(owner.includes(key));
  for (const key of ["services", "settings", "offers", "payouts", "vendors"])
    assert.ok(!owner.includes(key));
  assert.ok(
    staffNavigation("owner", "web").some(([key]) => key === "services"),
  );
  assert.ok(
    !staffNavigation("care", "web").some(([key]) => key === "settings"),
  );
  assert.deepEqual(staffNavigation("customer", "web"), []);
});

const service = {
  name: "Deep cleaning",
  category: "Cleaning",
  description: "Cleaning all requested rooms.",
  price: 850,
  duration: 60,
  includes: ["Floor cleaning"],
};
test("service basics reject empty scope and invalid money before save", () => {
  assert.equal(validateServiceBasics(service), "");
  assert.match(validateServiceBasics({ ...service, name: "  " }), /name/i);
  assert.match(validateServiceBasics({ ...service, price: NaN }), /price/i);
  assert.match(validateServiceBasics({ ...service, price: 0 }), /price/i);
  assert.match(validateServiceBasics({ ...service, price: 500.5 }), /price/i);
  assert.match(
    validateServiceBasics({ ...service, duration: 45 }),
    /duration/i,
  );
  assert.match(
    validateServiceBasics({ ...service, includes: ["  "] }),
    /included/i,
  );
});

test("worker form normalizes coverage and never constructs login credentials", () => {
  const payload = workerFormPayload({
    name: "  Ravi Kumar  ",
    phone: "9876543210",
    skills: ["cleaning"],
    pins: "509216, 509216, 500001",
    active: true,
    available: false,
    days: [1, 2],
    hours: [9, 12],
    blockedDates: "2026-11-10",
  });
  assert.equal(payload.name, "Ravi Kumar");
  assert.deepEqual(payload.pins, ["509216", "500001"]);
  assert.deepEqual(payload.schedule, {
    days: [1, 2],
    hours: [9, 12],
    blockedDates: ["2026-11-10"],
  });
  assert.equal(payload.available, false);
  assert.equal("email" in payload, false);
  assert.equal("password" in payload, false);
  assert.throws(
    () =>
      workerFormPayload({
        name: "Ravi",
        skills: [],
        pins: "509216",
        days: [1],
        hours: [9],
      }),
    /service/i,
  );
  assert.throws(
    () =>
      workerFormPayload({
        name: "Ravi",
        skills: ["cleaning"],
        pins: "invalid",
        days: [1],
        hours: [9],
      }),
    /PIN/i,
  );
});

import test from "node:test";
import assert from "node:assert/strict";
import { quoteValidation } from "../src/lib/form-validation.ts";
const valid = {
  service: {
    id: "car",
    active: true,
    bookingFields: [{ id: "model", label: "Car model", required: true }],
  },
  description: "Wash the car every Monday.",
  line: "42 Garden Street",
  pin: "509216",
  allowedPins: ["509216"],
  details: { model: "Tata Nexon" },
};
test("monthly request explains every missing field and clears after correction", () => {
  const errors = quoteValidation({
    ...valid,
    description: "",
    line: "",
    pin: "",
    details: {},
  });
  assert.deepEqual(Object.keys(errors), [
    "description",
    "model",
    "line",
    "pin",
  ]);
  assert.match(errors.description, /15/);
  assert.match(errors.model, /Car model/);
  assert.match(errors.line, /8/);
  assert.match(errors.pin, /6/);
  assert.deepEqual(quoteValidation(valid), {});
});
test("quotation validation rejects unsupported PIN, hidden unpublished service and overlong input", () => {
  assert.match(quoteValidation({ ...valid, pin: "500001" }).pin, /unavailable/);
  assert.match(
    quoteValidation({ ...valid, service: { ...valid.service, active: false } })
      .service,
    /available/,
  );
  assert.match(
    quoteValidation({ ...valid, description: "a".repeat(2001) }).description,
    /2,000/,
  );
  assert.deepEqual(
    quoteValidation({ ...valid, details: { model: "  " } }).model,
    "Enter Car model (at least 2 characters).",
  );
});

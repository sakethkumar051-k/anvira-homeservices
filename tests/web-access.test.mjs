import { test } from "node:test";
import assert from "node:assert/strict";
import { assertStaffWorkspace } from "../src/lib/web-access.ts";
test("website portal accepts approved staff roles and rejects customer/unknown roles", () => {
  for (const role of ["owner", "care"])
    assert.doesNotThrow(() => assertStaffWorkspace(role, true));
  for (const role of ["customer", "professional", "", "administrator"])
    assert.throws(
      () => assertStaffWorkspace(role, true),
      (e) => e.code === "STAFF_ONLY",
    );
  assert.doesNotThrow(() => assertStaffWorkspace("customer", false));
});

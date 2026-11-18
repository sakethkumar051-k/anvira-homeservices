import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateEmail,
  validateRegistration,
  signInError,
} from "../src/lib/sign-in.ts";
test("email registration rejects bad emails, short passwords and mismatches before creating an account", () => {
  for (const email of ["", "not-an-email", "a b@example.com", "a@example"])
    assert.throws(() => validateEmail(email));
  validateEmail("  customer@example.com  ");
  assert.throws(
    () => validateRegistration("A", "password123", "password123"),
    /name/,
  );
  assert.throws(
    () => validateRegistration("Ananya", "short", "short"),
    /8 characters/,
  );
  assert.throws(
    () => validateRegistration("Ananya", "password123", "different123"),
    /match/,
  );
  validateRegistration("Ananya", "password123", "password123");
});
test("sign-in errors offer recovery for blocked Google popups, duplicate accounts and invalid credentials", () => {
  assert.match(signInError({ code: "auth/popup-blocked" }), /Allow pop-ups/);
  assert.match(
    signInError({ code: "auth/email-already-in-use" }),
    /Sign in or reset/,
  );
  assert.match(
    signInError({ code: "auth/account-exists-with-different-credential" }),
    /existing method/,
  );
  assert.match(
    signInError({ code: "auth/invalid-credential" }),
    /email or password/,
  );
  assert.match(
    signInError({ code: "auth/unauthorized-domain" }),
    /email\/password/,
  );
  assert.match(signInError(null), /try again/);
});

import * as phone from "../src/lib/sign-in.ts";
test("phone sign-in accepts Indian mobile formats and rejects invalid numbers before requesting SMS", () => {
  for (const value of ["9876543210", "+91 98765 43210", "91-98765-43210"])
    assert.equal(phone.normalizeMobileNumber?.(value), "+919876543210");
  for (const value of [
    "",
    "12345",
    "1234567890",
    "+449876543210",
    "98765432101",
  ])
    assert.throws(() => phone.normalizeMobileNumber?.(value), /10-digit/);
  assert.equal(phone.validateVerificationCode?.("123 456"), "123456");
  for (const value of ["", "12345", "1234567", "12a456"])
    assert.throws(() => phone.validateVerificationCode?.(value), /6-digit/);
});
test("phone failures explain expired codes, delivery quotas and app verification recovery", () => {
  assert.match(
    signInError({ code: "auth/invalid-verification-code" }),
    /code.*incorrect/i,
  );
  assert.match(signInError({ code: "auth/code-expired" }), /new code/i);
  assert.match(signInError({ code: "auth/quota-exceeded" }), /SMS.*limit/i);
  assert.match(
    signInError({ code: "auth/billing-not-enabled" }),
    /SMS.*available/i,
  );
});
test("customer sign-in returns only to approved internal booking routes", () => {
  assert.equal(
    phone.customerReturnTo?.("/checkout/cleaning"),
    "/checkout/cleaning",
  );
  assert.equal(
    phone.customerReturnTo?.("/service/ac-service"),
    "/service/ac-service",
  );
  assert.equal(
    phone.customerReturnTo?.("/checkout/cleaning?packageId=deep-clean"),
    "/checkout/cleaning?packageId=deep-clean",
  );
  assert.equal(phone.customerReturnTo?.("/bookings"), "/bookings");
  assert.equal(
    phone.customerReturnTo?.("/quotes?serviceId=cleaning"),
    "/quotes?serviceId=cleaning",
  );
  for (const target of [
    "/quotes?serviceId=cleaning&redirect=https://evil.test",
    undefined,
    "https://evil.test",
    "//evil.test",
    "/dashboard/home",
    "/checkout/../staff",
    "/checkout/x?redirect=https://evil.test",
  ])
    assert.equal(phone.customerReturnTo?.(target), "/home");
});

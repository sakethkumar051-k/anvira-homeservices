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

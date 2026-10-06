import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { hostedFirebaseCredential } from "../server/lib/firebase-credential.mjs";
const { privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});
const credential = {
  type: "service_account",
  project_id: "fixture-project",
  client_email: "fixture-api@fixture-project.iam.gserviceaccount.com",
  private_key: privateKey,
};
const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64");
test("hosted API accepts an RSA credential only for its configured Firebase project", () => {
  const parsed = hostedFirebaseCredential(
    encode(credential),
    "fixture-project",
  );
  assert.equal(parsed.projectId, "fixture-project");
  assert.equal(parsed.clientEmail, credential.client_email);
  assert.throws(() =>
    hostedFirebaseCredential(encode(credential), "another-project"),
  );
  assert.throws(() =>
    hostedFirebaseCredential(
      encode({
        ...credential,
        client_email: "api@another-project.iam.gserviceaccount.com",
      }),
      "fixture-project",
    ),
  );
});
test("personal refresh credentials and malformed service keys fail before Firebase initialization", () => {
  for (const value of [
    { ...credential, type: "authorized_user" },
    { ...credential, private_key: "invalid" },
    { ...credential, client_email: null },
  ])
    assert.throws(() =>
      hostedFirebaseCredential(encode(value), "fixture-project"),
    );
  for (const value of [
    "not base64",
    "a".repeat(32769),
    Buffer.from("not JSON").toString("base64"),
    "",
  ])
    assert.throws(() => hostedFirebaseCredential(value, "fixture-project"));
});

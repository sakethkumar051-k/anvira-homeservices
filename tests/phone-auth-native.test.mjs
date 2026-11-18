import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

function adapter(sdk) {
  const source = readFileSync(
    new URL("../src/lib/auth-device.ts", import.meta.url),
    "utf8",
  );
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  });
  const exports = {};
  new Function("require", "exports", outputText)((name) => {
    assert.equal(name, "@react-native-firebase/auth");
    return sdk;
  }, exports);
  return exports;
}

test("installed phone confirmation returns a Firebase token without a premature workspace restore", async () => {
  const auth = { currentUser: null };
  let changed = () => {},
    confirmations = 0;
  const user = { uid: "fictional-phone-customer" };
  const phone = adapter({
    getAuth: () => auth,
    onAuthStateChanged: (_auth, callback) => {
      changed = callback;
      callback(null);
      return () => {};
    },
    verifyPhoneNumber: (_auth, number, timeout, resend) => {
      assert.equal(number, "+919876543210");
      assert.equal(timeout, 60);
      assert.equal(resend, false);
      return {
        on: (_event, callback) =>
          callback({
            state: "sent",
            verificationId: "fixture-id",
            code: null,
            error: null,
          }),
      };
    },
    PhoneAuthProvider: { credential: (id, code) => ({ id, code }) },
    signInWithCredential: async (_auth, credential) => {
      confirmations++;
      assert.equal(credential.id, "fixture-id");
      if (credential.code !== "123456")
        throw Object.assign(new Error("Wrong code"), {
          code: "auth/invalid-verification-code",
        });
      auth.currentUser = user;
      changed(user);
      return { user };
    },
    getIdToken: async (account, force) => {
      assert.equal(account, user);
      assert.equal(force, true);
      return "fixture-phone-token";
    },
  });
  const states = [];
  await phone.subscribeAuth((state) => states.push(state));
  const challenge = await phone.phoneLogin("+919876543210");
  await assert.rejects(challenge.confirm("000000"), {
    code: "auth/invalid-verification-code",
  });
  assert.equal(await challenge.confirm("123456"), "fixture-phone-token");
  assert.equal(confirmations, 2);
  assert.deepEqual(
    states,
    [false],
    "completeLogin must authorize the workspace before rendering it",
  );
});

test("installed resend uses native force-resend verification and confirms the returned verification ID", async () => {
  const user = { uid: "fictional-phone-customer" },
    auth = { currentUser: null };
  const phone = adapter({
    getAuth: () => auth,
    verifyPhoneNumber: (_auth, number, timeout, resend) => {
      assert.equal(number, "+919876543210");
      assert.equal(timeout, 60);
      assert.equal(resend, true);
      return {
        on: (event, callback) => {
          assert.equal(event, "state_changed");
          callback({
            state: "sent",
            verificationId: "fixture-verification-id",
            code: null,
            error: null,
          });
        },
      };
    },
    PhoneAuthProvider: {
      credential: (verificationId, code) => ({ verificationId, code }),
    },
    signInWithCredential: async (_auth, credential) => {
      assert.deepEqual(credential, {
        verificationId: "fixture-verification-id",
        code: "123456",
      });
      return { user };
    },
    getIdToken: async () => "fixture-resend-token",
  });
  const challenge = await phone.phoneLogin(
    "+919876543210",
    "unused-native-container",
    true,
  );
  assert.equal(await challenge.confirm("123456"), "fixture-resend-token");
});

test("instant Android verification consumes its native cached credential without requiring an SMS code", async () => {
  const user = { uid: "instant-phone-customer", phoneNumber: "+919876543210" };
  const auth = { currentUser: null };
  const phone = adapter({
    getAuth: () => auth,
    verifyPhoneNumber: () => ({
      on: (_event, callback) =>
        callback({
          state: "verified",
          verificationId: null,
          code: null,
          error: null,
        }),
    }),
    PhoneAuthProvider: {
      credential: (verificationId, code) => ({ verificationId, code }),
    },
    signInWithCredential: async (_auth, credential) => {
      assert.equal(
        credential.verificationId,
        null,
        "native SDK uses its cached credential for instant verification",
      );
      auth.currentUser = user;
      return { user };
    },
    getIdToken: async (account) => {
      assert.equal(account, user);
      return "fixture-instant-token";
    },
  });
  const challenge = await phone.phoneLogin("+919876543210");
  assert.equal(challenge.autoVerifiedToken, "fixture-instant-token");
});

for (const resend of [false, true]) {
  test(`late ${resend ? "resend" : "initial"} verification cannot sign in an abandoned number`, async () => {
    let event,
      signIns = 0;
    const phone = adapter({
      getAuth: () => ({ currentUser: null }),
      verifyPhoneNumber: () => ({
        on: (_name, callback) => {
          event = callback;
          callback({
            state: "sent",
            verificationId: "old-challenge",
            code: null,
            error: null,
          });
        },
      }),
      PhoneAuthProvider: { credential: (id, code) => ({ id, code }) },
      signInWithCredential: async () => {
        signIns++;
        return { user: { uid: "old" } };
      },
      getIdToken: async () => "old-token",
    });
    await phone.phoneLogin("+919876543210", "unused-native-container", resend);
    phone.clearPhoneAuth();
    event({
      state: "verified",
      verificationId: "old-challenge",
      code: "123456",
      error: null,
    });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(
      signIns,
      0,
      "late automatic events cannot mutate the signed-in account",
    );
  });
}

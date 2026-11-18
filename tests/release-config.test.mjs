import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Exercise the release command in isolation; never inherit local credentials.
const fixture = {
  DOTENV_CONFIG_PATH: "/nonexistent/anvira-release-fixture.env",
  APP_MODE: "firebase",
  PAYMENT_MODE: "razorpay",
  FIREBASE_PROJECT_ID: "release-fixture",
  PUBLIC_API_URL: "https://api.anvira.test",
  WEB_APP_URL: "https://www.anvira.test",
  ALLOWED_ORIGINS: "https://www.anvira.test",
  EXPO_PUBLIC_API_URL: "https://api.anvira.test",
  EXPO_PUBLIC_AUTH_MODE: "firebase",
  EXPO_PUBLIC_FIREBASE_PROJECT_ID: "release-fixture",
  EXPO_PUBLIC_FIREBASE_API_KEY: "fixture-public-api-key",
  EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: "release-fixture.firebaseapp.com",
  EXPO_PUBLIC_FIREBASE_APP_ID: "fixture-app-id",
  EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: "fixture.apps.googleusercontent.com",
  EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: "fixture-ios.apps.googleusercontent.com",
  EXPO_PUBLIC_APPLE_SIGN_IN_ENABLED: "true",
  EXPO_PUBLIC_EAS_PROJECT_ID: "11111111-2222-4333-8444-555555555555",
  FIREBASE_STORAGE_BUCKET: "release-fixture.firebasestorage.app",
  RAZORPAY_KEY_ID: "rzp_live_fixture",
  RAZORPAY_KEY_SECRET: "fixture-secret",
  RAZORPAY_WEBHOOK_SECRET: "fixture-webhook",
  BACKUP_ENCRYPTION_KEY: "fixture-backup",
};

function check(overrides = {}) {
  return spawnSync(process.execPath, ["scripts/check-release.mjs"], {
    cwd: new URL("..", import.meta.url),
    env: { ...fixture, ...overrides },
    encoding: "utf8",
  });
}

test("web release accepts same-origin proxy without native signing variables", () => {
  const result = check({
    RELEASE_TARGET: "web",
    EXPO_PUBLIC_API_URL: "",
    EXPO_PUBLIC_EAS_PROJECT_ID: "",
    EXPO_PUBLIC_APPLE_SIGN_IN_ENABLED: "",
    EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: "",
  });
  assert.equal(result.status, 0, result.stderr);
});

test("unknown release targets cannot bypass native release requirements", () => {
  const result = check({ RELEASE_TARGET: "andriod" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /RELEASE_TARGET/);
});

test("Android and iOS release require their native Firebase configuration files", () => {
  for (const [target, name] of [
    ["android", "GOOGLE_SERVICES_ANDROID"],
    ["ios", "GOOGLE_SERVICES_IOS"],
  ]) {
    const result = check({ RELEASE_TARGET: target });
    assert.equal(result.status, 1, target);
    assert.match(result.stderr, new RegExp(name));
  }
});

test("native release rejects device-local, insecure and malformed API origins", () => {
  const dir = mkdtempSync(join(tmpdir(), "anvira-release-"));
  const file = join(dir, "google-services.json");
  writeFileSync(file, "{}");
  try {
    for (const api of [
      "http://10.0.2.2:4000",
      "https://localhost",
      "https://localhost.",
      "https://printer.local.",
      "https://127.0.0.1",
      "https://100.64.0.1",
      "https://192.168.1.2",
      "https://[::1]",
      "https://user:password@api.anvira.test",
      "https://api.anvira.test/api",
      "https://api.anvira.test?token=fixture",
      "https://api.anvira.test#fragment",
    ]) {
      const result = check({
        RELEASE_TARGET: "android",
        GOOGLE_SERVICES_ANDROID: file,
        EXPO_PUBLIC_API_URL: api,
      });
      assert.equal(result.status, 1, api);
      assert.match(result.stderr, /EXPO_PUBLIC_API_URL/, api);
      assert.doesNotMatch(result.stderr, /user:password/);
    }
    const valid = check({
      RELEASE_TARGET: "android",
      GOOGLE_SERVICES_ANDROID: file,
    });
    assert.equal(valid.status, 0, valid.stderr);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

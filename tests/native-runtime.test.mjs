import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

function load(file, dependencies, env = {}, development = true) {
  const source = readFileSync(new URL(file, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  });
  const exports = {};
  new Function(
    "require",
    "exports",
    "process",
    "__DEV__",
    "window",
    outputText,
  )((name) => dependencies[name], exports, { env }, development, {
    location: { origin: "https://app.test" },
  });
  return exports;
}
const response = (
  bookingId = "booking-123",
  identifier = "notification-1",
) => ({
  actionIdentifier: "expo.modules.notifications.actions.DEFAULT",
  notification: { request: { identifier, content: { data: { bookingId } } } },
});
function notificationsHarness(initial, userId) {
  let state = userId ? { user: { id: userId } } : null;
  let last = initial;
  let cursor = 0;
  let listener;
  const hooks = [],
    effects = [],
    routes = [];
  const react = {
    useRef(value) {
      const index = cursor++;
      return (hooks[index] ??= { current: value });
    },
    useEffect(callback, dependencies) {
      const index = cursor++;
      const previous = hooks[index];
      if (
        !previous ||
        dependencies.some((v, i) => v !== previous.dependencies[i])
      ) {
        effects.push(() => {
          previous?.cleanup?.();
          hooks[index] = { dependencies, cleanup: callback() };
        });
      }
    },
  };
  const notifications = {
    setNotificationHandler() {},
    addNotificationReceivedListener: () => ({ remove() {} }),
    addNotificationResponseReceivedListener(callback) {
      listener = callback;
      return {
        remove() {
          listener = undefined;
        },
      };
    },
    getLastNotificationResponse: () => last,
    clearLastNotificationResponse() {
      last = null;
    },
  };
  const { NotificationRuntime } = load(
    "../src/components/NotificationRuntime.tsx",
    {
      react,
      "react-native": { Platform: { OS: "ios" } },
      "expo-notifications": notifications,
      "expo-router": { router: { push: (path) => routes.push(path) } },
      "../lib/context": { useApp: () => ({ state, refresh }) },
    },
  );
  function refresh() {}
  function render() {
    cursor = 0;
    NotificationRuntime();
    effects.splice(0).forEach((effect) => effect());
  }
  render();
  return {
    routes,
    login() {
      state = { user: { id: "customer-1" } };
      render();
    },
    tap(value) {
      last = value;
      listener?.(value);
    },
    getLast: () => last,
    unmount() {
      hooks.forEach((hook) => hook?.cleanup?.());
    },
  };
}
const settle = () => new Promise((resolve) => setTimeout(resolve, 15));

test("cold-start notification waits for authentication, then opens its booking once", async () => {
  const tap = response();
  const app = notificationsHarness(tap);
  await settle();
  assert.deepEqual(app.routes, []);
  assert.equal(app.getLast(), tap);
  app.login();
  await settle();
  assert.deepEqual(app.routes, ["/booking/booking-123"]);
  assert.equal(app.getLast(), null);
  app.tap(tap);
  await settle();
  assert.equal(app.routes.length, 1);
  app.unmount();
});
test("notification routing rejects unsafe IDs and does not erase a newer pending tap", async () => {
  const app = notificationsHarness(null, "customer-1");
  app.tap(response("../../account"));
  await settle();
  assert.deepEqual(app.routes, []);
  app.tap(response("booking-1", "one"));
  app.tap(response("booking-2", "two"));
  await settle();
  assert.equal(app.routes.at(-1), "/booking/booking-2");
  assert.equal(app.getLast(), null);
  app.unmount();
});
test("notification cleanup cancels routing scheduled before the root unmounts", async () => {
  const app = notificationsHarness(response(), "customer-1");
  app.unmount();
  await settle();
  assert.deepEqual(app.routes, []);
});
test("live native releases reject absent, HTTP, and malformed API endpoints", () => {
  for (const url of [
    undefined,
    "http://10.0.2.2:4000",
    "http://api.test",
    "https://",
  ]) {
    const runtime = load(
      "../src/lib/runtime.ts",
      {
        "react-native": { Platform: { OS: "android" } },
      },
      { EXPO_PUBLIC_AUTH_MODE: "firebase", EXPO_PUBLIC_API_URL: url },
      false,
    );
    assert.throws(() => runtime.assertApiConfiguration(), /HTTPS/);
  }
});
test("HTTPS release APIs, development emulator fallback, and web same-origin remain available", () => {
  for (const [platform, development, url, expected] of [
    ["ios", false, "https://api.test", "https://api.test"],
    ["android", true, undefined, "http://10.0.2.2:4000"],
    ["web", false, undefined, "https://app.test"],
  ]) {
    const runtime = load(
      "../src/lib/runtime.ts",
      {
        "react-native": { Platform: { OS: platform } },
      },
      { EXPO_PUBLIC_AUTH_MODE: "firebase", EXPO_PUBLIC_API_URL: url },
      development,
    );
    assert.equal(runtime.API_BASE, expected);
    assert.doesNotThrow(() => runtime.assertApiConfiguration());
  }
});

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
function notificationsHarness(initial, userId, options = {}) {
  let state = userId
    ? { user: { id: userId, role: options.role || "customer" } }
    : null;
  let last = initial;
  let cursor = 0;
  let listener;
  let handler;
  let soundEnabled = options.enabled ?? false;
  let offers = options.offers || [];
  const reads = [];
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
    setNotificationHandler(value) {
      handler = value.handleNotification;
    },
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
      "../lib/context": { useApp: () => ({ state, refresh, read }) },
      "./BookingAlerts": {
        useBookingAlerts: () => ({ enabled: soundEnabled }),
      },
      "../lib/notification-policy": load(
        "../src/lib/notification-policy.ts",
        {},
      ),
      "../lib/notification-channels": {
        configureAlertChannels: async () => {},
      },
    },
  );
  function refresh() {}
  async function read(path) {
    reads.push(path);
    if (options.read) return options.read(path);
    return { offers };
  }
  function render() {
    cursor = 0;
    NotificationRuntime();
    effects.splice(0).forEach((effect) => effect());
  }
  render();
  return {
    routes,
    login(id = "customer-1", role = "customer") {
      state = { user: { id, role } };
      render();
    },
    mute() {
      soundEnabled = false;
      render();
    },
    setOffers(value) {
      offers = value;
    },
    foreground(value) {
      return handler(value.notification);
    },
    reads,
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
const offerResponse = (extra = {}) => ({
  ...response("booking-private"),
  notification: {
    request: {
      identifier: "partner-notification",
      content: {
        data: {
          kind: "partner_offer",
          offerId: "offer-1",
          roundId: "round-1",
          expiresAt: Date.now() + 60000,
          notificationId: "offer-alert-1",
          ...extra,
        },
      },
    },
  },
});
test("offer cold-start waits for professional authentication and opens only the jobs inbox once", async () => {
  const tap = offerResponse();
  const app = notificationsHarness(tap);
  await settle();
  assert.deepEqual(app.routes, []);
  app.login("partner-1", "professional");
  await settle();
  assert.deepEqual(app.routes, ["/jobs"]);
  app.tap(tap);
  await settle();
  assert.deepEqual(app.routes, ["/jobs"]);
  app.unmount();
});
test("offer tap never opens a booking for a customer and expired offers still open the safe inbox", async () => {
  const app = notificationsHarness(offerResponse(), "customer-1");
  await settle();
  assert.deepEqual(app.routes, []);
  assert.deepEqual(app.reads, []);
  app.login("partner-1", "professional");
  app.tap(offerResponse({ expiresAt: Date.now() - 1000 }));
  await settle();
  assert.deepEqual(app.routes, ["/jobs"]);
  app.unmount();
});
test("foreground offer cues require a current recipient offer, deduplicate and share the mute preference", async () => {
  const offer = {
    id: "offer-1",
    roundId: "round-1",
    expiresAt: Date.now() + 60000,
  };
  const app = notificationsHarness(null, "partner-1", {
    role: "professional",
    enabled: true,
    offers: [offer],
  });
  assert.equal((await app.foreground(offerResponse())).shouldPlaySound, true);
  assert.equal((await app.foreground(offerResponse())).shouldPlaySound, false);
  app.mute();
  assert.equal((await app.foreground(response())).shouldPlaySound, false);
  app.setOffers([]);
  const stale = await app.foreground(
    offerResponse({ notificationId: "stale" }),
  );
  assert.equal(stale.shouldShowBanner, false);
  assert.equal(stale.shouldPlaySound, false);
  const expired = await app.foreground(
    offerResponse({ expiresAt: Date.now() - 1 }),
  );
  assert.equal(expired.shouldPlaySound, false);
  app.unmount();
});
test("foreground offers never query another workspace and an account change suppresses a pending cue", async () => {
  const customer = notificationsHarness(null, "customer-1", { enabled: true });
  assert.equal(
    (await customer.foreground(offerResponse())).shouldPlaySound,
    false,
  );
  assert.deepEqual(customer.reads, []);
  customer.unmount();
  let resolve;
  const app = notificationsHarness(null, "partner-1", {
    enabled: true,
    role: "professional",
    read: () =>
      new Promise((done) => {
        resolve = done;
      }),
  });
  const cue = app.foreground(offerResponse());
  app.login("customer-2", "customer");
  resolve({
    offers: [
      { id: "offer-1", roundId: "round-1", expiresAt: Date.now() + 60000 },
    ],
  });
  assert.equal((await cue).shouldPlaySound, false);
  app.unmount();
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

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

function load(file, dependencies) {
  const { outputText } = ts.transpileModule(
    readFileSync(new URL(file, import.meta.url), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
      },
    },
  );
  const exports = {};
  new Function("require", "exports", "localStorage", outputText)(
    (name) => dependencies[name],
    exports,
    { getItem: () => "on", setItem() {} },
  );
  return exports;
}
async function fixture(platform, role = "professional") {
  let state = { user: { id: "partner-1", role }, notifications: [] };
  let offers = [];
  let cursor = 0,
    dirty = true,
    tree,
    cues = 0;
  const hooks = [],
    effects = [],
    reads = [],
    routes = [];
  const read = async (path) => {
    reads.push(path);
    return { offers };
  };
  const react = {
    createContext: () => ({ Provider: "AlertProvider" }),
    useContext: () => {},
    useRef(value) {
      const i = cursor++;
      return (hooks[i] ??= { current: value });
    },
    useState(initial) {
      const i = cursor++;
      if (!(i in hooks))
        hooks[i] = typeof initial === "function" ? initial() : initial;
      return [
        hooks[i],
        (value) => {
          hooks[i] = value;
          dirty = true;
        },
      ];
    },
    useEffect(callback, dependencies) {
      const i = cursor++,
        previous = hooks[i];
      if (
        !previous ||
        dependencies.some((v, j) => v !== previous.dependencies[j])
      )
        effects.push(() => {
          previous?.cleanup?.();
          hooks[i] = { dependencies, cleanup: callback() };
        });
    },
  };
  const { BookingAlertsProvider } = load(
    "../src/components/BookingAlerts.tsx",
    {
      react,
      "react/jsx-runtime": {
        jsx: (type, props) => ({ type, props }),
        jsxs: (type, props) => ({ type, props }),
      },
      "react-native": { Platform: { OS: platform }, View: "View" },
      "expo-secure-store": {
        getItemAsync: async () => "on",
        setItemAsync: async () => {},
      },
      "expo-router": { router: { push: (route) => routes.push(route) } },
      "../lib/context": {
        useApp: () => ({ state, request: async () => {}, read }),
      },
      "../lib/alert-sound": {
        primeAlertSound: async () => {},
        playAlertSound: async () => {
          cues++;
        },
      },
      "../lib/notification-policy": load(
        "../src/lib/notification-policy.ts",
        {},
      ),
      "./ui": { T: "T", Row: "Row", Button: "Button", Badge: "Badge", c: {} },
    },
  );
  async function flush() {
    for (let i = 0; i < 10 && dirty; i++) {
      dirty = false;
      cursor = 0;
      const session = BookingAlertsProvider({ children: null });
      tree = session.type(session.props);
      effects.splice(0).forEach((effect) => effect());
      await Promise.resolve();
      await Promise.resolve();
    }
  }
  await flush();
  return {
    async notify(value, currentOffers = []) {
      offers = currentOffers;
      state = { ...state, notifications: [value] };
      dirty = true;
      await flush();
    },
    cues: () => cues,
    reads,
    routes,
    banner: () => tree.props.value.banner,
    async open() {
      tree.props.value.banner.props.children[3].props.children[0].props.onPress();
      await Promise.resolve();
      await Promise.resolve();
    },
    unmount: () => hooks.forEach((hook) => hook?.cleanup?.()),
  };
}
const alert = (extra = {}) => ({
  id: "notification-1",
  title: "New update",
  body: "Open the app",
  read: false,
  bookingId: "booking-private",
  ...extra,
});
test("native polled updates show a banner without scheduling a second local sound", async () => {
  const app = await fixture("android");
  try {
    await app.notify(alert());
    assert.ok(app.banner());
    assert.equal(app.cues(), 0);
  } finally {
    app.unmount();
  }
});
test("web foreground updates retain the opted-in audio cue", async () => {
  const app = await fixture("web");
  try {
    await app.notify(alert());
    assert.equal(app.cues(), 1);
  } finally {
    app.unmount();
  }
});
test("expired and nonrecipient partner offers cannot show polled banners or cues", async () => {
  const app = await fixture("web");
  try {
    await app.notify(
      alert({
        kind: "partner_offer",
        offerId: "offer-1",
        roundId: "round-1",
        expiresAt: Date.now() - 1,
      }),
    );
    assert.equal(app.banner(), null);
    assert.equal(app.cues(), 0);
    await app.notify(
      alert({
        id: "new-id",
        kind: "partner_offer",
        offerId: "offer-1",
        roundId: "round-1",
        expiresAt: Date.now() + 60000,
      }),
    );
    assert.equal(app.banner(), null);
    assert.equal(app.cues(), 0);
  } finally {
    app.unmount();
  }
});
test("a current recipient offer banner opens the jobs inbox without exposing booking details", async () => {
  const app = await fixture("android");
  const offer = {
    id: "offer-1",
    roundId: "round-1",
    expiresAt: Date.now() + 60000,
  };
  try {
    await app.notify(
      alert({
        kind: "partner_offer",
        offerId: offer.id,
        roundId: offer.roundId,
        expiresAt: offer.expiresAt,
      }),
      [offer],
    );
    assert.ok(app.banner());
    assert.equal(app.cues(), 0);
    await app.open();
    assert.deepEqual(app.routes, ["/jobs"]);
  } finally {
    app.unmount();
  }
});

test("partner alert accepts real UUID rounds with Firebase-length recipient IDs", () => {
  const policy = load("../src/lib/notification-policy.ts", {});
  const roundId = "12345678-1234-1234-1234-123456789012";
  const offer = {
    id: roundId + "_" + roundId + "_" + "a".repeat(128),
    roundId,
    expiresAt: Date.now() + 60000,
  };
  const data = {
    kind: "partner_offer",
    offerId: offer.id,
    roundId,
    expiresAt: offer.expiresAt,
  };
  assert.equal(policy.currentPartnerAlert(data, [offer]), true);
  assert.equal(policy.notificationRoute(data, "professional"), "/jobs");
  assert.equal(
    policy.notificationRoute(
      { ...data, offerId: "../invalid" },
      "professional",
    ),
    null,
  );
});

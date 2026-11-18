import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const response = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
const state = (id) => ({ user: { id, role: "customer" }, services: [] });

function fixture(fetcher) {
  let cursor = 0;
  const hooks = [],
    effects = [];
  const memo = (factory, deps) => {
    const index = cursor++;
    const old = hooks[index];
    if (!old || deps.some((value, i) => value !== old.deps[i]))
      hooks[index] = { deps, value: factory() };
    return hooks[index].value;
  };
  const react = {
    createContext: () => ({ Provider: "ContextProvider" }),
    useContext: () => {},
    useState: (initial) => {
      const index = cursor++;
      if (!(index in hooks))
        hooks[index] = typeof initial === "function" ? initial() : initial;
      return [
        hooks[index],
        (value) => {
          hooks[index] =
            typeof value === "function" ? value(hooks[index]) : value;
        },
      ];
    },
    useRef: (value) => {
      const index = cursor++;
      return (hooks[index] ??= { current: value });
    },
    useMemo: memo,
    useCallback: (callback, deps) => memo(() => callback, deps),
    useEffect: (callback, deps) => {
      const index = cursor++;
      if (!hooks[index] || deps.some((value, i) => value !== hooks[index][i])) {
        hooks[index] = deps;
        effects.push(callback);
      }
    },
  };
  const dependencies = {
    react,
    "react/jsx-runtime": { jsx: (type, props) => ({ type, props }) },
    "react-native": { Platform: { OS: "web" } },
    "expo-secure-store": {},
    "./drafts": { clearDrafts: async () => {} },
    "./translations.json": {},
    "./runtime": {
      API_BASE: "https://fixture.test",
      LIVE: true,
      WEBSITE_STAFF_ONLY: false,
      assertApiConfiguration: () => {},
    },
    "./web-access": { assertStaffWorkspace: () => {} },
    "./api-response": {
      createApiTransport: () => fetcher,
      parseApiResponse: (result) => result.json(),
    },
    "./api-recovery": {},
    "./auth": { logoutAuth: async () => {} },
  };
  const { outputText } = ts.transpileModule(
    readFileSync(new URL("../src/lib/context.tsx", import.meta.url), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
      },
    },
  );
  const exports = {};
  new Function("require", "exports", outputText)(
    (name) => dependencies[name],
    exports,
  );
  return {
    render() {
      cursor = 0;
      return exports.Provider({ children: null }).props.value;
    },
    runEffects() {
      for (const effect of effects.splice(0)) effect();
    },
  };
}
const flush = () => new Promise((resolve) => setImmediate(resolve));

for (const staleStatus of [200, 401]) {
  test(`late initial ${staleStatus} session restore cannot replace a completed phone sign-in`, async () => {
    const old = deferred();
    let stateCalls = 0;
    const f = fixture(async (url) => {
      if (url.endsWith("/csrf")) return response({ token: "fixture-csrf" });
      if (url.endsWith("/state"))
        return ++stateCalls === 1
          ? old.promise
          : response(state("new-phone-user"));
      return response({ ok: true });
    });
    const context = f.render();
    f.runEffects();
    await context.completeLogin("fixture-phone-token");
    assert.equal(f.render().state.user.id, "new-phone-user");
    old.resolve(
      response(
        staleStatus === 200
          ? state("old-cookie-user")
          : { code: "AUTH_REQUIRED", error: "Sign in" },
        staleStatus,
      ),
    );
    await flush();
    assert.equal(f.render().state.user.id, "new-phone-user");
    assert.equal(f.render().error, "");
  });
}

test("sign-out invalidates an in-flight phone login workspace response", async () => {
  const pending = deferred(),
    requested = deferred();
  const f = fixture(async (url) => {
    if (url.endsWith("/csrf")) return response({ token: "fixture-csrf" });
    if (url.endsWith("/state")) {
      requested.resolve();
      return pending.promise;
    }
    return response({ ok: true });
  });
  const context = f.render();
  const login = context.completeLogin("fixture-phone-token");
  await requested.promise;
  context.logout();
  pending.resolve(response(state("abandoned-phone-user")));
  await login;
  await flush();
  assert.equal(f.render().state, null);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import * as firebaseApp from "firebase/app";
import * as firebaseAuth from "firebase/auth";
const { initializeApp, deleteApp } = firebaseApp;
import { getAuth, connectAuthEmulator } from "firebase/auth";
const require = createRequire(import.meta.url);
function load(file, dependencies, env = {}) {
  const source = readFileSync(new URL(file, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  });
  const exports = {};
  new Function("require", "exports", "process", outputText)(
    (name) => dependencies[name] ?? require(name),
    exports,
    { env },
  );
  return exports;
}
test("Expo Go uses real Firebase JS email auth, keeps tokens in memory and suppresses premature workspace restore", async () => {
  const email = "customer@review.example.test",
    uid = "review-customer";
  const jwt =
    [
      { alg: "none", typ: "JWT" },
      {
        sub: uid,
        user_id: uid,
        email,
        aud: "demo-anvira-go",
        iss: "https://securetoken.google.com/demo-anvira-go",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
    ]
      .map((x) => Buffer.from(JSON.stringify(x)).toString("base64url"))
      .join(".") + ".unsigned";
  const server = createServer(async (req, res) => {
    let text = "";
    for await (const chunk of req) text += chunk;
    const body = req.headers["content-type"]?.includes("application/json")
      ? JSON.parse(text || "{}")
      : Object.fromEntries(new URLSearchParams(text));
    res.setHeader("Content-Type", "application/json");
    if (req.url.includes("/token")) {
      res.end(
        JSON.stringify({
          access_token: jwt,
          id_token: jwt,
          refresh_token: "fixture-refresh",
          expires_in: "3600",
          user_id: uid,
        }),
      );
    } else if (req.url.includes("accounts:signInWithPassword")) {
      if (body.email !== email || body.password !== "fixture-password") {
        res.writeHead(400);
        res.end(
          JSON.stringify({
            error: { code: 400, message: "INVALID_LOGIN_CREDENTIALS" },
          }),
        );
        return;
      }
      res.end(
        JSON.stringify({
          localId: uid,
          email,
          idToken: jwt,
          refreshToken: "fixture-refresh",
          expiresIn: "3600",
          registered: true,
        }),
      );
    } else if (req.url.includes("accounts:lookup")) {
      res.end(
        JSON.stringify({
          users: [
            {
              localId: uid,
              email,
              emailVerified: false,
              providerUserInfo: [
                { providerId: "password", email, federatedId: email },
              ],
            },
          ],
        }),
      );
    } else {
      res.writeHead(404);
      res.end("{}");
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const app = initializeApp({
    projectId: "demo-anvira-go",
    apiKey: "fixture-key",
    authDomain: "demo-anvira-go.firebaseapp.com",
  });
  const auth = getAuth(app);
  connectAuthEmulator(auth, `http://127.0.0.1:${server.address().port}`, {
    disableWarnings: true,
  });
  let unsubscribe;
  try {
    const web = load(
      "../src/lib/auth.web.ts",
      { "firebase/app": firebaseApp, "firebase/auth": firebaseAuth },
      {
        EXPO_PUBLIC_FIREBASE_PROJECT_ID: "demo-anvira-go",
        EXPO_PUBLIC_FIREBASE_API_KEY: "fixture-key",
        EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: "demo-anvira-go.firebaseapp.com",
      },
    );
    const adapter = load("../src/lib/auth-expo-go.ts", { "./auth.web": web });
    const go = load("../src/lib/auth.native.ts", {
      expo: { isRunningInExpoGo: () => true },
      "./auth-expo-go": adapter,
      "./auth-device": new Proxy(
        {},
        {
          get(_target, property) {
            if (property === "__esModule") return true;
            return () => {
              throw new Error("Expo Go must not invoke a native auth module");
            };
          },
        },
      ),
    });
    await go.prepareAuth();
    const changes = [];
    unsubscribe = await go.subscribeAuth((value) => changes.push(value));
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(changes, [false]);
    assert.equal(await go.emailLogin(email, "fixture-password"), jwt);
    assert.equal(auth.currentUser.uid, uid);
    assert.equal(await go.token(), jwt);
    assert.deepEqual(
      changes,
      [false],
      "interactive sign-in must let completeLogin load the authorized workspace first",
    );
    await go.logoutAuth();
    assert.equal(await go.token(), "");
    await assert.rejects(go.emailLogin(email, "wrong"), {
      code: "auth/invalid-credential",
    });
    assert.equal(auth.currentUser, null);
    await assert.rejects(
      go.googleLogin(),
      /installed ANVIRA app.*email\/password/i,
    );
    await assert.rejects(
      go.appleLogin(),
      /installed ANVIRA app.*email\/password/i,
    );
  } finally {
    unsubscribe?.();
    await deleteApp(app);
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});

import "dotenv/config";
import { readFile } from "node:fs/promises";
const errors = [];
const api = process.env.EXPO_PUBLIC_API_URL;
try {
  const u = new URL(api || "");
  if (
    u.protocol !== "https:" ||
    /localhost|127\.0\.0\.1|10\.0\.2\.2/.test(u.hostname) ||
    u.username ||
    u.password ||
    u.pathname !== "/" ||
    u.search ||
    u.hash
  )
    throw Error();
  const r = await fetch(u.origin + "/api/health", {
    signal: AbortSignal.timeout(15000),
  });
  const health = await r.json();
  if (!r.ok || health.mode !== "demo" || health.payments !== "demo")
    errors.push(
      "The Android demo must use a separate demo API with simulated payments.",
    );
} catch {
  errors.push(
    "Set EXPO_PUBLIC_API_URL to a reachable public HTTPS demo API origin; localhost cannot work on the client's phone.",
  );
}
if (!process.env.EXPO_PUBLIC_EAS_PROJECT_ID)
  errors.push("Set the client's EXPO_PUBLIC_EAS_PROJECT_ID.");
const eas = JSON.parse(await readFile("eas.json"));
if (
  eas.build.demo.env.EXPO_PUBLIC_AUTH_MODE !== "demo" ||
  eas.build.demo.android.buildType !== "apk"
)
  errors.push(
    "EAS demo profile must use demo authentication and Android APK output.",
  );
if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else
  console.log(
    "Android demo API and APK profile verified. Set these values in the EAS development environment, then run npx eas-cli@latest build --platform android --profile demo.",
  );

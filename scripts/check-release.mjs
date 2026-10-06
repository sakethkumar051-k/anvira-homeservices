import "dotenv/config";
import { existsSync } from "node:fs";
import { config } from "../server/lib/config.mjs";
const errors = [];
if (
  process.env.RELEASE_CHANNEL !== "staging" &&
  !process.env.RAZORPAY_KEY_ID?.startsWith("rzp_live_")
)
  errors.push(
    "Production payments require live Razorpay keys. Use RELEASE_CHANNEL=staging only for a clearly labelled test deployment.",
  );
function required(name) {
  if (!process.env[name] || /YOUR_|example\.invalid/.test(process.env[name]))
    errors.push(name + " is missing or contains a placeholder.");
}
for (const name of [
  "FIREBASE_PROJECT_ID",
  "PUBLIC_API_URL",
  "WEB_APP_URL",
  "ALLOWED_ORIGINS",
  "EXPO_PUBLIC_API_URL",
  "EXPO_PUBLIC_FIREBASE_PROJECT_ID",
  "EXPO_PUBLIC_FIREBASE_API_KEY",
  "EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "EXPO_PUBLIC_FIREBASE_APP_ID",
  "EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID",
])
  required(name);
if (!process.env.FIREBASE_STORAGE_BUCKET && !process.env.PRIVATE_DOCUMENT_DIR)
  errors.push(
    "Configure private documents through Firebase Storage or a persistent encrypted server volume.",
  );
if (
  process.env.PRIVATE_DOCUMENT_DIR &&
  (!process.env.DOCUMENT_ENCRYPTION_KEY ||
    process.env.PERSISTENT_DOCUMENT_VOLUME !== "true")
)
  errors.push(
    "Encrypted document storage needs DOCUMENT_ENCRYPTION_KEY and PERSISTENT_DOCUMENT_VOLUME=true.",
  );
const releaseTarget = process.env.RELEASE_TARGET || "all";
if (["all", "android", "ios"].includes(releaseTarget))
  required("EXPO_PUBLIC_EAS_PROJECT_ID");
if (["all", "ios"].includes(releaseTarget)) {
  required("EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID");
  if (process.env.EXPO_PUBLIC_APPLE_SIGN_IN_ENABLED !== "true")
    errors.push(
      "iOS launch needs configured Apple sign-in, the Apple developer capability and real-device verification.",
    );
}
for (const name of [
  "RAZORPAY_KEY_ID",
  "RAZORPAY_KEY_SECRET",
  "RAZORPAY_WEBHOOK_SECRET",
  "BACKUP_ENCRYPTION_KEY",
])
  required(name);
if (process.env.EXPO_PUBLIC_AUTH_MODE !== "firebase")
  errors.push("The client must use EXPO_PUBLIC_AUTH_MODE=firebase.");
if (
  process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID !==
  process.env.FIREBASE_PROJECT_ID
)
  errors.push("Client and server must use the same Firebase project.");
if (
  process.env.GOOGLE_SERVICES_IOS &&
  !existsSync(process.env.GOOGLE_SERVICES_IOS)
)
  errors.push("The iOS Firebase file is not available.");
if (
  process.env.GOOGLE_SERVICES_ANDROID &&
  !existsSync(process.env.GOOGLE_SERVICES_ANDROID)
)
  errors.push("The Android Firebase file is not available.");
for (const name of [
  "EXPO_PUBLIC_RAZORPAY_KEY_SECRET",
  "EXPO_PUBLIC_GOOGLE_APPLICATION_CREDENTIALS",
  "EXPO_PUBLIC_EXPO_ACCESS_TOKEN",
])
  if (process.env[name]) errors.push(name + " exposes a secret. Remove it.");
try {
  config({
    ...process.env,
    NODE_ENV: "production",
    APP_MODE: process.env.APP_MODE,
    PAYMENT_MODE: process.env.PAYMENT_MODE,
  });
} catch (e) {
  errors.push(e.message);
}
if (process.env.PAYOUTS_ENABLED === "true" && !process.env.VPC_CONNECTOR)
  errors.push(
    "RazorpayX payouts need static allowlisted egress; configure VPC_CONNECTOR first.",
  );
if (errors.length) {
  console.error(
    "Release configuration is incomplete:\n" +
      errors.map((e) => "• " + e).join("\n"),
  );
  process.exitCode = 1;
} else
  console.log(
    "Public release configuration is consistent. Secret Manager, live provider, policy, native device and store gates still require verification.",
  );

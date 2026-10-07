import { fail } from "./errors.mjs";
export function config(env = process.env) {
  const mode = env.APP_MODE || "demo";
  if (!["demo", "firebase"].includes(mode)) fail(500, "Invalid APP_MODE.");
  const live = mode === "firebase",
    production = env.NODE_ENV === "production";
  if (production && !live)
    throw new Error(
      "Production requires Firebase authentication and Firestore. Demo mode is forbidden.",
    );
  const paymentMode = env.PAYMENT_MODE || (live ? "razorpay" : "demo");
  if (
    !["demo", "razorpay"].includes(paymentMode) ||
    (live && paymentMode !== "razorpay")
  )
    throw new Error(
      "Firebase mode requires Razorpay integration. Use APP_MODE=demo for simulated payments.",
    );
  const origins = (env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  // The client-owned marketing domains use the same staff API as the
  // existing Vercel deployment. Keep the explicit origin allowlist intact.
  if (origins.includes("https://anvira-homeservices.vercel.app"))
    for (const origin of [
      "https://anviraservices.com",
      "https://www.anviraservices.com",
    ])
      if (!origins.includes(origin)) origins.push(origin);
  const publicUrl =
    env.PUBLIC_API_URL ||
    (env.RENDER === "true" ? env.RENDER_EXTERNAL_URL : "") ||
    "http://localhost:4000";
  const paymentEnvironment =
    env.RAZORPAY_ENVIRONMENT ||
    (env.RAZORPAY_KEY_ID?.startsWith("rzp_live_") ? "live" : "test");
  if (!["test", "live"].includes(paymentEnvironment))
    throw new Error("RAZORPAY_ENVIRONMENT must be test or live.");
  if (
    env.RAZORPAY_KEY_ID &&
    !env.RAZORPAY_KEY_ID.startsWith("rzp_" + paymentEnvironment + "_")
  )
    throw new Error("Razorpay key mode does not match RAZORPAY_ENVIRONMENT.");
  if (production && (!origins.length || !publicUrl.startsWith("https://")))
    throw new Error(
      "Production requires explicit ALLOWED_ORIGINS and an HTTPS PUBLIC_API_URL.",
    );
  const bankChangeCooldownHours = Number(env.BANK_CHANGE_COOLDOWN_HOURS || 24);
  if (
    !Number.isFinite(bankChangeCooldownHours) ||
    bankChangeCooldownHours < 0 ||
    bankChangeCooldownHours > 168
  )
    throw new Error("BANK_CHANGE_COOLDOWN_HOURS must be between 0 and 168.");
  return {
    mode,
    live,
    production,
    paymentMode,
    paymentEnvironment,
    origins,
    publicUrl,
    port: Number(env.PORT || 4000),
    projectId: env.FIREBASE_PROJECT_ID || env.GCLOUD_PROJECT,
    firebaseServiceAccountB64: env.FIREBASE_SERVICE_ACCOUNT_B64,
    bucket: env.FIREBASE_STORAGE_BUCKET,
    privateDocumentDir: env.PRIVATE_DOCUMENT_DIR,
    documentEncryptionKey: env.DOCUMENT_ENCRYPTION_KEY,
    persistentDocuments: env.PERSISTENT_DOCUMENT_VOLUME === "true",
    razorpayKeyId: env.RAZORPAY_KEY_ID,
    razorpayKeySecret: env.RAZORPAY_KEY_SECRET,
    webhookSecret: env.RAZORPAY_WEBHOOK_SECRET,
    razorpayXKeyId: env.RAZORPAYX_KEY_ID,
    razorpayXKeySecret: env.RAZORPAYX_KEY_SECRET,
    payoutWebhookSecret: env.RAZORPAYX_WEBHOOK_SECRET,
    payoutAccount: env.RAZORPAYX_ACCOUNT_NUMBER,
    payoutsEnabled: env.PAYOUTS_ENABLED === "true",
    bankVerificationEnabled: env.BANK_VERIFICATION_ENABLED === "true",
    bankChangeCooldownHours,
    pushAccessToken: env.EXPO_ACCESS_TOKEN,
    internalJobSecret: env.INTERNAL_JOB_SECRET,
    webReturn: env.WEB_APP_URL || publicUrl,
    trustProxy: Number(env.TRUST_PROXY || 0),
    appReturn: "anvira://booking/",
  };
}

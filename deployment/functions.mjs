import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret, defineString } from "firebase-functions/params";
import { createApplication } from "./server/app.mjs";
import features from "./features.json" with { type: "json" };
import { config } from "./server/lib/config.mjs";
const key = defineSecret("RAZORPAY_KEY_ID"),
  secret = defineSecret("RAZORPAY_KEY_SECRET"),
  webhook = defineSecret("RAZORPAY_WEBHOOK_SECRET");
const xKey = features.payouts ? defineSecret("RAZORPAYX_KEY_ID") : null,
  xSecret = features.payouts ? defineSecret("RAZORPAYX_KEY_SECRET") : null,
  xWebhook = features.payouts ? defineSecret("RAZORPAYX_WEBHOOK_SECRET") : null,
  xAccount = features.payouts ? defineSecret("RAZORPAYX_ACCOUNT_NUMBER") : null,
  pushToken = features.enhancedPush ? defineSecret("EXPO_ACCESS_TOKEN") : null;
const apiUrl = defineString("PUBLIC_API_URL"),
  webUrl = defineString("WEB_APP_URL"),
  origins = defineString("ALLOWED_ORIGINS"),
  bucket = defineString("FIREBASE_STORAGE_BUCKET");
// Configure a static NAT egress connector before enabling RazorpayX payouts.
const network = process.env.VPC_CONNECTOR
  ? {
      vpcConnector: process.env.VPC_CONNECTOR,
      vpcConnectorEgressSettings: "ALL_TRAFFIC",
    }
  : {};
if (features.payouts && !process.env.VPC_CONNECTOR)
  throw new Error(
    "RazorpayX requires a configured static-egress VPC connector.",
  );
let application;
async function getApp() {
  if (!application)
    application = createApplication({
      config: config({
        ...process.env,
        NODE_ENV: "production",
        APP_MODE: "firebase",
        PAYMENT_MODE: "razorpay",
        TRUST_PROXY: "1",
        PUBLIC_API_URL: apiUrl.value(),
        WEB_APP_URL: webUrl.value(),
        ALLOWED_ORIGINS: origins.value(),
        FIREBASE_STORAGE_BUCKET: bucket.value(),
        RAZORPAY_KEY_ID: key.value(),
        RAZORPAY_KEY_SECRET: secret.value(),
        RAZORPAY_WEBHOOK_SECRET: webhook.value(),
        RAZORPAYX_KEY_ID: xKey?.value(),
        RAZORPAYX_KEY_SECRET: xSecret?.value(),
        RAZORPAYX_WEBHOOK_SECRET: xWebhook?.value(),
        RAZORPAYX_ACCOUNT_NUMBER: xAccount?.value(),
        PAYOUTS_ENABLED: String(features.payouts),
        EXPO_ACCESS_TOKEN: pushToken?.value(),
      }),
    }).catch((e) => {
      application = undefined;
      throw e;
    });
  return application;
}
const shared = {
  region: "asia-south1",
  memory: "512MiB",
  minInstances: 0,
  maxInstances: 3,
  secrets: [
    key,
    secret,
    webhook,
    ...[xKey, xSecret, xWebhook, xAccount, pushToken].filter(Boolean),
  ],
  ...network,
};
export const api = onRequest(
  { ...shared, timeoutSeconds: 60, concurrency: 40 },
  async (req, res) => {
    try {
      (await getApp()).app(req, res);
    } catch {
      res.status(503).json({
        error: "ANVIRA is awaiting service configuration.",
        code: "SERVICE_NOT_CONFIGURED",
      });
    }
  },
);
export const operations = onSchedule(
  {
    ...shared,
    schedule: "every 5 minutes",
    timeZone: "Asia/Kolkata",
    timeoutSeconds: 300,
    maxInstances: 1,
    retryCount: 1,
  },
  async () => {
    const result = await (await getApp()).jobs.run();
    console.info(
      JSON.stringify({ operation: "scheduled_maintenance", result }),
    );
  },
);

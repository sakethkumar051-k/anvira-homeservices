import "dotenv/config";
import { config } from "../server/lib/config.mjs";
const cfg = config();
if (!cfg.razorpayKeyId || !cfg.razorpayKeySecret) {
  console.error(
    "Razorpay test credentials are not configured. Generate Test Mode keys in the client's Razorpay account and store them only in the API host's secret environment.",
  );
  process.exitCode = 1;
} else if (cfg.paymentEnvironment !== "test") {
  console.error(
    "This diagnostic accepts test keys only; it never performs a live payment.",
  );
  process.exitCode = 1;
} else {
  try {
    const r = await fetch("https://api.razorpay.com/v1/orders?count=1", {
      headers: {
        Authorization:
          "Basic " +
          Buffer.from(cfg.razorpayKeyId + ":" + cfg.razorpayKeySecret).toString(
            "base64",
          ),
      },
      signal: AbortSignal.timeout(15000),
    });
    console.log(
      JSON.stringify({
        environment: "test",
        credentialsAccepted: r.ok,
        status: r.status,
        webhookSecretConfigured: !!cfg.webhookSecret,
        realMoneyMoved: false,
      }),
    );
    if (!r.ok || !cfg.webhookSecret) process.exitCode = 1;
  } catch {
    console.error(
      "Razorpay connection failed. Check network access and the API host.",
    );
    process.exitCode = 1;
  }
}

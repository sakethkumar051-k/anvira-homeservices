import "dotenv/config";
import { createApplication } from "./app.mjs";
import { createDispatchRunner } from "./lib/dispatch-runner.mjs";
let dispatchRunner;
const { app, cfg, store, jobs } = await createApplication({
  onDispatchPending: () => {
    if (process.env.RUN_BACKGROUND_JOBS !== "false") dispatchRunner?.wake();
  },
});
const server = app.listen(cfg.port, "0.0.0.0", () =>
  console.log(`ANVIRA ${cfg.mode} API listening on ${cfg.port}`),
);
// A standalone host can run jobs without Firebase Functions or Blaze.
// Leases and idempotent financial operations remain enforced by the shared store.
let running = false;
const runJobs = async () => {
  if (running) return;
  running = true;
  try {
    await jobs.run();
  } catch (e) {
    console.error(
      JSON.stringify({
        level: "error",
        code: e.code || "WORKER_FAILED",
        component: "background_jobs",
      }),
    );
  } finally {
    running = false;
  }
};
// Render's free plan sleeps after 15 minutes without incoming requests and
// then takes up to a minute to wake. While awake, the API calls its own
// public health URL every 10 minutes; Render counts that as incoming traffic,
// so the service stays awake. Set KEEP_AWAKE=false on an always-on plan.
const publicUrl = (
  process.env.KEEP_AWAKE_URL ||
  process.env.RENDER_EXTERNAL_URL ||
  ""
).replace(/\/$/, "");
const keepAwake = process.env.KEEP_AWAKE !== "false" && !!publicUrl;
const keepAwakeTimer = keepAwake
  ? setInterval(
      () =>
        void fetch(publicUrl + "/api/health", {
          signal: AbortSignal.timeout(30000),
        }).catch(() =>
          console.error(
            JSON.stringify({
              level: "warn",
              component: "keep_awake",
              code: "PING_FAILED",
            }),
          ),
        ),
      10 * 60000,
    )
  : null;
// Staying awake all day means maintenance would also run all day. Every five
// minutes keeps Firestore reads well inside the free daily quota; dispatch
// deadlines keep their own one-minute watchdog below.
const jobIntervalSeconds =
  Number(process.env.JOB_INTERVAL_SECONDS) || (keepAwake ? 300 : 60);
const timer =
  process.env.RUN_BACKGROUND_JOBS === "false"
    ? null
    : setInterval(runJobs, jobIntervalSeconds * 1000);
dispatchRunner = createDispatchRunner(jobs, {
  onError: (error) =>
    console.error(
      JSON.stringify({
        level: "error",
        component: "dispatch_queue",
        code: error.code || "DISPATCH_TICK_FAILED",
      }),
    ),
});
const dispatchTimer =
  process.env.RUN_BACKGROUND_JOBS === "false"
    ? null
    : setInterval(() => {
        if (dispatchRunner.active()) void dispatchRunner.run();
      }, 5000);
const dispatchWatchdog =
  process.env.RUN_BACKGROUND_JOBS === "false"
    ? null
    : setInterval(() => void dispatchRunner.run(), 60000);
dispatchWatchdog?.unref();
if (dispatchWatchdog) void dispatchRunner.run();
dispatchTimer?.unref();
timer?.unref();
keepAwakeTimer?.unref();
if (keepAwake)
  console.log(
    `Keep-awake ping enabled every 10 minutes; maintenance every ${jobIntervalSeconds}s.`,
  );
if (timer) void runJobs();
process.on("SIGTERM", () =>
  server.close(() => {
    if (timer) clearInterval(timer);
    if (dispatchTimer) clearInterval(dispatchTimer);
    if (dispatchWatchdog) clearInterval(dispatchWatchdog);
    if (keepAwakeTimer) clearInterval(keepAwakeTimer);
    store.close?.();
    process.exit(0);
  }),
);
process.on("SIGINT", () =>
  server.close(() => {
    if (timer) clearInterval(timer);
    if (dispatchTimer) clearInterval(dispatchTimer);
    if (dispatchWatchdog) clearInterval(dispatchWatchdog);
    if (keepAwakeTimer) clearInterval(keepAwakeTimer);
    store.close?.();
    process.exit(0);
  }),
);

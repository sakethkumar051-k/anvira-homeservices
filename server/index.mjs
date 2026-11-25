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
const timer =
  process.env.RUN_BACKGROUND_JOBS === "false"
    ? null
    : setInterval(runJobs, 60000);
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
if (timer) void runJobs();
process.on("SIGTERM", () =>
  server.close(() => {
    if (timer) clearInterval(timer);
    if (dispatchTimer) clearInterval(dispatchTimer);
    if (dispatchWatchdog) clearInterval(dispatchWatchdog);
    store.close?.();
    process.exit(0);
  }),
);
process.on("SIGINT", () =>
  server.close(() => {
    if (timer) clearInterval(timer);
    if (dispatchTimer) clearInterval(dispatchTimer);
    if (dispatchWatchdog) clearInterval(dispatchWatchdog);
    store.close?.();
    process.exit(0);
  }),
);

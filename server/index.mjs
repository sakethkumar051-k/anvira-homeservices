import "dotenv/config";
import { createApplication } from "./app.mjs";
const { app, cfg, store, jobs } = await createApplication();
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
timer?.unref();
if (timer) void runJobs();
process.on("SIGTERM", () =>
  server.close(() => {
    if (timer) clearInterval(timer);
    store.close?.();
    process.exit(0);
  }),
);
process.on("SIGINT", () =>
  server.close(() => {
    if (timer) clearInterval(timer);
    store.close?.();
    process.exit(0);
  }),
);

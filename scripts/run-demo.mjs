import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = "4001";
const env = {
  ...process.env,
  NODE_ENV: "development",
  APP_MODE: "demo",
  PAYMENT_MODE: "demo",
  EXPO_PUBLIC_AUTH_MODE: "demo",
  EXPO_PUBLIC_API_URL: "",
  PORT: port,
  WEB_DIST_DIR: path.join(root, "dist-demo"),
  DB_PATH: path.join(root, "server", "review-demo.sqlite"),
  PUBLIC_API_URL: `http://localhost:${port}`,
  WEB_APP_URL: `http://localhost:${port}`,
  ALLOWED_ORIGINS: `http://localhost:${port},http://127.0.0.1:${port}`,
};
await mkdir(path.join(root, "server"), { recursive: true });
async function run(args) {
  const child = spawn(process.execPath, args, {
    cwd: root,
    env,
    stdio: "inherit",
  });
  const stop = () => child.kill("SIGTERM");
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  const code = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => resolve(code));
  });
  process.removeListener("SIGINT", stop);
  process.removeListener("SIGTERM", stop);
  if (code !== 0) process.exit(typeof code === "number" ? code : 1);
}
if (!process.argv.includes("--skip-build")) {
  await run([
    "scripts/export-app.mjs",
    "--platform",
    "web",
    "--output-dir",
    "dist-demo",
  ]);
}
await run(["scripts/seed-review-demo.mjs"]);
console.log(
  `Customer sample sign-in: http://localhost:${port}/?sample=customer`,
);
await run(["server/index.mjs"]);

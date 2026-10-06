import "dotenv/config";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const authMode = process.env.EXPO_PUBLIC_AUTH_MODE || "demo";
if (!["demo", "firebase"].includes(authMode))
  throw new Error(
    "Choose EXPO_PUBLIC_AUTH_MODE=demo or firebase before exporting.",
  );
// Load the environment before starting Expo workers. Mode changes must never
// reuse an earlier preview's inlined Firebase/demo authentication flag.
const child = spawn(
  process.execPath,
  ["node_modules/expo/bin/cli", "export", "--clear", ...process.argv.slice(2)],
  {
    cwd: root,
    env: { ...process.env, EXPO_PUBLIC_AUTH_MODE: authMode },
    stdio: "inherit",
  },
);
child.on("error", () => {
  console.error("The Expo export could not start.");
  process.exitCode = 1;
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, () => child.kill(signal));
child.on("exit", (code) => {
  process.exitCode = typeof code === "number" ? code : 1;
});

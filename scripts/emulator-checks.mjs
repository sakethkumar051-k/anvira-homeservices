import { spawnSync } from "node:child_process";
for (const args of [
  ["--test", "tests/firestore.emulator.mjs"],
  ["scripts/stress-test.mjs", "--firestore-emulator"],
]) {
  const result = spawnSync(process.execPath, args, {
    env: process.env,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    process.exitCode = result.status || 1;
    break;
  }
}

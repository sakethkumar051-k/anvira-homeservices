import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
const require = createRequire(import.meta.url);
const root = resolve(import.meta.dirname, "..");
const config = existsSync(resolve(root, "metro.config.js"))
  ? require("../metro.config.js")
  : require("expo/metro-config").getDefaultConfig(root);
const blocks = Array.isArray(config.resolver.blockList)
  ? config.resolver.blockList
  : [config.resolver.blockList].filter(Boolean);
const blocked = (file) =>
  blocks.some((pattern) => pattern.test(resolve(root, file)));
test("Metro excludes legacy environment variants from the native development context", () => {
  for (const file of [
    ".env.demo.local",
    ".env.firebase.local",
    ".env.staging",
    ".env.test.local",
    ".env.example",
  ])
    assert.equal(blocked(file), true, file);
});
test("Metro retains supported environment files and normal app source", () => {
  for (const file of [
    ".env",
    ".env.local",
    ".env.development",
    ".env.development.local",
    ".env.production",
    ".env.production.local",
    "src/app/index.tsx",
    "src/lib/runtime.ts",
  ])
    assert.equal(blocked(file), false, file);
});

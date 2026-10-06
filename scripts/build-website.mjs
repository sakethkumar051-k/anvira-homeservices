import "dotenv/config";
import { spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { websiteConfig } from "../deployment/vercel-config.mjs";
websiteConfig(process.env);
if (process.env.EXPO_PUBLIC_AUTH_MODE === "firebase") {
  for (const name of [
    "EXPO_PUBLIC_FIREBASE_PROJECT_ID",
    "EXPO_PUBLIC_FIREBASE_API_KEY",
    "EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN",
    "EXPO_PUBLIC_FIREBASE_APP_ID",
  ])
    if (!process.env[name] || /YOUR_|example\.invalid/.test(process.env[name]))
      throw new Error(name + " is required for the Firebase website build.");
}
// Web uses Vercel's same-origin API proxy. Native builds use the API origin directly.
const result = spawnSync(
  process.execPath,
  ["scripts/export-app.mjs", "--platform", "web"],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      EXPO_PUBLIC_API_URL: "",
      EXPO_PUBLIC_WEBSITE_STAFF_ONLY: "true",
    },
  },
);
process.exitCode = result.status ?? 1;
if (result.error) throw result.error;
if (result.status === 0) {
  let html = await readFile("dist/index.html", "utf8");
  html = html.replace(
    "</head>",
    '<meta name="description" content="Explore ANVIRA home services, compare service options and plan your visit. Review scope, price and availability before booking."></head>',
  );
  await writeFile("dist/index.html", html);
  await writeFile(
    "dist/robots.txt",
    process.env.EXPO_PUBLIC_AUTH_MODE === "demo"
      ? "User-agent: *\nDisallow: /\n"
      : "User-agent: *\nDisallow: /\nAllow: /welcome\nAllow: /catalog\n",
  );
}

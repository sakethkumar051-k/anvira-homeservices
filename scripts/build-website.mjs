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
    '<link rel="canonical" href="https://anviraservices.com/welcome"><meta property="og:title" content="ANVIRA Services | Good care. Right at home."><meta property="og:description" content="Doorstep car cleaning from ₹500/month. Laundry pickup and delivery, cleaning, repairs and beauty at home."><meta property="og:type" content="website"><meta property="og:image" content="https://anviraservices.com/brand/anvira-logo.png"><meta name="theme-color" content="#12634F"><link rel="icon" type="image/png" href="/brand/anvira-logo.png"><meta name="description" content="ANVIRA Services: doorstep car cleaning from ₹500/month, laundry and dry-cleaning pickup and delivery, home and commercial cleaning, AC, plumbing, electrical, makeup and sofa care in Shadnagar."></head>',
  );
  html = html.replace(
    /<title>.*?<\/title>/,
    "<title>ANVIRA Services | Doorstep car care, laundry &amp; home services</title>",
  );
  await writeFile("dist/index.html", html);
  await writeFile(
    "dist/sitemap.xml",
    '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://anviraservices.com/welcome</loc></url></urlset>',
  );
  await writeFile(
    "dist/robots.txt",
    process.env.EXPO_PUBLIC_AUTH_MODE === "demo"
      ? "User-agent: *\nDisallow: /\n"
      : "User-agent: *\nDisallow: /\nAllow: /welcome\nAllow: /catalog\nSitemap: https://anviraservices.com/sitemap.xml\n",
  );
}

import { cp, mkdir, writeFile, readFile } from "node:fs/promises";
await mkdir("functions", { recursive: true });
await cp("server", "functions/server", {
  recursive: true,
  filter: (source) =>
    !source.includes(".sqlite") &&
    !/(?:^|[\\/])(backups|private-documents)(?:[\\/]|$)/.test(source),
});
await cp("deployment/functions.mjs", "functions/index.mjs");
await cp("deployment/features.json", "functions/features.json");
const locked = JSON.parse(await readFile("package-lock.json", "utf8"));
const root = JSON.parse(await readFile("package.json", "utf8")),
  names = [
    "firebase-admin",
    "firebase-functions",
    "express",
    "cors",
    "helmet",
    "cookie-parser",
    "express-rate-limit",
    "multer",
    "zod",
  ];
await writeFile(
  "functions/package.json",
  JSON.stringify(
    {
      name: "anvira-functions",
      version: root.version,
      private: true,
      type: "module",
      main: "index.mjs",
      engines: { node: "22" },
      dependencies: Object.fromEntries(
        names.map((name) => [
          name,
          locked.packages["node_modules/" + name].version,
        ]),
      ),
    },
    null,
    2,
  ) + "\n",
);
console.log("Staged Firebase functions from the current server source.");

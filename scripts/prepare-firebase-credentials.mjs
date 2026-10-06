import { createRequire } from "node:module";
import { mkdir, writeFile, rename, chmod } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

// Reuse the client's existing CLI authorization for local development only.
// Deployed services must use their own Google-managed runtime identity.
const require = createRequire(import.meta.url);
const { getAllAccounts } = require("firebase-tools/lib/auth.js");
const { clientId, clientSecret } = require("firebase-tools/lib/api.js");
const email = process.argv[2] || "anviraservicesllp@gmail.com";
const account = getAllAccounts().find((item) => item.user.email === email);
if (!account?.tokens?.refresh_token) {
  console.error(
    `Sign in to Firebase CLI as ${email} before preparing credentials.`,
  );
  process.exit(1);
}
const directory = path.resolve("credentials");
const destination = path.join(directory, "anvira-adc.json");
await mkdir(directory, { recursive: true, mode: 0o700 });
await chmod(directory, 0o700);
const temporary = path.join(directory, `${randomUUID()}.tmp`);
await writeFile(
  temporary,
  JSON.stringify({
    type: "authorized_user",
    client_id: clientId(),
    client_secret: clientSecret(),
    refresh_token: account.tokens.refresh_token,
  }),
  { mode: 0o600 },
);
await rename(temporary, destination);
await chmod(destination, 0o600);
console.log(
  `Local credentials prepared for ${email}; credential contents are never logged.`,
);

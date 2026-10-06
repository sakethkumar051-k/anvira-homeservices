import "dotenv/config";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
const files = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean);
if (!files.length)
  throw new Error(
    "Stage the source files before checking the Git publication.",
  );
const secrets = Object.entries(process.env)
  .filter(
    ([k, v]) =>
      !k.startsWith("EXPO_PUBLIC_") &&
      /SECRET|PASSWORD|ENCRYPTION_KEY|ACCESS_TOKEN|FIREBASE_SERVICE_ACCOUNT/.test(k) &&
      v?.length > 12,
  )
  .map(([, v]) => v);
if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  try {
    const credentials = JSON.parse(
      await readFile(process.env.GOOGLE_APPLICATION_CREDENTIALS),
    );
    for (const [k, v] of Object.entries(credentials))
      if (
        /secret|token|private_key/.test(k) &&
        typeof v === "string" &&
        v.length > 12
      )
        secrets.push(v);
  } catch {
    /* The publication check does not require a server credential. */
  }
}
const findings = [];
for (const file of files) {
  if (
    /(^|\/)(credentials|backups|private-documents|evidence|node_modules|\.vercel)\/|(^|\/)\.env(?!.*\.example$)(?:$|\.)|(^|\/)(google-services\.json|GoogleService-Info\.plist)$|\.sqlite(?:$|-)/.test(
      file,
    )
  )
    findings.push({ file, reason: "Private/generated artifact staged" });
  const content = await readFile(file);
  if (secrets.some((v) => content.includes(Buffer.from(v))))
    findings.push({
      file,
      reason: "Known runtime credential/encryption key staged",
    });
  const text = content.toString("utf8");
  if (
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\bgh[opsu]_[A-Za-z0-9]{30,}|\bgithub_pat_[A-Za-z0-9_]{20,}|"refresh_token"\s*:\s*"[^"\s]{20,}"/.test(
      text,
    )
  )
    findings.push({ file, reason: "Credential pattern staged" });
}
console.log(JSON.stringify({ trackedFiles: files.length, findings }, null, 2));
if (findings.length) process.exitCode = 1;

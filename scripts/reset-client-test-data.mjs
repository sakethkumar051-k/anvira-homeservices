import "dotenv/config";
import { randomBytes, createCipheriv } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { config } from "../server/lib/config.mjs";
import { firebaseServices } from "../server/lib/firebase.mjs";
import { decryptSnapshot, backupCollections } from "../server/lib/backup.mjs";
import { buildClientTestSeed, matchesSeedArchive } from "../server/lib/client-test-seed.mjs";

const cfg = config(), root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const apply = process.argv.includes("--apply");
if (!cfg.live || cfg.projectId !== "anvira-services" || cfg.paymentEnvironment !== "test" || cfg.payoutsEnabled)
  throw Error("This reset is restricted to anvira-services with Razorpay TEST and payouts disabled.");
const { db, auth } = await firebaseServices(cfg);
const collections = await db.listCollections(), docs = [];
for (const collection of collections) {
  const result = await collection.limit(1001).get();
  if (result.size > 1000) throw Error("Reset needs manual pagination for this collection.");
  docs.push(...result.docs);
}
const identities = [];
let token;
do {
  const result = await auth.listUsers(1000, token);
  identities.push(...result.users); token = result.pageToken;
} while (token);
const staff = docs.filter((d) => d.ref.parent.id === "users" && ["owner", "care"].includes(d.data().role));
const protectedIds = new Set([...staff.map((d) => d.id), ...identities.filter((u) => ["owner", "care"].includes(u.customClaims?.role)).map((u) => u.uid)]);
if (!staff.some((s) => s.data().role === "owner") || !protectedIds.size) throw Error("No Owner found; refusing reset.");
const remove = docs.filter((d) => d.ref.parent.id !== "settings" && !(d.ref.parent.id === "users" && protectedIds.has(d.id)));
const company = docs.find((d) => d.ref.path === "settings/company")?.data();
if (!company || company.policyEnvironment !== "test") throw Error("Review-only company settings required.");
const batch = "review-20261103";
const accounts = ["customer", "professional"].flatMap((role) => Array.from({ length: 10 }, (_, index) => {
  const n = String(index + 1).padStart(2, "0"), label = role === "customer" ? "Customer" : "Partner";
  return { id: `${batch}-${role}-${n}`, name: `SAMPLE ${label} ${n}`, role,
    email: `${label.toLowerCase()}${n}@review.anvira.test`, password: randomBytes(15).toString("base64url") + "aA7!" };
}));
if (accounts.some((a) => identities.some((u) => u.uid === a.id || u.email === a.email)))
  throw Error("Seed identities already exist. Refusing to rotate credentials implicitly.");
const seeded = buildClientTestSeed({ accounts, company, batch });
if (remove.length + seeded.records.length + 2 > 500) throw Error("Atomic write budget exceeded.");
console.log(JSON.stringify({ apply, project: cfg.projectId, preserveStaff: protectedIds.size,
  preserveSettings: docs.filter((d) => d.ref.parent.id === "settings").length,
  removeBusinessDocuments: remove.length, seedDocuments: seeded.records.length,
  newCustomers: 10, newPartners: 10, internalWorkers: 5, historicalBookings: 40 }));
if (!apply) process.exit(0);
if (!process.argv.includes("--project=anvira-services") || !process.argv.includes("--reset-business-data"))
  throw Error("Explicit project and --reset-business-data confirmation required.");
const backupPath = process.argv.find((a) => a.startsWith("--backup="))?.slice(9);
if (!backupPath || !path.isAbsolute(backupPath)) throw Error("Pass the verified absolute encrypted backup path.");
const snapshot = decryptSnapshot(await readFile(backupPath), process.env.BACKUP_ENCRYPTION_KEY, cfg.projectId);
const stable = (v) => JSON.stringify(v, (_, value) => value && typeof value === "object" && !Array.isArray(value)
  ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))) : value);
const previous = new Map(snapshot.records.map(({ kind, value }) => [kind + "/" + value.id, value]));
if (docs.length !== snapshot.records.length || docs.some((d) => !matchesSeedArchive(d.ref.path, { ...d.data(), id: d.id }, previous.get(d.ref.path))))
  throw Error("Database changed since backup. Take a fresh verified backup before resetting.");
const health = await fetch("https://anvira-api-staging.onrender.com/api/health", { signal: AbortSignal.timeout(90000) }).then((r) => r.json());
if (health.paymentEnvironment !== "test" || health.configured?.payouts) throw Error("Hosted API is not safely in TEST mode.");
const directory = path.join(root, "credentials"); await mkdir(directory, { recursive: true, mode: 0o700 });
const credentialsPath = path.join(directory, "client-review-20261103.json");
await writeFile(credentialsPath, JSON.stringify({ project: cfg.projectId, batch, accounts }, null, 2), { mode: 0o600, flag: "wx" });
const key = Buffer.from(process.env.BACKUP_ENCRYPTION_KEY || "", "base64");
if (key.length !== 32) throw Error("Valid backup encryption key required.");
const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", key, iv);
cipher.setAAD(Buffer.from("anvira-auth-reset-archive-v1"));
const ciphertext = Buffer.concat([cipher.update(JSON.stringify({ project: cfg.projectId, at: Date.now(), users: identities.map((u) => u.toJSON()) })), cipher.final()]);
await writeFile(path.join(root, "server/backups/pre-client-reset-20261103-auth.enc"),
  Buffer.concat([Buffer.from("ANA1"), iv, cipher.getAuthTag(), ciphertext]), { mode: 0o600, flag: "wx" });
const created = [], disabled = [], runToken = randomBytes(16).toString("hex");
let databaseAttempted = false, committed = false;
try {
  for (const a of accounts) {
    await auth.createUser({ uid: a.id, email: a.email, password: a.password, displayName: a.name, emailVerified: false, disabled: false });
    created.push(a.id);
  }
  for (const u of identities.filter((u) => !protectedIds.has(u.uid) && !u.disabled)) {
    await auth.updateUser(u.uid, { disabled: true }); disabled.push(u.uid);
  }
  databaseAttempted = true;
  await db.runTransaction(async (tx) => {
    const current = [];
    for (const kind of new Set([...backupCollections, ...collections.map((c) => c.id)])) {
      const result = await tx.get(db.collection(kind));
      current.push(...result.docs);
    }
    if (current.length !== previous.size || current.some((d) => !matchesSeedArchive(d.ref.path, { ...d.data(), id: d.id }, previous.get(d.ref.path))))
      throw Error("Concurrent update detected; reset cancelled.");
    for (const d of remove) tx.delete(d.ref);
    for (const { kind, value } of seeded.records) tx.set(db.collection(kind).doc(value.id), value);
    tx.set(db.collection("settings").doc("company"), { ...company, id: "company", dispatchMode: "office_first", externalPartnersEnabled: false });
    tx.set(db.collection("audit").doc(batch), { id: batch, action: "client_test_data_reset", sample: true, reviewOnly: true,
      runToken, preservedStaffIds: [...protectedIds], newAuthUsers: 20, archivedBusinessDocuments: remove.length, createdAt: Date.now() });
  });
  committed = true;
} catch (error) {
  if (databaseAttempted) {
    const marker = await db.collection("audit").doc(batch).get().catch(() => null);
    committed = marker?.data()?.runToken === runToken;
  }
  if (!committed) {
    // Never delete identities on an uncertain database commit. Preserve enough
    // private state to reconcile every attempted UID, including ambiguous RPCs.
    await writeFile(path.join(directory, "client-reset-recovery-20261103.json"), JSON.stringify({
      project: cfg.projectId, runToken, databaseAttempted, created, disabled,
      plannedAccountIds: accounts.map((a) => a.id),
      oldNonstaff: identities.filter((u) => !protectedIds.has(u.uid)).map((u) => ({ id: u.uid, disabled: u.disabled })),
      credentialsPath, backupPath, errorCode: error.code || "RESET_NOT_CONFIRMED",
    }, null, 2), { mode: 0o600 });
    throw Error("Reset not confirmed; Auth identities preserved. Inspect the private recovery manifest before continuing.");
  }
}
for (const d of staff) {
  const current = await db.collection("users").doc(d.id).get();
  if (stable(current.data()) !== stable(d.data())) throw Error("Staff record changed unexpectedly.");
}
const markdown = ["# ANVIRA private client test logins", "", "Android APK: https://expo.dev/artifacts/eas/qmmrz1fnSH94Qem3AfhnCP6ASyL0WenWOzZUGqeA9nM.apk", "",
  "Use the email and password below in the installed Android app. Partner accounts use Professional / Partner sign-in. Existing website staff logins were preserved.", "",
  "These are fictional review accounts. Do not share this file publicly. All seeded history and earnings are fictional; use a new booking with Razorpay TEST for actual payment tests. Coverage PIN: 509216.", "",
  "| Role | Email | Password |", "| --- | --- | --- |", ...accounts.map((a) => `| ${a.role === "customer" ? "Customer" : "Partner"} | ${a.email} | ${a.password} |`), "",
  "Partner09 is deliberately unapproved; Partner10 is unavailable. Partners01–08 are approved and available. Five salaried internal workers have no app login.", ""].join("\n");
const markdownPath = path.join(directory, "client-review-20261103.md");
await writeFile(markdownPath, markdown, { mode: 0o600, flag: "wx" });
console.log(JSON.stringify({ applied: true, newAuthAccounts: created.length, oldNonstaffAccountsDisabled: disabled.length, staffPreserved: staff.length,
  credentialsFile: markdownPath, backup: backupPath, seedDocuments: seeded.records.length }));

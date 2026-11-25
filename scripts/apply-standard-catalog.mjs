import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { standardServices } from "../server/lib/standard-catalog.mjs";
import { serviceSchema } from "../server/lib/schemas.mjs";
import { encryptSnapshot, decryptSnapshot } from "../server/lib/backup.mjs";
const version = "anvira-standard-services-v1";
const stable = (value) =>
  JSON.stringify(value, (_, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(
          Object.entries(v).sort(([a], [b]) => a.localeCompare(b)),
        )
      : v,
  );
export const standardPlanHash = (plan) =>
  createHash("sha256").update(stable(plan)).digest("hex");
export function buildStandardCatalogPlan(services, professionals) {
  const operations = [];
  for (const template of standardServices) {
    const before = services.find((s) => s.id === template.id) || null;
    if (before?.catalogTemplateVersion === version) continue;
    if (!before && template.id !== "review-car-wash")
      throw Error("Required current service is missing: " + template.id);
    if (before && template.id === "review-car-wash")
      throw Error(
        "Reserved car-wash service already exists; review it separately.",
      );
    const after = {
      ...before,
      ...serviceSchema.parse(template),
      id: template.id,
      sample: false,
      reviewOnly: true,
      catalogTemplateVersion: version,
    };
    operations.push({ kind: "services", id: template.id, before, after });
  }
  // These two accountless fictional workers already power the client test app.
  // Never add skills or approvals to a real worker.
  for (const before of professionals) {
    if (
      !["review-internal-booking-1", "review-internal-booking-2"].includes(
        before.id,
      ) ||
      !before.reviewOnly ||
      !before.sample ||
      !before.accountless ||
      before.skills?.includes("review-car-wash")
    )
      continue;
    operations.push({
      kind: "professionals",
      id: before.id,
      before,
      after: {
        ...before,
        skills: [...(before.skills || []), "review-car-wash"],
      },
    });
  }
  return { format: version, operations };
}
export async function applyStandardCatalogPlan(store, plan) {
  if (
    plan.format !== version ||
    !Array.isArray(plan.operations) ||
    plan.operations.length > 8
  )
    throw Error("Invalid standard-catalog plan.");
  const allowed = new Set(standardServices.map((s) => "services/" + s.id));
  for (const id of ["review-internal-booking-1", "review-internal-booking-2"])
    allowed.add("professionals/" + id);
  if (
    new Set(plan.operations.map((o) => o.kind + "/" + o.id)).size !==
    plan.operations.length
  )
    throw Error("Duplicate catalog operations.");
  for (const o of plan.operations) {
    if (!allowed.has(o.kind + "/" + o.id) || o.after?.id !== o.id)
      throw Error("Invalid standard-catalog target.");
    if (o.kind === "services") serviceSchema.parse(o.after);
    if (
      o.kind === "professionals" &&
      (!o.before?.sample || !o.before?.reviewOnly || !o.before?.accountless)
    )
      throw Error("Only existing test workers can be updated.");
  }
  return store.transaction(async (tx) => {
    for (const o of plan.operations) {
      const current = await tx.get(o.kind, o.id);
      if (stable(current) !== stable(o.before))
        throw Error("Record changed since review: " + o.kind + "/" + o.id);
    }
    for (const o of plan.operations) tx.put(o.kind, o.after);
    return {
      changed: plan.operations.length,
      services: plan.operations.filter((o) => o.kind === "services").length,
    };
  });
}
async function main(args) {
  const option = (name) =>
    args.find((a) => a.startsWith(name + "="))?.slice(name.length + 1);
  await import("dotenv/config");
  const { config } = await import("../server/lib/config.mjs");
  const cfg = config();
  if (
    !cfg.live ||
    cfg.projectId !== "anvira-services" ||
    option("--project") !== cfg.projectId ||
    cfg.paymentEnvironment !== "test" ||
    cfg.payoutsEnabled
  )
    throw Error(
      "Confirm anvira-services with TEST payments and payouts disabled.",
    );
  const { firebaseServices } = await import("../server/lib/firebase.mjs");
  const { createFirestoreStore } = await import("../server/lib/store.mjs");
  const { db } = await firebaseServices({
    ...cfg,
    privateDocumentDir: undefined,
  });
  try {
    const store = createFirestoreStore(db);
    const plan = buildStandardCatalogPlan(
      await store.list("services", [], 100),
      await store.list("professionals", [], 100),
    );
    const fingerprint = standardPlanHash(plan);
    console.log(
      JSON.stringify(
        {
          project: cfg.projectId,
          planHash: fingerprint,
          changes: plan.operations.map((o) => ({
            kind: o.kind,
            id: o.id,
            created: !o.before,
            mode: o.after.bookingMode,
            options: o.after.packages?.map((p) => ({
              name: p.name,
              price: p.price,
            })),
          })),
        },
        null,
        2,
      ),
    );
    if (!args.includes("--apply")) return;
    if (option("--expected") !== fingerprint)
      throw Error("Plan changed; inspect the new dry run before applying.");
    if (!plan.operations.length) return;
    const backup = option("--backup");
    if (
      !backup ||
      !path.isAbsolute(backup) ||
      path.resolve(backup).startsWith(process.cwd() + path.sep)
    )
      throw Error(
        "Use an absolute private backup path outside the repository.",
      );
    const snapshot = {
      format: "anvira-snapshot-v1",
      project: cfg.projectId,
      at: Date.now(),
      records: plan.operations
        .filter((o) => o.before)
        .map((o) => ({ kind: o.kind, value: o.before })),
      absentRecords: plan.operations
        .filter((o) => !o.before)
        .map((o) => ({ kind: o.kind, id: o.id })),
      planHash: fingerprint,
    };
    await writeFile(
      backup,
      encryptSnapshot(snapshot, process.env.BACKUP_ENCRYPTION_KEY),
      { flag: "wx", mode: 0o600 },
    );
    const restored = decryptSnapshot(
      await readFile(backup),
      process.env.BACKUP_ENCRYPTION_KEY,
      cfg.projectId,
    );
    if (stable(restored.records) !== stable(snapshot.records))
      throw Error("Backup verification failed.");
    const result = await applyStandardCatalogPlan(store, plan);
    console.log(
      JSON.stringify({
        applied: true,
        backupVerified: true,
        ...result,
        bookingsChanged: 0,
        authUsersChanged: 0,
        monthlyPlanChanged: false,
      }),
    );
  } finally {
    await db.terminate();
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
)
  main(process.argv.slice(2)).catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });

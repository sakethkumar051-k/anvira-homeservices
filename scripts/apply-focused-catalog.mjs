import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  backupCollections,
  encryptSnapshot,
  decryptSnapshot,
} from "../server/lib/backup.mjs";
import { serviceSchema } from "../server/lib/schemas.mjs";

const stable = (value) =>
  JSON.stringify(value, (_, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(
          Object.entries(v).sort(([a], [b]) => a.localeCompare(b)),
        )
      : v,
  );
const hash = (value) =>
  createHash("sha256").update(stable(value)).digest("hex");
const recordKey = (r) => r.kind + "/" + r.value.id;
const expectedActive = [
  "review-ac",
  "review-car-cleaning",
  "review-cleaning",
  "review-electrical",
  "review-plumbing",
  "review-ro",
];
export const catalogSnapshotHash = (records) =>
  hash([...records].sort((a, b) => recordKey(a).localeCompare(recordKey(b))));

export async function readCatalogSnapshot(store) {
  const records = [];
  for (const kind of backupCollections) {
    const values = await store.list(kind, [], 1000);
    if (values.length >= 1000)
      throw Error(
        "Collection needs a paginated managed export before catalog migration.",
      );
    records.push(...values.map((value) => ({ kind, value })));
  }
  return records;
}

function validateDraft(records, draft) {
  if (
    draft?.format !== "anvira-focused-catalog-draft-v1" ||
    draft.project !== "anvira-services" ||
    !Array.isArray(draft.operations) ||
    !Array.isArray(draft.preserved)
  )
    throw Error("Unrecognized catalog draft.");
  const current = new Map(
    records
      .filter((r) => r.kind === "services")
      .map((r) => [r.value.id, r.value]),
  );
  const expectedIds = new Set([
    ...draft.operations.filter((o) => o.before !== null).map((o) => o.id),
    ...draft.preserved.map((o) => o.id),
  ]);
  if (
    current.size !== expectedIds.size ||
    [...current.keys()].some((id) => !expectedIds.has(id))
  )
    throw Error(
      "Catalog changed since draft; an unexpected record was added or removed.",
    );
  if (
    new Set(draft.operations.map((o) => o.id)).size !==
      draft.operations.length ||
    draft.operations.length > 20
  )
    throw Error("Invalid duplicate or oversized catalog operations.");
  for (const preserved of draft.preserved)
    if (
      !current.has(preserved.id) ||
      hash(current.get(preserved.id)) !== preserved.hash
    )
      throw Error(
        "Catalog changed since draft; a preserved reviewed record differs.",
      );
  const ac = current.get("review-ac");
  if (
    !ac ||
    ac.price !== 599 ||
    ac.sample !== false ||
    draft.operations.some((o) => o.id === "review-ac")
  )
    throw Error("Reviewed AC must remain unchanged.");
  const after = new Map(current);
  for (const operation of draft.operations) {
    if (
      !["update", "create", "archive"].includes(operation.action) ||
      operation.id !== operation.after?.id ||
      !/^review-[a-z0-9-]+$/.test(operation.id)
    )
      throw Error("Unapproved catalog operation.");
    if (operation.before === null) {
      if (
        operation.id !== "review-ro" ||
        current.has(operation.id) ||
        operation.action !== "create"
      )
        throw Error("Catalog changed since draft; new record conflicts.");
    } else if (
      !current.has(operation.id) ||
      hash(current.get(operation.id)) !== operation.beforeHash ||
      hash(operation.before) !== operation.beforeHash
    )
      throw Error("Catalog changed since draft; an original service differs.");
    if (
      operation.id === "review-painting" &&
      stable(operation.after) !== stable({ ...operation.before, active: false })
    )
      throw Error("Reviewed Painting may only become inactive.");
    serviceSchema.parse(operation.after);
    after.set(operation.id, operation.after);
  }
  const active = [...after.values()]
    .filter((s) => s.active)
    .map((s) => s.id)
    .sort();
  if (stable(active) !== stable(expectedActive))
    throw Error("Catalog must publish exactly the six reviewed focus IDs.");
  for (const id of expectedActive.filter((id) => id !== "review-ac"))
    if (after.get(id).bookingMode !== "quote")
      throw Error("Unapproved focus prices must use quote-only booking.");
  if (
    stable([...after.values()].sort((a, b) => a.id.localeCompare(b.id))) !==
    stable([...draft.after].sort((a, b) => a.id.localeCompare(b.id)))
  )
    throw Error("Draft after-state does not match its operations.");
  return after;
}

export async function applyCatalogDraft(store, draft, expectedSnapshotHash) {
  if (
    typeof expectedSnapshotHash !== "string" ||
    expectedSnapshotHash.length !== 64
  )
    throw Error("A verified whole-database snapshot is required.");
  return store.transaction(async (tx) => {
    const current = await readCatalogSnapshot(tx);
    if (catalogSnapshotHash(current) !== expectedSnapshotHash)
      throw Error("Database changed since backup; no catalog changes applied.");
    const after = validateDraft(current, draft);
    // These are the only mutations. Bookings, policies, users, Auth and every
    // unrelated collection remain outside this write path.
    for (const operation of draft.operations)
      tx.put("services", operation.after);
    return {
      operations: draft.operations.length,
      activeServices: [...after.values()]
        .filter((s) => s.active)
        .map((s) => s.id)
        .sort(),
    };
  });
}

async function main(args) {
  const option = (name) =>
    args.find((arg) => arg.startsWith(name + "="))?.slice(name.length + 1);
  const apply = args.includes("--apply"),
    draftPath = option("--draft"),
    backupPath = option("--backup");
  if (!draftPath || !path.isAbsolute(draftPath))
    throw Error(
      "Pass the reviewed absolute --draft=/private/catalog.json path.",
    );
  if (apply && (!backupPath || !path.isAbsolute(backupPath)))
    throw Error(
      "Application requires a new absolute encrypted --backup=/private/catalog.enc path.",
    );
  if (
    backupPath
      ?.split(path.sep)
      .some((part) =>
        ["public", "dist", "dist-demo", "build-check"].includes(part),
      )
  )
    throw Error(
      "Catalog backups must remain outside public/build directories.",
    );
  await import("dotenv/config");
  const { config } = await import("../server/lib/config.mjs");
  const cfg = config();
  if (
    !cfg.live ||
    cfg.projectId !== "anvira-services" ||
    option("--project") !== cfg.projectId
  )
    throw Error("Confirm the exact anvira-services Firebase project.");
  if (apply && (cfg.paymentEnvironment !== "test" || cfg.payoutsEnabled))
    throw Error(
      "This reviewed migration is restricted to TEST payments with payouts disabled.",
    );
  const draft = JSON.parse(await readFile(draftPath, "utf8"));
  if (draft.operations?.length !== 11)
    throw Error(
      "The reviewed cloud draft must contain exactly eleven operations.",
    );
  const { firebaseServices } = await import("../server/lib/firebase.mjs");
  const { createFirestoreStore } = await import("../server/lib/store.mjs");
  let db;
  try {
    ({ db } = await firebaseServices(cfg));
    const kinds = await db.listCollections();
    if (kinds.some((c) => !backupCollections.includes(c.id)))
      throw Error("Backup coverage does not include every current collection.");
    const store = createFirestoreStore(db),
      records = await readCatalogSnapshot(store);
    const after = validateDraft(records, draft);
    console.log(
      JSON.stringify(
        {
          apply,
          project: cfg.projectId,
          scanned: records.length,
          operations: draft.operations.length,
          activeServices: [...after.values()]
            .filter((s) => s.active)
            .map((s) => s.id)
            .sort(),
          authUsersChanged: 0,
        },
        null,
        2,
      ),
    );
    if (!apply) return;
    const snapshot = {
      format: "anvira-snapshot-v1",
      project: cfg.projectId,
      at: Date.now(),
      records,
    };
    await writeFile(
      backupPath,
      encryptSnapshot(snapshot, process.env.BACKUP_ENCRYPTION_KEY),
      { mode: 0o600, flag: "wx" },
    );
    const verified = decryptSnapshot(
      await readFile(backupPath),
      process.env.BACKUP_ENCRYPTION_KEY,
      cfg.projectId,
    );
    if (catalogSnapshotHash(verified.records) !== catalogSnapshotHash(records))
      throw Error("Catalog archive verification failed; no writes performed.");
    const result = await applyCatalogDraft(
      store,
      draft,
      catalogSnapshotHash(records),
    );
    console.log(
      JSON.stringify({
        applied: true,
        backupVerified: true,
        ...result,
        authUsersChanged: 0,
      }),
    );
  } finally {
    if (db) await db.terminate();
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
)
  main(process.argv.slice(2)).catch((error) => {
    console.error("Catalog application stopped:", error.message);
    process.exitCode = 1;
  });

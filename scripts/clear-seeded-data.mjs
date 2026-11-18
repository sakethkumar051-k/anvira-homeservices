import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const preservedKinds = new Set(["settings", "services"]);
const staffRoles = new Set(["owner", "care"]);
const identityKinds = new Set(["users", "professionals"]);
const businessKinds = new Set([
  "users",
  "professionals",
  "bookings",
  "addresses",
  "tickets",
  "notifications",
  "messages",
  "promotions",
  "ledger",
  "wallets",
  "reviewWallets",
  "reviewLedger",
  "payouts",
  "jobs",
  "outbox",
  "devices",
  "audit",
  "requests",
  "events",
  "locks",
  "dispatchOffers",
  "quota",
  "checkoutTickets",
  "cleanup",
  "identityCleanup",
  "serviceQuotes",
  "homeCareFavorites",
  "homeCareReminders",
  "homeCareAssets",
  "bankVerifications",
]);
const relatedKinds = new Set(
  [...businessKinds].filter(
    (kind) =>
      !identityKinds.has(kind) && !["wallets", "reviewWallets"].includes(kind),
  ),
);
const accountDataKinds = new Set([
  "addresses",
  "notifications",
  "outbox",
  "devices",
  "homeCareFavorites",
  "homeCareAssets",
  "homeCareReminders",
  "reviewWallets",
]);
const identityFields = new Set([
  "customerId",
  "professionalId",
  "userId",
  "senderId",
  "actor",
  "actorId",
]);
const seedKey =
  /^(reviewDashboardV6-\d+|review-first-booking-\d{4}-\d{2}-\d{2}|journey-v3-(car-cleaning|cleaning|sofa|ac)|review-partner-v4-kitchen|professional-review-\d{4}-\d{2}-\d{2}-.+)$/;
const localIdentity =
  /^(customer-1|pro-[123]|review-customer-[1-6]|review-pro-[1-5])$/;
const localNames = {
  "customer-1": "Ananya",
  "pro-1": "Ravi Kumar",
  "pro-2": "Suresh Reddy",
  "pro-3": "Kiran",
};
const knownLocalIdentity = (v) =>
  localIdentity.test(v.id) &&
  !v.email &&
  !v.phone &&
  (localNames[v.id] === v.name ||
    (/^review-(customer-[1-6]|pro-[1-5])$/.test(v.id) &&
      v.name?.endsWith(" (sample)")));
const key = ({ kind, value }) => kind + "/" + value.id;
const marked = (v) =>
  v.sample === true ||
  v.seededHistory === true ||
  (typeof v.seedBatch === "string" && v.seedBatch.length > 0);
const hasProviderMoney = (v) =>
  ["paymentId", "orderId", "refundId", "gatewayId", "fundAccountId"].some(
    (field) =>
      typeof v[field] === "string" && v[field] && !v[field].startsWith("demo_"),
  );
const referencesIdentity = (v, id) =>
  Object.entries(v).some(
    ([field, value]) => identityFields.has(field) && value === id,
  );
const stable = (value) =>
  JSON.stringify(value, (_, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(
          Object.entries(v).sort(([a], [b]) => a.localeCompare(b)),
        )
      : v,
  );
const digest = (records) =>
  createHash("sha256")
    .update(stable([...records].sort((a, b) => key(a).localeCompare(key(b)))))
    .digest("hex");

// Cloud records require explicit stored provenance. Known legacy identifiers are
// considered only for the two deliberately local demo databases.
export function planSeedCleanup(records, { localDemo = false } = {}) {
  const remove = new Map();
  const protectedIds = new Set(
    records
      .filter((r) => r.kind === "users" && staffRoles.has(r.value.role))
      .map((r) => r.value.id),
  );
  const canRemove = (r) =>
    businessKinds.has(r.kind) &&
    !preservedKinds.has(r.kind) &&
    !(
      identityKinds.has(r.kind) &&
      (staffRoles.has(r.value.role) || protectedIds.has(r.value.id))
    ) &&
    !hasProviderMoney(r.value);
  for (const r of records)
    if (
      !identityKinds.has(r.kind) &&
      !["wallets", "reviewWallets"].includes(r.kind) &&
      canRemove(r) &&
      marked(r.value)
    )
      remove.set(key(r), r);
  if (localDemo) {
    for (const r of records) {
      const v = r.value;
      if (!canRemove(r)) continue;
      if (
        (r.kind === "bookings" && seedKey.test(v.idempotencyKey || "")) ||
        (r.kind === "tickets" &&
          /^(demo-support-quality|reviewDashboardV6-ticket-[0-4])$/.test(
            v.id,
          )) ||
        (r.kind === "payouts" &&
          /^reviewDashboardV6-payout-(paid|requested)$/.test(v.id) &&
          v.simulated === true) ||
        (r.kind === "promotions" && v.id === "DEMO100") ||
        (r.kind === "addresses" &&
          /^(review-home|review-office|review-customer-[1-6]-home)$/.test(v.id))
      )
        remove.set(key(r), r);
    }
  }
  const bookingIds = new Set(
    [...remove.values()]
      .filter((r) => r.kind === "bookings")
      .map((r) => r.value.id),
  );
  const preservedBookingIds = new Set(
    records
      .filter((r) => r.kind === "bookings" && !bookingIds.has(r.value.id))
      .map((r) => r.value.id),
  );
  for (const r of remove.values())
    if (
      preservedBookingIds.has(r.value.bookingId) ||
      (r.kind === "audit" && preservedBookingIds.has(r.value.target))
    )
      remove.delete(key(r));
  for (const r of records)
    if (
      relatedKinds.has(r.kind) &&
      canRemove(r) &&
      (bookingIds.has(r.value.bookingId) ||
        (r.kind === "audit" && bookingIds.has(r.value.target)))
    )
      remove.set(key(r), r);

  const candidates = new Set(
    records
      .filter(
        (r) =>
          identityKinds.has(r.kind) &&
          canRemove(r) &&
          (marked(r.value) || (localDemo && knownLocalIdentity(r.value))),
      )
      .map((r) => r.value.id),
  );
  if (localDemo)
    for (const r of records)
      if (
        r.kind === "bankVerifications" &&
        canRemove(r) &&
        candidates.has(r.value.professionalId) &&
        r.value.gatewayId?.startsWith("demo_")
      )
        remove.set(key(r), r);
  const retainedBusiness = records.filter(
    (r) =>
      !remove.has(key(r)) &&
      !identityKinds.has(r.kind) &&
      !preservedKinds.has(r.kind) &&
      !accountDataKinds.has(r.kind) &&
      !["wallets", "reviewWallets", "audit"].includes(r.kind),
  );
  for (const id of candidates) {
    // A manually created booking, quote, ticket or financial record keeps its
    // account intact, even when that account originally came from a seed.
    if (retainedBusiness.some((r) => referencesIdentity(r.value, id))) continue;
    for (const r of records)
      if (
        canRemove(r) &&
        ((identityKinds.has(r.kind) && r.value.id === id) ||
          (accountDataKinds.has(r.kind) &&
            (referencesIdentity(r.value, id) ||
              (r.kind === "reviewWallets" && r.value.id === id))) ||
          (localDemo &&
            r.kind === "bankVerifications" &&
            r.value.professionalId === id &&
            r.value.gatewayId?.startsWith("demo_")))
      )
        remove.set(key(r), r);
  }
  const update = [];
  if (localDemo) {
    for (const wallet of records.filter((r) => r.kind === "wallets")) {
      const id = wallet.value.id;
      const removedLedger = records.some(
        (r) =>
          r.kind === "ledger" &&
          r.value.professionalId === id &&
          remove.has(key(r)),
      );
      if (!localIdentity.test(id) || !removedLedger) continue;
      const remainingPayout = records.some(
        (r) =>
          r.kind === "payouts" &&
          r.value.professionalId === id &&
          !remove.has(key(r)),
      );
      if (remainingPayout) {
        // Do not break a mixed wallet. Preserve its source ledger until an
        // operator can reconcile that account's remaining payout separately.
        for (const r of records.filter(
          (r) => r.kind === "ledger" && r.value.professionalId === id,
        ))
          remove.delete(key(r));
        continue;
      }
      const remainingLedger = records.filter(
        (r) =>
          r.kind === "ledger" &&
          r.value.professionalId === id &&
          !remove.has(key(r)),
      );
      if (!remainingLedger.length) remove.set(key(wallet), wallet);
      else
        update.push({
          kind: "wallets",
          value: {
            ...wallet.value,
            available: remainingLedger.reduce(
              (total, r) => total + r.value.amount,
              0,
            ),
            held: 0,
            paid: 0,
          },
        });
    }
  }
  return {
    remove: [...remove.values()],
    update,
    keep: records.filter((r) => !remove.has(key(r))),
  };
}

function summary(records, plan) {
  const counts = (items) =>
    items.reduce(
      (out, r) => ({ ...out, [r.kind]: (out[r.kind] || 0) + 1 }),
      {},
    );
  return {
    scanned: records.length,
    remove: counts(plan.remove),
    update: counts(plan.update),
    preserve: counts(plan.keep),
    catalog: records
      .filter((r) => r.kind === "services")
      .map((r) => ({
        id: r.value.id,
        category: r.value.category,
        price: r.value.price,
        bookingMode: r.value.bookingMode || "instant",
        active: !!r.value.active,
        sample: !!r.value.sample,
        sampleReviewed: !!r.value.sampleReviewed,
        reviewOnly: !!r.value.reviewOnly,
      })),
    authUsersChanged: 0,
  };
}

async function main(args) {
  const apply = args.includes("--apply");
  const option = (name) =>
    args.find((arg) => arg.startsWith(name + "="))?.slice(name.length + 1);
  const sqlite = option("--sqlite");
  const backup = option("--backup");
  if (apply && (!backup || !path.isAbsolute(backup)))
    throw Error(
      "--apply requires a new absolute --backup=/private/path/archive.enc file.",
    );
  await import("dotenv/config");
  const { encryptSnapshot, decryptSnapshot, backupCollections } =
    await import("../server/lib/backup.mjs");
  let database, firestore;
  try {
    let project, records, readCurrent;
    if (sqlite) {
      const filename = path.resolve(sqlite);
      const root = path.resolve(
        path.dirname(new URL(import.meta.url).pathname),
        "..",
      );
      if (
        !["anvira.sqlite", "review-demo.sqlite"].some(
          (name) => filename === path.join(root, "server", name),
        )
      )
        throw Error(
          "Local cleanup targets only server/anvira.sqlite or server/review-demo.sqlite.",
        );
      const { DatabaseSync } = await import("node:sqlite");
      database = new DatabaseSync(filename, { readOnly: !apply });
      project = "local-demo:" + path.basename(filename);
      readCurrent = () =>
        database
          .prepare("SELECT kind,id,data FROM records ORDER BY kind,id")
          .all()
          .map((r) => ({
            kind: r.kind,
            value: { ...JSON.parse(r.data), id: r.id },
          }));
      records = readCurrent();
    } else {
      const { config } = await import("../server/lib/config.mjs");
      const cfg = config();
      if (!cfg.live || !cfg.projectId || option("--project") !== cfg.projectId)
        throw Error(
          "Cloud cleanup requires --project=<exact configured Firebase project ID> in Firebase mode.",
        );
      if (apply && (cfg.paymentEnvironment !== "test" || cfg.payoutsEnabled))
        throw Error(
          "Cloud cleanup application is restricted to TEST payments with payouts disabled.",
        );
      const { firebaseServices } = await import("../server/lib/firebase.mjs");
      firestore = (await firebaseServices(cfg)).db;
      project = cfg.projectId;
      const collections = await firestore.listCollections();
      readCurrent = async (tx) => {
        const output = [];
        for (const collection of collections) {
          const snapshot = await (tx
            ? tx.get(collection.limit(1001))
            : collection.limit(1001).get());
          if (snapshot.size > 1000)
            throw Error(
              "Collection exceeds the atomic cleanup audit limit; use a paginated managed export.",
            );
          output.push(
            ...snapshot.docs.map((d) => ({
              kind: collection.id,
              value: { ...d.data(), id: d.id },
            })),
          );
        }
        return output;
      };
      records = await readCurrent();
    }
    const plan = planSeedCleanup(records, { localDemo: !!sqlite });
    const expectedRemove = option("--expect-remove");
    const expectedBookings = option("--expect-preserve-bookings");
    if (
      expectedRemove !== undefined &&
      plan.remove.length !== Number(expectedRemove)
    )
      throw Error(
        "Removal count differs from the reviewed plan; no cleanup applied.",
      );
    if (
      expectedBookings !== undefined &&
      plan.keep.filter((r) => r.kind === "bookings").length !==
        Number(expectedBookings)
    )
      throw Error(
        "Retained booking count differs from the reviewed plan; no cleanup applied.",
      );
    console.log(
      JSON.stringify({ apply, project, ...summary(records, plan) }, null, 2),
    );
    if (!apply || (!plan.remove.length && !plan.update.length)) return;
    if (records.some((r) => !backupCollections.includes(r.kind)))
      throw Error(
        "Archive coverage does not include every collection. Extend backupCollections before applying.",
      );
    if (
      backup.split(path.sep).includes("public") ||
      backup
        .split(path.sep)
        .some((part) => /^(dist|dist-demo|build-check)$/.test(part))
    )
      throw Error("Backups must stay outside public/build directories.");
    const snapshot = {
      format: "anvira-snapshot-v1",
      project,
      at: Date.now(),
      records,
    };
    await mkdir(path.dirname(backup), { recursive: true, mode: 0o700 });
    await writeFile(
      backup,
      encryptSnapshot(snapshot, process.env.BACKUP_ENCRYPTION_KEY),
      { mode: 0o600, flag: "wx" },
    );
    const verified = decryptSnapshot(
      await readFile(backup),
      process.env.BACKUP_ENCRYPTION_KEY,
      project,
    );
    if (digest(verified.records) !== digest(records))
      throw Error("Backup verification failed; no data changed.");
    if (database) {
      database.exec("BEGIN IMMEDIATE");
      try {
        if (digest(readCurrent()) !== digest(records))
          throw Error("Database changed since backup; no cleanup applied.");
        const remove = database.prepare(
          "DELETE FROM records WHERE kind=? AND id=?",
        );
        const put = database.prepare(
          "INSERT OR REPLACE INTO records(kind,id,data) VALUES(?,?,?)",
        );
        for (const r of plan.remove) remove.run(r.kind, r.value.id);
        for (const r of plan.update)
          put.run(r.kind, r.value.id, JSON.stringify(r.value));
        database.exec("COMMIT");
      } catch (error) {
        database.exec("ROLLBACK");
        throw error;
      }
    } else {
      if (plan.remove.length + plan.update.length > 400)
        throw Error(
          "Atomic cleanup write budget exceeded; no cleanup applied.",
        );
      await firestore.runTransaction(async (tx) => {
        if (digest(await readCurrent(tx)) !== digest(records))
          throw Error("Database changed since backup; no cleanup applied.");
        for (const r of plan.remove)
          tx.delete(firestore.collection(r.kind).doc(r.value.id));
        for (const r of plan.update)
          tx.set(firestore.collection(r.kind).doc(r.value.id), r.value);
      });
    }
    console.log(
      JSON.stringify({
        applied: true,
        removed: plan.remove.length,
        updated: plan.update.length,
        backupVerified: true,
        authUsersChanged: 0,
      }),
    );
  } finally {
    database?.close();
    if (firestore) await firestore.terminate();
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
)
  main(process.argv.slice(2)).catch((error) => {
    console.error("Seed cleanup stopped:", error.message);
    process.exitCode = 1;
  });

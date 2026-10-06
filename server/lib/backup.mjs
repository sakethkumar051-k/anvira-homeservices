import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
export const backupCollections = [
  "avatars",
  "settings",
  "users",
  "services",
  "professionals",
  "bookings",
  "addresses",
  "tickets",
  "notifications",
  "messages",
  "promotions",
  "ledger",
  "wallets",
  "payouts",
  "jobs",
  "outbox",
  "devices",
  "audit",
  "requests",
  "events",
  "locks",
  "quota",
  "checkoutTickets",
  "cleanup",
  "identityCleanup",
];
function encryptionKey(value) {
  if (
    !/^[A-Za-z0-9+/]{43}=$/.test(value || "") ||
    Buffer.from(value, "base64").length !== 32
  )
    throw new Error("BACKUP_ENCRYPTION_KEY must contain a 32-byte base64 key.");
  return Buffer.from(value, "base64");
}
export async function exportSnapshot(store, project) {
  const records = [];
  for (const kind of backupCollections) {
    let cursor;
    do {
      const rows = await store.list(kind, [], 200, {
        order: [["id", "asc"]],
        cursor,
      });
      for (const value of rows) records.push({ kind, value });
      if (records.length > 100000)
        throw new Error(
          "Snapshot limit exceeded; use a managed export for this database.",
        );
      cursor = rows.length === 200 ? [rows.at(-1).id] : null;
    } while (cursor);
  }
  return { format: "anvira-snapshot-v1", project, at: Date.now(), records };
}
export function encryptSnapshot(snapshot, key) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", encryptionKey(key), iv);
  cipher.setAAD(Buffer.from("anvira-backup-v1"));
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(snapshot), "utf8"),
    cipher.final(),
  ]);
  return Buffer.concat([
    Buffer.from("ANV1"),
    iv,
    cipher.getAuthTag(),
    ciphertext,
  ]);
}
export function decryptSnapshot(buffer, key, expectedProject) {
  if (
    buffer.length < 33 ||
    buffer.length > 100 * 1024 * 1024 ||
    buffer.subarray(0, 4).toString() !== "ANV1"
  )
    throw new Error("Invalid backup format.");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(key),
    buffer.subarray(4, 16),
  );
  decipher.setAAD(Buffer.from("anvira-backup-v1"));
  decipher.setAuthTag(buffer.subarray(16, 32));
  const snapshot = JSON.parse(
    Buffer.concat([
      decipher.update(buffer.subarray(32)),
      decipher.final(),
    ]).toString(),
  );
  if (
    snapshot.format !== "anvira-snapshot-v1" ||
    snapshot.project !== expectedProject ||
    !Array.isArray(snapshot.records) ||
    snapshot.records.length > 100000
  )
    throw new Error(
      "Backup project or format does not match the restore target.",
    );
  const ids = new Set();
  for (const { kind, value } of snapshot.records) {
    const id = kind + "/" + value?.id;
    if (
      !backupCollections.includes(kind) ||
      typeof value?.id !== "string" ||
      !value.id ||
      value.id.includes("/") ||
      value.id.length > 128 ||
      ids.has(id)
    )
      throw new Error("Invalid or duplicate backup document.");
    ids.add(id);
  }
  return snapshot;
}
export async function restoreSnapshot(store, snapshot) {
  // Explicit CLI approval is required before invoking this function on live data.
  // Restores are additive; existing unrelated documents are not deleted.
  for (let i = 0; i < snapshot.records.length; i += 200)
    await store.transaction(async (tx) => {
      for (const { kind, value } of snapshot.records.slice(i, i + 200))
        tx.put(kind, value);
    });
  return { restored: snapshot.records.length };
}

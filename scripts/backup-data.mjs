import "dotenv/config";
import { readFile, writeFile } from "node:fs/promises";
import { config } from "../server/lib/config.mjs";
import { firebaseServices } from "../server/lib/firebase.mjs";
import { createFirestoreStore } from "../server/lib/store.mjs";
import {
  exportSnapshot,
  encryptSnapshot,
  decryptSnapshot,
  restoreSnapshot,
} from "../server/lib/backup.mjs";
const [command, filename] = process.argv.slice(2),
  cfg = config();
if (
  !cfg.live ||
  !cfg.projectId ||
  !["export", "verify", "restore"].includes(command) ||
  !filename
)
  throw new Error(
    "Usage: node scripts/backup-data.mjs export|verify|restore /absolute/backup.enc (Firebase mode only).",
  );
if (!filename.startsWith("/"))
  throw new Error(
    "Use an absolute private backup path outside the web directory.",
  );
const key = process.env.BACKUP_ENCRYPTION_KEY;
if (command === "verify" || command === "restore") {
  const snapshot = decryptSnapshot(
    await readFile(filename),
    key,
    cfg.projectId,
  );
  console.log(
    JSON.stringify({
      project: snapshot.project,
      documents: snapshot.records.length,
      createdAt: snapshot.at,
      validated: true,
    }),
  );
  if (command === "restore") {
    if (!process.argv.includes("--apply-to=" + cfg.projectId))
      throw new Error(
        "Dry run only: review the snapshot and pass --apply-to=" +
          cfg.projectId +
          " to restore. Stop booking writes first. Restore overwrites matching records in batches and is not atomic.",
      );
    const { db } = await firebaseServices(cfg);
    console.log(await restoreSnapshot(createFirestoreStore(db), snapshot));
  }
} else {
  const { db } = await firebaseServices(cfg),
    snapshot = await exportSnapshot(createFirestoreStore(db), cfg.projectId);
  await writeFile(filename, encryptSnapshot(snapshot, key), {
    mode: 0o600,
    flag: "wx",
  });
  console.log(
    JSON.stringify({
      project: cfg.projectId,
      documents: snapshot.records.length,
      encrypted: true,
    }),
  );
}

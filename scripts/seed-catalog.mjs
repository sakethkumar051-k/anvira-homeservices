import "dotenv/config";
import { firebaseServices } from "../server/lib/firebase.mjs";
import { config } from "../server/lib/config.mjs";
import { sampleServices } from "../server/lib/sample-catalog.mjs";
const cfg = config();
if (!cfg.live)
  throw new Error("This command is for Firebase only. Demo data is automatic.");
if (!process.argv.includes("--confirm-inactive-samples"))
  throw new Error(
    "This seeds sample catalog entries as inactive only. Pass --confirm-inactive-samples after reviewing the code.",
  );
const { db } = await firebaseServices(cfg),
  batch = db.batch();
const existing = new Set(
  (await db.collection("services").get()).docs.map((d) => d.id),
);
let created = 0;
for (const service of sampleServices) {
  if (existing.has(service.id)) continue;
  batch.create(db.collection("services").doc(service.id), {
    ...service,
    active: false,
    sampleReviewed: false,
    createdAt: Date.now(),
    sample: true,
  });
  created++;
}
if (created) await batch.commit();
console.log(
  JSON.stringify({
    project: cfg.projectId,
    created,
    active: false,
    message:
      "Sample drafts added without overwriting existing services. Review scope, prices and policies in Owner services before publishing. No fictional professionals, customers or bookings were added.",
  }),
);

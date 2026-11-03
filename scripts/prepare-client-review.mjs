import { pathToFileURL } from "node:url";
import { sampleServices } from "../server/lib/sample-catalog.mjs";
import { companySchema, serviceSchema } from "../server/lib/schemas.mjs";

const reviewNotice =
  "REVIEW ONLY: fictional INR prices and service scopes for test bookings. No real order, service delivery or settlement is offered.";
export function reviewCatalog() {
  const templates = [...sampleServices];
  if (!templates.some((s) => s.fulfillmentType === "laundry"))
    templates.push({
      id: "laundry",
      name: "Laundry wash & fold",
      category: "Laundry",
      icon: "water",
      price: 299,
      duration: 60,
      fulfillmentType: "laundry",
      headline: "Fictional wash & fold QA template",
      description:
        "A fictional test wash-and-fold scope for one bag up to 3 kg of everyday washable garments. The ₹299 amount exists only to exercise test checkout and laundry progress.",
      includes: [
        "SAMPLE collection",
        "SAMPLE wash and fold",
        "SAMPLE return acknowledgement",
      ],
      excludes: [
        "Real garment collection",
        "Dry cleaning",
        "Real service delivery",
      ],
      addons: [],
    });
  const services = templates.map((s, order) => ({
    ...serviceSchema.parse({
      ...s,
      name: `SAMPLE · ${s.name}`,
      nameTe: s.nameTe ? `SAMPLE · ${s.nameTe}` : "",
      headline: "REVIEW ONLY · fictional price and scope",
      description: `${reviewNotice} ${s.description}`,
      descriptionTe: "",
      warranty:
        "Review only. No real service warranty or remedy is offered by this test template.",
      active: true,
      sampleReviewed: true,
      order,
    }),
    id: `review-${s.id}`,
    sample: true,
    reviewOnly: true,
  }));
  const professionals = ["In-house", "Partner"].map((type, i) => ({
    id: `review-professional-${i + 1}`,
    name: `SAMPLE · Fictional ${type} professional`,
    type,
    reviewOnly: true,
    sample: true,
    approved: true,
    available: true,
    skills: services.map((s) => s.id),
    pins: ["509216"],
    rating: 0,
    jobs: 0,
    documents: [],
    bio: "Fictional profile for client review only. This is not a verified or available real service provider.",
    languages: ["Telugu", "English"],
  }));
  const users = professionals.map((p) => ({
    id: p.id,
    name: p.name,
    role: "professional",
    active: true,
    reviewOnly: true,
    sample: true,
  }));
  return { services, professionals, users };
}
function validateApply(cfg, expectedProject) {
  if (
    !cfg.live ||
    cfg.paymentMode !== "razorpay" ||
    cfg.paymentEnvironment !== "test" ||
    !/^rzp_test_[A-Za-z0-9]+$/.test(cfg.razorpayKeyId || "") ||
    !cfg.razorpayKeySecret
  )
    throw Error(
      "Review preparation requires Firebase and complete Razorpay test credentials.",
    );
  if (!cfg.projectId || cfg.projectId !== expectedProject)
    throw Error(
      "Pass --project=<exact Firebase project ID> to confirm the target.",
    );
  if (cfg.payoutsEnabled)
    throw Error("Disable real payouts before preparing client review.");
  const url = new URL(cfg.publicUrl);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  )
    throw Error(
      "PUBLIC_API_URL must be an HTTPS origin serving the review policy pages.",
    );
}
export async function prepareClientReview({
  cfg,
  db,
  apply = false,
  expectedProject,
}) {
  const catalog = reviewCatalog();
  const summary = {
    applied: false,
    project: cfg.projectId || "unconfigured",
    services: catalog.services.length,
    professionals: catalog.professionals.length,
    userProfiles: catalog.users.length,
    firebaseAuthUsersCreated: 0,
    policyEnvironment: "test",
    sample: true,
    reviewOnly: true,
    coveragePins: ["509216"],
    currency: "INR",
    supportEmail: "anviraservicesllp@gmail.com",
    supportPhone: "+917989365699",
    commissionMode: "tiers",
    commissionTiers: [
      { minAmount: 0, commissionBps: 1000 },
      { minAmount: 1000, commissionBps: 1500 },
      { minAmount: 10000, commissionBps: 2000 },
      { minAmount: 20000, commissionBps: 2500 },
    ],
    notice: reviewNotice,
  };
  // Default dry-run is offline: it neither reads Firebase nor prints credentials.
  if (!apply) return summary;
  validateApply(cfg, expectedProject);
  if (!db) throw Error("Firebase database is required for --apply.");
  const changed = await db.runTransaction(async (tx) => {
    const companyRef = db.collection("settings").doc("company");
    const companyDoc = await tx.get(companyRef);
    const previous = companyDoc.exists ? companyDoc.data() : {};
    if (previous.policyPublished && previous.policyEnvironment !== "test")
      throw Error(
        "Refusing to replace approved production or legacy policies with review policies.",
      );
    const bookings = await tx.get(db.collection("bookings").limit(1001));
    if (
      bookings.docs.length > 1000 ||
      bookings.docs.some((d) => d.data().reviewOnly !== true)
    )
      throw Error(
        "Refusing review preparation where non-review bookings exist or booking history needs manual review.",
      );
    const pending = [];
    for (const [kind, records] of Object.entries(catalog))
      for (const record of records) {
        const reference = db.collection(kind).doc(record.id);
        const existing = await tx.get(reference);
        if (existing.exists && existing.data().reviewOnly !== true)
          throw Error(`Refusing to overwrite a non-review ${kind} record.`);
        // Preserve prior review edits and active review bookings on repeated runs.
        if (!existing.exists)
          pending.push({
            reference,
            record: { ...record, createdAt: Date.now() },
          });
      }
    const policyOrigin = new URL(cfg.webReturn || cfg.publicUrl);
    if (
      policyOrigin.protocol !== "https:" ||
      policyOrigin.username ||
      policyOrigin.password ||
      policyOrigin.search ||
      policyOrigin.hash ||
      policyOrigin.pathname !== "/"
    )
      throw Error(
        "WEB_APP_URL must be an HTTPS origin serving the public review policies.",
      );
    const base = policyOrigin.origin;
    const policy = companySchema.parse({
      name: previous.name || "ANVIRA",
      pins: ["509216"],
      commissionBps: previous.commissionBps ?? 2000,
      commissionMode: "tiers",
      commissionTiers: summary.commissionTiers,
      cancelCutoffHours: previous.cancelCutoffHours ?? 2,
      assignmentDeadlineMinutes: previous.assignmentDeadlineMinutes ?? 30,
      termsVersion: "review-only-v1",
      termsUrl: `${base}/review-terms`,
      privacyUrl: `${base}/review-privacy`,
      supportPhone: "+917989365699",
      policyEnvironment: "test",
      policyPublished: true,
    });
    for (const { reference, record } of pending) tx.set(reference, record);
    tx.set(companyRef, {
      ...previous,
      ...policy,
      id: "company",
      currency: "INR",
      supportEmail: summary.supportEmail,
    });
    return pending.length;
  });
  return { ...summary, applied: true, recordsCreated: changed };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await import("dotenv/config");
  const { config } = await import("../server/lib/config.mjs");
  const cfg = config(),
    apply = process.argv.includes("--apply"),
    expectedProject = process.argv
      .find((x) => x.startsWith("--project="))
      ?.slice(10);
  // Validate before initializing Firebase; dry-run never initializes an SDK.
  if (apply) validateApply(cfg, expectedProject);
  const db = apply
    ? (await (await import("../server/lib/firebase.mjs")).firebaseServices(cfg))
        .db
    : undefined;
  console.log(
    JSON.stringify(
      await prepareClientReview({ cfg, db, apply, expectedProject }),
      null,
      2,
    ),
  );
}

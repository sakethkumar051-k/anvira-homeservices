import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { sampleServices } from "../server/lib/sample-catalog.mjs";
import { serviceSchema } from "../server/lib/schemas.mjs";

const definitions = [
  {
    id: "review-cleaning",
    template: "cleaning",
    name: "Home cleaning",
    category: "Home cleaning",
    description:
      "Choose whole-home, kitchen, bathroom or sofa cleaning. Tell us the rooms, surfaces and cleaning needs. The office confirms the included work, preparation, duration and price in a tailored quote before payment.",
  },
  {
    id: "review-car-cleaning",
    template: "car-cleaning",
    name: "Car cleaning",
    category: "Car cleaning",
    description:
      "Choose exterior washing, interior care or vehicle detailing. Tell us the vehicle size, parking location and water access. The office confirms a suitable cleaning method, included work and a tailored quote before payment.",
  },
  {
    id: "review-plumbing",
    template: "plumbing",
    name: "Plumbing",
    category: "Plumbing",
    description:
      "Describe the visible leak, slow drain or fitting that needs attention. The office confirms the diagnosis, approved repair scope, parts and labour in a tailored quote before payment. Concealed plumbing and major civil work need separate assessment.",
  },
  {
    id: "review-electrical",
    template: "electrical",
    name: "Electrician",
    category: "Electrician",
    description:
      "Tell us about the household light, switch, fan or electrical fault. The office confirms safe access, diagnosis, approved work and any replacement materials in a tailored quote before payment. Keep clear of smoke or fire and contact emergency services for an emergency.",
  },
];
const extras = new Set([
  "review-appliance",
  "review-bathroom",
  "review-handyman",
  "review-laundry",
  "review-painting",
  "review-sofa",
]);
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
const cleanName = (value) => value.replace(/^SAMPLE\s*[·:–-]?\s*/i, "");

// A reversible artifact only. This module has no Firebase SDK import, credential
// initialization or database write path. Applying a reviewed draft is separate.
export function buildFocusedCatalogDraft(services) {
  const source = new Map(services.map((s) => [s.id, s]));
  const ac = source.get("review-ac");
  if (
    !ac ||
    ac.sample !== false ||
    ac.sampleReviewed !== true ||
    ac.price !== 599
  )
    throw Error(
      "The reviewed AC record differs from the inspected ₹599 record; review it manually.",
    );
  const operations = [];
  const after = new Map(services.map((s) => [s.id, s]));
  const put = (id, value, action, reason) => {
    serviceSchema.parse(value);
    const before = source.get(id) || null;
    operations.push({
      id,
      action,
      reason,
      beforeHash: before ? hash(before) : null,
      before,
      after: value,
    });
    after.set(id, value);
  };
  for (const item of definitions) {
    const original = source.get(item.id);
    if (!original || original.sample !== true || original.reviewOnly !== true)
      throw Error(
        "A focus record is missing or is no longer an unreviewed template; review the custom record manually.",
      );
    const template = sampleServices.find((s) => s.id === item.template);
    const packages = [...(original.packages || [])];
    if (item.template === "cleaning")
      for (const [id, packageId] of [
        ["review-bathroom", "bathroom-care"],
        ["review-sofa", "sofa-care"],
      ]) {
        const detail = source.get(id);
        if (
          detail?.sample === true &&
          !packages.some((p) => p.id === packageId)
        )
          packages.push({
            id: packageId,
            name: cleanName(detail.name),
            description:
              "Confirm the surfaces, included work, preparation and price with the office in your tailored quote.",
            price: detail.price,
            duration: detail.duration,
            includes: detail.includes,
            excludes: detail.excludes || [],
          });
      }
    put(
      item.id,
      {
        ...original,
        name: item.name,
        nameTe: cleanName(original.nameTe || template.nameTe || ""),
        category: item.category,
        headline: template.headline,
        description: item.description,
        descriptionTe: "",
        bookingMode: "quote",
        packageRequired: false,
        priceUnit: "Quote confirmed before payment",
        sample: false,
        packages,
        warranty:
          "The written quote confirms any applicable workmanship coverage, follow-up process and exclusions before payment.",
        faqs: [
          {
            question: "How is the price confirmed?",
            answer:
              "Describe your requirement and review the office's written scope and quote. Additional work and materials require your approval before proceeding.",
          },
          {
            question: "Can I pay a standard package price now?",
            answer:
              "This service uses a tailored quote. The office confirms the included work, materials, duration and price before payment.",
          },
        ],
      },
      "update",
      "Retain the service ID and internal configuration; replace sample-price booking with a tailored quote.",
    );
  }
  if (source.has("review-ro"))
    throw Error(
      "An RO record already exists; compare it before drafting a replacement.",
    );
  const ro = sampleServices.find((s) => s.id === "ro");
  put(
    "review-ro",
    {
      ...ro,
      id: "review-ro",
      name: "RO filter service",
      bookingMode: "quote",
      packageRequired: false,
      price: 1,
      priceUnit: "Quote confirmed before payment",
      packages: [],
      addons: [],
      optionGroups: [],
      description:
        "Choose purifier maintenance, compatible filter replacement labour or installation. Share the brand, model and concern. The office confirms the included work, compatible filters or membrane and any spare parts in a written quote before payment. Routine maintenance does not replace suitable laboratory water testing.",
      sample: false,
      sampleReviewed: false,
      reviewOnly: true,
      warranty:
        "The written quote confirms any applicable workmanship coverage, follow-up process and exclusions before payment.",
      order: 3,
    },
    "create",
    "Add RO as quote-only; the numeric schema placeholder is never an offered or payable catalog price.",
  );
  const focusIds = new Set([
    ...definitions.map((s) => s.id),
    "review-ac",
    "review-ro",
  ]);
  for (const original of services) {
    if (focusIds.has(original.id)) continue;
    if (
      !extras.has(original.id) ||
      original.reviewOnly !== true ||
      (original.sample !== true && original.id !== "review-painting")
    )
      throw Error(
        "A non-review or custom category would be archived; review it manually.",
      );
    put(
      original.id,
      { ...original, active: false },
      "archive",
      original.id === "review-painting"
        ? "Preserve the reviewed Painting record, its scope and price; remove it from the six active categories."
        : "Keep the full original record inactive outside the six focus categories.",
    );
  }
  return {
    format: "anvira-focused-catalog-draft-v1",
    project: "anvira-services",
    draftOnly: true,
    preserved: [
      {
        id: ac.id,
        hash: hash(ac),
        reason:
          "Reviewed AC stays unchanged, including its ₹599 base price, booking mode and complete scope.",
      },
    ],
    operations,
    after: [...after.values()],
    notes: [
      "No database write path exists in this script.",
      "Four existing sample-derived services become quote-only. Existing internal numeric configuration is retained for reversibility and is not advertised or payable through standard checkout.",
      "RO uses the required internal ₹1 schema placeholder, quote-only booking and no priced packages or add-ons.",
      "Six extra records are archived, never deleted. Reviewed Painting changes only active to false.",
      "Use original before objects and beforeHash guards for any later approved application or rollback.",
    ],
  };
}

async function main(args) {
  if (args.includes("--apply"))
    throw Error(
      "This is a draft-only tool. Catalog application is not implemented.",
    );
  const option = (name) =>
    args.find((arg) => arg.startsWith(name + "="))?.slice(name.length + 1);
  const snapshotPath = option("--snapshot"),
    output = option("--output");
  if (
    !snapshotPath ||
    !output ||
    !path.isAbsolute(snapshotPath) ||
    !path.isAbsolute(output)
  )
    throw Error(
      "Pass absolute --snapshot=/private/archive.enc and --output=/private/draft.json paths.",
    );
  await import("dotenv/config");
  const { decryptSnapshot } = await import("../server/lib/backup.mjs");
  const snapshot = decryptSnapshot(
    await readFile(snapshotPath),
    process.env.BACKUP_ENCRYPTION_KEY,
    "anvira-services",
  );
  const draft = buildFocusedCatalogDraft(
    snapshot.records.filter((r) => r.kind === "services").map((r) => r.value),
  );
  await writeFile(output, JSON.stringify(draft, null, 2) + "\n", {
    mode: 0o600,
    flag: "wx",
  });
  console.log(
    JSON.stringify(
      {
        draftOnly: true,
        output,
        operations: draft.operations.map((o) => ({
          id: o.id,
          action: o.action,
          category: o.after.category,
          active: o.after.active,
          bookingMode: o.after.bookingMode,
          storedBase: o.after.price,
        })),
        preserved: draft.preserved.map(({ id, reason }) => ({ id, reason })),
        activeServices: draft.after.filter((s) => s.active).map((s) => s.id),
      },
      null,
      2,
    ),
  );
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
)
  main(process.argv.slice(2)).catch((error) => {
    console.error("Catalog draft stopped:", error.message);
    process.exitCode = 1;
  });

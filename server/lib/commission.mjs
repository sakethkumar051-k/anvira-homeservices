import { z } from "zod";

export const commissionTiersSchema = z
  .array(
    z
      .object({
        minAmount: z.number().int().min(0).max(100000),
        commissionBps: z.number().int().min(0).max(5000),
      })
      .strict(),
  )
  .min(1)
  .max(10)
  .superRefine((tiers, ctx) => {
    if (tiers[0]?.minAmount !== 0)
      ctx.addIssue({
        code: "custom",
        path: [0, "minAmount"],
        message: "The first slab must start at ₹0.",
      });
    tiers.forEach((tier, i) => {
      if (i && tier.minAmount <= tiers[i - 1].minAmount)
        ctx.addIssue({
          code: "custom",
          path: [i, "minAmount"],
          message: "Slab starts must be strictly increasing.",
        });
    });
  });

// Copy only the policy, so later company edits cannot change an existing booking.
export function commissionPolicy(company) {
  return company.commissionMode === "tiers"
    ? {
        mode: "tiers",
        tiers: commissionTiersSchema.parse(company.commissionTiers),
      }
    : { mode: "flat", commissionBps: company.commissionBps };
}

export function bookingCommissionBps(booking, professionalType, legacyFlatBps) {
  if (professionalType === "In-house") return 0;
  const policy = booking.commissionPolicy;
  // Old bookings carry a flat assignment rate; never migrate them to slabs.
  if (!policy) return booking.commissionBps ?? legacyFlatBps;
  if (policy.mode === "flat") return policy.commissionBps;
  // Inclusive lower bounds; one rate applies to the entire discounted total.
  return policy.tiers.findLast((tier) => booking.total >= tier.minAmount)
    .commissionBps;
}

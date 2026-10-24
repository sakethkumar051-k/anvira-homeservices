import { z } from "zod";
import { commissionTiersSchema } from "./commission.mjs";
export const serviceSchema = z.object({
  fulfillmentType: z.enum(["visit", "laundry"]).default("visit"),
  name: z.string().trim().min(3).max(100),
  nameTe: z.string().trim().max(160).default(""),
  category: z.string().trim().min(2).max(40),
  icon: z.enum(["spark", "air", "water", "bolt", "roller", "tool", "grid"]),
  price: z.number().int().min(1).max(100000),
  duration: z
    .number()
    .int()
    .min(30)
    .max(240)
    .refine((n) => n % 30 === 0),
  headline: z.string().max(160),
  description: z.string().min(10).max(1000),
  descriptionTe: z.string().max(1500).default(""),
  includes: z.array(z.string().min(1).max(200)).min(1).max(10),
  excludes: z.array(z.string().max(200)).max(10).default([]),
  addons: z
    .array(
      z.object({
        id: z
          .string()
          .regex(/^[a-zA-Z0-9_-]+$/)
          .max(40),
        name: z.string().min(2).max(100),
        price: z.number().int().min(1).max(100000),
      }),
    )
    .max(10)
    .refine(
      (items) => new Set(items.map((a) => a.id)).size === items.length,
      "Add-on identifiers must be unique.",
    ),
  packages: z
    .array(
      z.object({
        id: z
          .string()
          .regex(/^[a-zA-Z0-9_-]+$/)
          .max(40),
        name: z.string().trim().min(2).max(80),
        description: z.string().trim().max(500).default(""),
        price: z.number().int().min(1).max(100000),
        duration: z
          .number()
          .int()
          .min(30)
          .max(240)
          .refine((n) => n % 30 === 0),
        includes: z
          .array(z.string().trim().min(1).max(200))
          .max(10)
          .default([]),
      }),
    )
    .max(6)
    .refine(
      (a) => new Set(a.map((x) => x.id)).size === a.length,
      "Package IDs must be unique.",
    )
    .default([]),
  optionGroups: z
    .array(
      z.object({
        id: z
          .string()
          .regex(/^[a-zA-Z0-9_-]+$/)
          .max(40),
        name: z.string().trim().min(2).max(80),
        required: z.boolean(),
        options: z
          .array(
            z.object({
              id: z
                .string()
                .regex(/^[a-zA-Z0-9_-]+$/)
                .max(40),
              name: z.string().trim().min(2).max(80),
              price: z.number().int().min(0).max(100000),
              duration: z
                .number()
                .int()
                .min(0)
                .max(120)
                .refine((n) => n % 30 === 0),
            }),
          )
          .min(1)
          .max(8)
          .refine(
            (a) => new Set(a.map((x) => x.id)).size === a.length,
            "Option IDs must be unique.",
          ),
      }),
    )
    .max(6)
    .refine(
      (a) => new Set(a.map((x) => x.id)).size === a.length,
      "Option group IDs must be unique.",
    )
    .default([]),
  bookingFields: z
    .array(
      z.object({
        id: z
          .string()
          .regex(/^[a-zA-Z0-9_-]+$/)
          .max(40),
        label: z.string().trim().min(2).max(100),
        placeholder: z.string().trim().max(160).default(""),
        help: z.string().trim().max(300).default(""),
        required: z.boolean(),
      }),
    )
    .max(8)
    .refine(
      (a) => new Set(a.map((x) => x.id)).size === a.length,
      "Customer field IDs must be unique.",
    )
    .default([]),
  faqs: z
    .array(
      z.object({
        question: z.string().trim().min(3).max(160),
        answer: z.string().trim().min(3).max(600),
      }),
    )
    .max(10)
    .default([]),
  preparation: z.array(z.string().trim().min(1).max(200)).max(10).default([]),
  warranty: z.string().trim().max(600).default(""),
  checklist: z.array(z.string().trim().min(2).max(200)).max(10).default([]),
  sampleReviewed: z.boolean().default(false),
  active: z.boolean(),
  order: z.number().int().min(0).max(100).default(0),
});
export const companySchema = z
  .object({
    name: z.string().min(2).max(100),
    pins: z
      .array(z.string().regex(/^\d{6}$/))
      .min(1)
      .max(50),
    commissionBps: z.number().int().min(0).max(5000),
    commissionMode: z.enum(["flat", "tiers"]).optional(),
    commissionTiers: commissionTiersSchema.optional(),
    cancelCutoffHours: z.number().int().min(0).max(48),
    assignmentDeadlineMinutes: z.number().int().min(5).max(120),
    termsVersion: z.string().min(1).max(40),
    termsUrl: z.string().url().startsWith("https://"),
    privacyUrl: z.string().url().startsWith("https://"),
    supportPhone: z
      .string()
      .refine((value) => value === "" || /^\+91[6-9]\d{9}$/.test(value)),
    policyEnvironment: z.enum(["test", "production"]).optional(),
    policyPublished: z.boolean(),
  })
  .superRefine((company, ctx) => {
    if (!company.supportPhone && company.policyEnvironment !== "test")
      ctx.addIssue({
        code: "custom",
        path: ["supportPhone"],
        message: "Production policies require a valid support phone.",
      });
    if (company.commissionMode === "tiers" && !company.commissionTiers)
      ctx.addIssue({
        code: "custom",
        path: ["commissionTiers"],
        message: "Configure at least one commission slab.",
      });
  });
export const profileSchema = z.object({
  name: z.string().trim().min(2).max(100),
  skills: z
    .array(z.string().regex(/^[a-zA-Z0-9_-]+$/))
    .min(1)
    .max(20),
  pins: z
    .array(z.string().regex(/^\d{6}$/))
    .min(1)
    .max(10),
  experienceYears: z.number().int().min(0).max(50),
  bio: z.string().trim().max(500),
  termsAccepted: z.literal(true),
});
export const scheduleSchema = z.object({
  days: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  hours: z
    .array(
      z
        .number()
        .int()
        .refine((n) => [9, 12, 15, 18].includes(n)),
    )
    .min(1)
    .max(4),
  blockedDates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).max(60),
});
export const bankSchema = z.object({
  name: z.string().trim().min(2).max(100),
  accountNumber: z.string().regex(/^\d{9,18}$/),
  ifsc: z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/),
  email: z.string().email().optional(),
});
export const promotionSchema = z.object({
  id: z
    .string()
    .trim()
    .regex(/^[A-Z0-9]{3,20}$/),
  discountAmount: z.number().int().min(1).max(10000),
  minAmount: z.number().int().min(1).max(100000),
  maxUses: z.number().int().min(1).max(100000),
  expiresAt: z
    .number()
    .int()
    .refine((n) => n > Date.now(), "Offer expiry must be in the future."),
  active: z.boolean(),
});

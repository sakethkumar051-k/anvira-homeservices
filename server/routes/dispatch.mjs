import { randomUUID } from "node:crypto";
import { z } from "zod";
import { assertRole, fail } from "../lib/errors.mjs";
import { scheduleSchema } from "../lib/schemas.mjs";
const workerSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    phone: z
      .string()
      .trim()
      .max(30)
      .refine(
        (s) => !s || /^\+?[0-9 ()-]{7,30}$/.test(s),
        "Enter a valid contact phone.",
      )
      .default(""),
    skills: z
      .array(
        z
          .string()
          .regex(/^[a-zA-Z0-9_-]+$/)
          .max(100),
      )
      .min(1)
      .max(20),
    pins: z
      .array(z.string().regex(/^\d{6}$/))
      .min(1)
      .max(10),
    schedule: scheduleSchema.optional(),
    active: z.boolean().default(true),
    available: z.boolean().default(true),
  })
  .strict();
export function registerDispatchRoutes(
  app,
  { store, business, drainPush = () => {} },
) {
  async function validateSkills(tx, worker) {
    for (const id of worker.skills)
      if (!(await tx.get("services", id)))
        fail(400, "Choose existing service skills.", "INVALID_SKILLS");
  }
  app.post("/api/inhouse-workers", async (req, res) => {
    assertRole(req.user, "owner");
    const value = workerSchema.parse(req.body);
    const worker = await store.transaction(async (tx) => {
      await validateSkills(tx, value);
      const p = {
        ...value,
        id: "inhouse_" + randomUUID(),
        type: "In-house",
        accountless: true,
        approved: true,
        rating: 0,
        jobs: 0,
        documents: [],
        status: "approved",
        createdAt: Date.now(),
        createdBy: req.user.id,
      };
      tx.put("professionals", p);
      business.audit(tx, req.user, "inhouse_worker_created", p.id);
      return p;
    });
    res.status(201).json(worker);
  });
  app.patch("/api/inhouse-workers/:id", async (req, res) => {
    assertRole(req.user, "owner");
    const value = workerSchema.partial().parse(req.body);
    const worker = await store.transaction(async (tx) => {
      const p = await tx.get("professionals", req.params.id);
      if (!p?.accountless || p.type !== "In-house")
        fail(404, "Internal worker not found.");
      const next = { ...p, ...value, updatedAt: Date.now() };
      await validateSkills(tx, next);
      tx.put("professionals", next);
      business.audit(tx, req.user, "inhouse_worker_updated", p.id);
      return next;
    });
    res.json(worker);
  });
  app.patch("/api/inhouse-workers/:id/availability", async (req, res) => {
    assertRole(req.user, "owner", "care");
    const value = z.object({ available: z.boolean() }).strict().parse(req.body);
    const worker = await store.transaction(async (tx) => {
      const p = await tx.get("professionals", req.params.id);
      if (!p?.accountless || p.type !== "In-house")
        fail(404, "Internal worker not found.");
      const next = { ...p, ...value, updatedAt: Date.now() };
      tx.put("professionals", next);
      business.audit(tx, req.user, "inhouse_worker_availability", p.id);
      return next;
    });
    res.json(worker);
  });
  app.get("/api/partner-offers", async (req, res) =>
    res
      .set("Cache-Control", "no-store")
      .json(await business.partnerOffers(req.user)),
  );
  app.post("/api/partner-offers/:id/accept", async (req, res) => {
    const b = await business.acceptPartnerOffer(req.user, req.params.id);
    drainPush();
    res.set("Cache-Control", "no-store").json(b);
  });
  app.post("/api/partner-offers/:id/decline", async (req, res) =>
    res.json(await business.declinePartnerOffer(req.user, req.params.id)),
  );
}

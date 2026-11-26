import { randomUUID } from "node:crypto";
import { z } from "zod";
import { assertRole, fail } from "../lib/errors.mjs";
import { simulateDispatch } from "../lib/dispatch-simulator.mjs";
import { companySchema, scheduleSchema } from "../lib/schemas.mjs";
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
  const policySchema = z
    .object(
      Object.fromEntries(
        [
          "dispatchMode",
          "internalAssignmentMode",
          "internalCoveragePauses",
          "externalPartnersEnabled",
          "partnerOfferSeconds",
        ].map((key) => [key, companySchema.shape[key]]),
      ),
    )
    .partial()
    .strict();
  app.patch("/api/dispatch/policy", async (req, res) => {
    assertRole(req.user, "owner");
    const changes = policySchema.parse(req.body);
    await store.transaction(async (tx) => {
      const current = await business.settings(tx);
      if (changes.internalCoveragePauses) {
        // Pauses saved earlier for a PIN or service that has since been
        // removed are dropped, so they cannot block every later save.
        const saved = new Set(
          (current.internalCoveragePauses || []).map(
            (p) => p.serviceId + ":" + p.pin,
          ),
        );
        const kept = [];
        for (const pause of changes.internalCoveragePauses) {
          const valid =
            current.pins.includes(pause.pin) &&
            !!(await tx.get("services", pause.serviceId));
          if (valid) kept.push(pause);
          else if (!saved.has(pause.serviceId + ":" + pause.pin))
            fail(
              400,
              "Choose an existing service and covered PIN code.",
              "INVALID_DISPATCH_COVERAGE",
            );
        }
        changes.internalCoveragePauses = kept;
      }
      for (const pause of changes.internalCoveragePauses || []) {
        if (
          !current.pins.includes(pause.pin) ||
          !(await tx.get("services", pause.serviceId))
        )
          fail(
            400,
            "Choose an existing service and covered PIN code.",
            "INVALID_DISPATCH_COVERAGE",
          );
      }
      tx.put("settings", {
        ...current,
        ...changes,
        id: "company",
        partnerDispatchRevision:
          (current.partnerDispatchRevision || 0) +
          ((changes.externalPartnersEnabled !== undefined &&
            changes.externalPartnersEnabled !==
              current.externalPartnersEnabled) ||
          (changes.dispatchMode !== undefined &&
            changes.dispatchMode !== current.dispatchMode)
            ? 1
            : 0),
        updatedAt: Date.now(),
      });
      business.audit(tx, req.user, "dispatch_policy_updated", "company");
    });
    res.json({ ok: true });
  });
  app.get("/api/bookings/:id/dispatch", async (req, res) => {
    assertRole(req.user, "owner", "care");
    const b = await business.booking(store, req.params.id, req.user);
    const company = await business.settings(store);
    const profiles = await store.list("professionals", [], 200);
    const service = await store.get("services", b.serviceId);
    const candidates = [];
    for (const p of profiles) {
      let reason = "ELIGIBLE";
      if (p.active === false || !p.approved)
        reason = "NOT_APPROVED_OR_INACTIVE";
      else if (!p.skills.includes(b.serviceId)) reason = "WRONG_SERVICE";
      else if (!p.pins?.includes(b.address.pin)) reason = "OUTSIDE_AREA";
      else if (
        p.type === "In-house" &&
        (company.internalCoveragePauses || []).some(
          (x) => x.serviceId === b.serviceId && x.pin === b.address.pin,
        )
      )
        reason = "INTERNAL_PAUSED";
      else if (p.available === false) reason = "UNAVAILABLE";
      else if (
        p.type === "Partner" &&
        (!company.externalPartnersEnabled ||
          service?.partnerFulfillmentAllowed === false)
      )
        reason = "PARTNER_FALLBACK_DISABLED";
      else if (
        p.type === "Partner" &&
        (await store.get("users", p.id))?.role !== "professional"
      )
        reason = "NO_ACTIVE_PROFESSIONAL_ACCOUNT";
      else if (!(await business.eligible(store, p, b)))
        reason = "SCHEDULE_OR_TIME_CONFLICT";
      candidates.push({ id: p.id, name: p.name, type: p.type, reason });
    }
    const offers = await store.list(
      "dispatchOffers",
      [["bookingId", "==", b.id]],
      100,
    );
    const alerts = await store.list("outbox", [["bookingId", "==", b.id]], 100);
    res.set("Cache-Control", "no-store").json({
      progress: b.dispatchProgress || null,
      candidates,
      limited: profiles.length === 200,
      offers: offers.map((o) => ({
        id: o.id,
        name:
          profiles.find((p) => p.id === o.professionalId)?.name ||
          "Outside professional",
        pushStatus:
          alerts.find((a) => a.offerId === o.id)?.status || "in_app_only",
        status:
          o.status === "pending" && b.dispatch?.state !== "offering"
            ? "closed"
            : o.status === "pending" &&
                (o.roundId !== b.dispatch?.roundId || o.expiresAt <= Date.now())
              ? "expired"
              : o.status,
        expiresAt: o.expiresAt,
        createdAt: o.createdAt,
      })),
    });
  });
  app.post("/api/dispatch/simulate", async (req, res) => {
    assertRole(req.user, "owner");
    const input = z
      .object({
        scenario: z.enum([
          "internal",
          "external",
          "busy",
          "race",
          "timeout",
          "notification_failure",
        ]),
        serviceId: z.string().min(1).max(100).optional(),
      })
      .strict()
      .parse(req.body);
    const service = input.serviceId
      ? await store.get("services", input.serviceId)
      : null;
    res
      .set("Cache-Control", "no-store")
      .json(await simulateDispatch({ scenario: input.scenario, service }));
  });
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
      if (value.active === false && p.active !== false) {
        // Deactivating a worker must not strand visits already assigned.
        const upcoming = (
          await tx.list("bookings", [["professionalId", "==", p.id]], 200)
        ).filter(
          (b) =>
            ["assigned", "confirmed", "in_progress"].includes(b.status) &&
            b.slot > Date.now() - 6 * 3600000,
        );
        if (upcoming.length)
          fail(
            409,
            `Reassign this worker's ${upcoming.length} upcoming visit${upcoming.length === 1 ? "" : "s"} in Orders & dispatch before deactivating them.`,
            "WORKER_HAS_VISITS",
          );
      }
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

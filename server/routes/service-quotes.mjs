import { serviceSchema } from "../lib/schemas.mjs";
import { serviceOffering } from "../lib/service-offering.mjs";
import { createHash } from "node:crypto";
import { z } from "zod";
import { fail, assertRole } from "../lib/errors.mjs";
import {
  quoteAccess,
  quoteAddress,
  proposalSchema,
} from "../lib/service-quotes.mjs";
import { pageCursor, pageResponse, recentOrder } from "../lib/reporting.mjs";
import {
  detailsSchema,
  serviceCoverage,
  serviceDetails,
} from "../lib/service-selection.mjs";
export function registerServiceQuoteRoutes(
  app,
  { store, business, cfg, drainPush },
) {
  app.get("/api/service-quotes", async (req, res) => {
    assertRole(req.user, "customer", "owner", "care");
    res.json(
      pageResponse(
        await store.list(
          "serviceQuotes",
          req.user.role === "customer"
            ? [["customerId", "==", req.user.id]]
            : [],
          101,
          { order: recentOrder, cursor: pageCursor(req.query.cursor) },
        ),
      ),
    );
  });
  app.get("/api/service-quotes/:id", async (req, res) =>
    res.json(
      quoteAccess(req.user, await store.get("serviceQuotes", req.params.id)),
    ),
  );
  app.post("/api/service-quotes", async (req, res) => {
    assertRole(req.user, "customer");
    const v = z
      .object({
        idempotencyKey: z.string().min(8).max(100),
        serviceId: z.string().min(1).max(100),
        description: z.string().trim().min(15).max(2000),
        address: quoteAddress,
        details: detailsSchema,
      })
      .parse(req.body);
    const digest = createHash("sha256")
      .update(req.user.id + ":" + v.idempotencyKey)
      .digest("hex");
    const id = `${digest.slice(0, 8)}-${digest.slice(8, 12)}-5${digest.slice(13, 16)}-a${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
    // Empty answers preserve hashes made before quote questions were supported.
    const { details, ...request } = v;
    const requestHash = createHash("sha256")
      .update(JSON.stringify(Object.keys(details).length ? v : request))
      .digest("hex");
    const q = await store.transaction(async (tx) => {
      const previous = await tx.get("serviceQuotes", id);
      if (previous) {
        if (previous.requestHash !== requestHash)
          fail(
            409,
            "This quote request changed. Refresh before sending another request.",
          );
        return previous;
      }
      const service = serviceOffering(await tx.get("services", v.serviceId)),
        company = await business.settings(tx);
      if (
        !service?.active ||
        (cfg.live && service.sample && !service.sampleReviewed)
      )
        fail(400, "Choose an available published service.");
      if (!serviceCoverage(company, service).includes(v.address.pin))
        fail(400, "This address is outside our current service area.");
      const answers = serviceDetails(service, v.details);
      const recent = await tx.list(
        "serviceQuotes",
        [["customerId", "==", req.user.id]],
        201,
      );
      if (
        recent.filter(
          (x) =>
            ["requested", "proposed", "accepted"].includes(x.status) &&
            !x.bookingId,
        ).length >= 20 ||
        recent.length >= 200
      )
        fail(409, "Contact support before creating more quote requests.");
      const q = {
        id,
        requestHash,
        customerId: req.user.id,
        customerName: req.user.name,
        ...v,
        serviceName: service.name,
        billingPeriod: service.billingPeriod || "one_time",
        serviceDetails: answers,
        status: "requested",
        revision: 0,
        createdAt: Date.now(),
      };
      tx.put("serviceQuotes", q);
      business.audit(tx, req.user, "quote_requested", q.id);
      await business.notifyOffice(
        tx,
        "New quote request",
        "Open the request to review the work and prepare a proposal.",
        undefined,
        { kind: "quote", quoteId: q.id },
      );
      return q;
    });
    drainPush();
    res.status(201).json(q);
  });
  app.post("/api/service-quotes/:id/propose", async (req, res) => {
    assertRole(req.user, "owner");
    const { duration, ...v } = proposalSchema.parse(req.body);
    if (
      v.expiresAt <= Date.now() + 3600000 ||
      v.expiresAt > Date.now() + 30 * 86400000
    )
      fail(400, "Quote validity must be between one hour and thirty days.");
    const total = v.items.reduce((sum, x) => sum + x.quantity * x.unitPrice, 0);
    if (total > 100000) fail(400, "The quote total cannot exceed ₹100,000.");
    res.json(
      await store.transaction(async (tx) => {
        const q = quoteAccess(
          req.user,
          await tx.get("serviceQuotes", req.params.id),
        );
        if (
          !["requested", "proposed"].includes(q.status) ||
          q.revision !== v.revision
        )
          fail(409, "The quote changed. Refresh before pricing it.");
        const service = serviceOffering(await tx.get("services", q.serviceId));
        if (
          q.billingPeriod !== "monthly" &&
          service?.billingPeriod === "monthly"
        )
          fail(
            409,
            "Ask the customer to submit a new monthly plan request.",
            "MONTHLY_PLAN",
          );
        if (q.billingPeriod !== "monthly" && duration === undefined)
          fail(400, "Enter the visit duration before sending the proposal.");
        Object.assign(q, v, {
          ...(q.billingPeriod === "monthly" ? {} : { duration }),
          total,
          revision: q.revision + 1,
          status: "proposed",
          updatedAt: Date.now(),
        });
        tx.put("serviceQuotes", q);
        business.audit(tx, req.user, "quote_proposed", q.id);
        business.notify(
          tx,
          q.customerId,
          q.billingPeriod === "monthly"
            ? "Your monthly proposal is ready"
            : "Your quote is ready",
          "Open My quotes to review the scope and price.",
          undefined,
          { kind: "quote", quoteId: q.id },
        );
        return q;
      }),
    );
    drainPush();
  });
  for (const action of ["accept", "decline", "withdraw"])
    app.post("/api/service-quotes/:id/" + action, async (req, res) => {
      assertRole(
        req.user,
        ...(action === "withdraw" ? ["owner"] : ["customer"]),
      );
      const { revision } = z
        .object({ revision: z.number().int().nonnegative() })
        .parse(req.body);
      res.json(
        await store.transaction(async (tx) => {
          const q = quoteAccess(
            req.user,
            await tx.get("serviceQuotes", req.params.id),
          );
          if (
            q.revision !== revision ||
            q.bookingId ||
            !["requested", "proposed", "accepted"].includes(q.status)
          )
            fail(409, "The quote changed. Refresh before continuing.");
          if (
            action === "accept" &&
            (q.status !== "proposed" || q.expiresAt <= Date.now())
          )
            fail(409, "This proposal has expired or is unavailable.");
          if (action === "accept") {
            const service = serviceOffering(
              await tx.get("services", q.serviceId),
            );
            if (q.billingPeriod === "monthly") {
              if (
                !service?.active ||
                service.billingPeriod !== "monthly" ||
                (cfg.live && service.sample && !service.sampleReviewed) ||
                !serviceSchema.safeParse(service).success
              )
                fail(
                  409,
                  "Choose an available published service.",
                  "SERVICE_UNAVAILABLE",
                );
              const company = await business.settings(tx);
              if (!serviceCoverage(company, service).includes(q.address.pin))
                fail(
                  409,
                  "This address is outside our current service area.",
                  "OUTSIDE_COVERAGE",
                );
            } else if (service?.billingPeriod === "monthly")
              fail(
                409,
                "Request a monthly plan through the team.",
                "MONTHLY_PLAN",
              );
          }
          q.status =
            action === "accept"
              ? "accepted"
              : action === "decline"
                ? "declined"
                : "withdrawn";
          q.updatedAt = Date.now();
          q.revision++;
          tx.put("serviceQuotes", q);
          business.audit(tx, req.user, "quote_" + action, q.id);
          if (action === "accept")
            await business.notifyOffice(
              tx,
              "Customer accepted a proposal",
              q.billingPeriod === "monthly"
                ? "Contact the customer to arrange the monthly plan."
                : "Open the accepted quote to review the agreed work.",
              undefined,
              { kind: "quote", quoteId: q.id },
            );
          return q;
        }),
      );
      if (action === "accept") drainPush();
    });
}

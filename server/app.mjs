import { validProfilePhoto } from "./lib/profile-photo.mjs";
import { serviceSelection } from "./lib/service-selection.mjs";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { rateLimit } from "express-rate-limit";
import multer from "multer";
import { z, ZodError } from "zod";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./lib/config.mjs";
import { createSQLiteStore, createFirestoreStore } from "./lib/store.mjs";
import { firebaseServices } from "./lib/firebase.mjs";
import { seedDemo } from "./lib/seed.mjs";
import { authentication } from "./lib/auth.mjs";
import { domain, addressSchema } from "./lib/domain.mjs";
import { createGateway, validSignature } from "./lib/gateway.mjs";
import { paymentPage } from "./lib/payment-page.mjs";
import { workers } from "./lib/workers.mjs";
import {
  payoutOperations,
  payoutScheduleSchema,
  payoutWindow,
  queuePayout,
} from "./lib/payouts.mjs";
import { fail, assertRole } from "./lib/errors.mjs";
import {
  pageCursor,
  pageResponse,
  recentOrder,
  reportRange,
  reportSummary,
} from "./lib/reporting.mjs";
import {
  serviceSchema,
  companySchema,
  profileSchema,
  scheduleSchema,
  bankSchema,
  promotionSchema,
} from "./lib/schemas.mjs";
const baseDir = path.dirname(fileURLToPath(import.meta.url));
const safeJSON = (v) => JSON.stringify(v).replaceAll("<", "\\u003c");
const omit = (obj, keys) =>
  Object.fromEntries(Object.entries(obj).filter(([k]) => !keys.includes(k)));
const privateBankFields = [
  "bankHolderName",
  "bankIfsc",
  "bankVerification",
  "bankRegisteredName",
  "bankVerificationId",
  "bankUpdateLease",
  "bankChangedAt",
  "bankEligibleAt",
  "bankVerifiedAt",
];
function parseSelection(value) {
  try {
    return JSON.parse(z.string().max(3000).parse(value));
  } catch {
    fail(400, "Choose valid service options.", "INVALID_OPTIONS");
  }
}
export async function createApplication(options = {}) {
  const cfg = options.config || config();
  const firebase =
    options.firebase || (cfg.live ? await firebaseServices(cfg) : {});
  const store =
    options.store ||
    (cfg.live
      ? createFirestoreStore(firebase.db)
      : await createSQLiteStore(
          process.env.DB_PATH || path.join(baseDir, "anvira.sqlite"),
        ));
  if (!cfg.live) await seedDemo(store);
  const business = domain(store, cfg),
    gateway = options.gateway || createGateway(cfg),
    finance = payoutOperations(store, business, gateway, cfg),
    jobs = workers(store, business, gateway, cfg, firebase, finance),
    auth = authentication(cfg, store, firebase.auth),
    app = express();
  const telemetry = { startedAt: Date.now(), requests: 0, errors: 0, slow: 0 };
  app.use((req, res, next) => {
    const started = Date.now();
    req.requestId = randomUUID();
    res.set("X-Request-ID", req.requestId);
    res.once("finish", () => {
      const durationMs = Date.now() - started;
      telemetry.requests++;
      if (res.statusCode >= 500) telemetry.errors++;
      if (durationMs > 2000) telemetry.slow++;
      if (cfg.production && (res.statusCode >= 500 || durationMs > 2000))
        console.error(
          JSON.stringify({
            level: res.statusCode >= 500 ? "error" : "warn",
            requestId: req.requestId,
            method: req.method,
            route: req.route?.path || "unmatched",
            status: res.statusCode,
            durationMs,
          }),
        );
    });
    next();
  });
  app.disable("x-powered-by");
  app.set("trust proxy", cfg.trustProxy);
  app.use(
    helmet({
      crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
      contentSecurityPolicy: {
        directives: {
          "script-src": [
            "'self'",
            "https://apis.google.com",
            "https://www.gstatic.com",
          ],
          "frame-src": [
            ...(cfg.projectId
              ? ["https://" + cfg.projectId + ".firebaseapp.com"]
              : []),
          ],
          "connect-src": [
            ...(cfg.projectId
              ? ["https://" + cfg.projectId + ".firebaseapp.com"]
              : []),
            "'self'",
            ...cfg.origins,
            "https://identitytoolkit.googleapis.com",
            "https://securetoken.googleapis.com",
          ],
          "style-src": ["'self'", "'unsafe-inline'"],
          "img-src": ["'self'", "data:", "blob:"],
          "worker-src": ["'self'", "blob:"],
        },
      },
    }),
  );
  app.use(cookieParser());
  app.use(
    cors({
      origin: (origin, cb) => cb(null, !origin || auth.originAllowed(origin)),
      credentials: true,
    }),
  );
  app.use(["/api", "/payment-checkout", "/checkout"], (req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  app.use(
    "/api",
    rateLimit({
      windowMs: 60000,
      limit: 1200,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: {
        error: "Too many requests. Please try again shortly.",
        code: "RATE_LIMITED",
      },
    }),
  );
  app.get("/api/public", async (req, res) => {
    const company = await business.settings(store);
    res.json({
      name: company.name || "ANVIRA",
      termsUrl: company.termsUrl || "",
      privacyUrl: company.privacyUrl || "",
      supportPhone: company.supportPhone || "",
      policyPublished: company.policyPublished,
    });
  });
  app.get("/api/documents/download", async (req, res) => {
    if (!firebase.bucket?.download)
      fail(404, "Document storage is unavailable.");
    const token = z.string().max(200).parse(req.query.token);
    const document = await firebase.bucket.download(token);
    res
      .set({
        "Content-Type": document.contentType,
        "Content-Disposition": "attachment; filename=professional-document",
        "Cache-Control": "no-store",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "X-Content-Type-Options": "nosniff",
      })
      .send(document.buffer);
  });
  app.get("/api/catalog", async (req, res) => {
    const services = await store.list(
      "services",
      [["active", "==", true]],
      100,
    );
    const company = await business.settings(store);
    res.json({
      services: services
        .filter((s) => !cfg.live || !s.sample || s.sampleReviewed)
        .map((s) => ({
          ...serviceSchema.parse(s),
          id: s.id,
          sample: !!s.sample,
        }))
        .sort((a, b) => a.order - b.order),
      pins: company.pins,
      mode: cfg.mode,
    });
  });
  app.get("/api/ready", async (req, res) => {
    try {
      await store.get("settings", "company");
      res.json({ ok: true });
    } catch {
      res.status(503).json({ ok: false, code: "DATABASE_UNAVAILABLE" });
    }
  });
  app.get("/api/health", (req, res) =>
    res.json({
      ok: true,
      mode: cfg.mode,
      payments: cfg.paymentMode,
      paymentEnvironment:
        cfg.paymentMode === "demo" ? "simulated" : cfg.paymentEnvironment,
      configured: {
        identity: !!firebase.auth,
        storage: !!firebase.bucket,
        payments:
          cfg.paymentMode === "demo" ||
          !!(cfg.razorpayKeyId && cfg.razorpayKeySecret && cfg.webhookSecret),
        payouts: cfg.payoutsEnabled,
      },
    }),
  );
  app.post(
    ["/api/webhooks/razorpay", "/api/webhooks/razorpayx"],
    express.raw({ type: "application/json", limit: "1mb" }),
    async (req, res) => {
      if (cfg.paymentMode !== "razorpay")
        fail(404, "Webhook is unavailable in demo mode.");
      const raw = Buffer.isBuffer(req.body) ? req.body : req.rawBody;
      if (
        !raw ||
        !validSignature(
          raw,
          req.get("x-razorpay-signature"),
          req.path.endsWith("razorpayx")
            ? cfg.payoutWebhookSecret
            : cfg.webhookSecret,
        )
      )
        fail(400, "Invalid webhook signature.", "INVALID_WEBHOOK_SIGNATURE");
      let event;
      try {
        event = JSON.parse(raw.toString());
      } catch {
        fail(400, "Invalid webhook payload.");
      }
      const eventId = createHash("sha256")
        .update(req.get("x-razorpay-event-id") || raw)
        .digest("hex");
      if (["payment.captured", "order.paid"].includes(event.event)) {
        const payment = event.payload?.payment?.entity;
        if (!payment) fail(400, "Missing payment entity.");
        await business.paymentCaptured(payment, eventId);
      } else
        await store.transaction(async (tx) => {
          if (await tx.get("events", eventId)) return;
          const refund = event.payload?.refund?.entity,
            payout = event.payload?.payout?.entity,
            payment = event.payload?.payment?.entity;
          if (event.event?.startsWith("fund_account.validation.")) {
            const validation =
              event.payload?.["fund_account.validation"]?.entity;
            if (!validation || !req.path.endsWith("razorpayx"))
              fail(400, "Invalid bank verification webhook.");
            const record =
              (
                await tx.list(
                  "bankVerifications",
                  [["gatewayId", "==", validation.id]],
                  1,
                )
              )[0] ||
              (validation.notes?.anviraVerificationId &&
                (await tx.get(
                  "bankVerifications",
                  validation.notes.anviraVerificationId,
                )));
            if (!record)
              fail(
                409,
                "Bank verification is not linked yet. Reconcile its provider identifier.",
              );
            await finance.applyValidation(tx, record, validation);
          }
          if (event.event?.startsWith("refund.") && refund) {
            const b = (
              await tx.list(
                "bookings",
                [["paymentId", "==", refund.payment_id]],
                1,
              )
            )[0];
            if (!b || refund.amount !== b.total * 100)
              fail(400, "Refund does not match a booking.", "REFUND_MISMATCH");
            if (b.refundId && b.refundId !== refund.id)
              fail(409, "A different refund is already recorded.");
            b.refundId = refund.id;
            b.refund =
              b.refund === "refunded" || event.event === "refund.processed"
                ? "refunded"
                : b.refund === "failed" || event.event === "refund.failed"
                  ? "failed"
                  : "processing";
            if (b.refund === "refunded") b.payment = "refunded";
            tx.put("bookings", b);
            business.notify(tx, b.customerId, "Refund updated", b.refund, b.id);
          }
          if (event.event?.startsWith("payout.") && payout) {
            const p = (
              await tx.list("payouts", [["gatewayId", "==", payout.id]], 1)
            )[0];
            if (
              !p ||
              payout.currency !== "INR" ||
              payout.amount !== p.amount * 100
            )
              fail(400, "Payout does not match a request.", "PAYOUT_MISMATCH");
            const wallet = await tx.get("wallets", p.professionalId);
            if (event.event === "payout.processed" && p.status !== "paid") {
              if (p.status === "failed" || p.status === "reversed")
                fail(409, "Payout requires reconciliation.");
              wallet.held -= p.amount;
              wallet.paid += p.amount;
              p.status = "paid";
            }
            if (
              ["payout.failed", "payout.reversed"].includes(event.event) &&
              !["failed", "reversed"].includes(p.status)
            ) {
              if (p.status === "paid") wallet.paid -= p.amount;
              else wallet.held -= p.amount;
              wallet.available += p.amount;
              p.status =
                event.event === "payout.reversed" ? "reversed" : "failed";
            }
            tx.put("wallets", wallet);
            tx.put("payouts", p);
            business.notify(tx, p.professionalId, "Payout updated", p.status);
          }
          if (event.event === "payment.failed" && payment) {
            const b = (
              await tx.list(
                "bookings",
                [["orderId", "==", payment.order_id]],
                1,
              )
            )[0];
            if (b && b.payment === "pending") {
              b.lastPaymentFailure = "Payment failed. Try again.";
              tx.put("bookings", b);
            }
          }
          tx.put("events", {
            id: eventId,
            createdAt: Date.now(),
            event: String(event.event || "unknown").slice(0, 100),
          });
        });
      res.json({ received: true });
    },
  );
  app.use(express.json({ limit: "64kb" }));
  app.get("/api/csrf", auth.csrf);
  app.post("/api/session", auth.session);
  async function verifyPayment(ticket, input) {
    const b = await store.get("bookings", ticket.bookingId);
    if (!b?.orderId) fail(409, "Payment order is unavailable.");
    const v = z
      .object({
        razorpay_payment_id: z.string().regex(/^pay_[A-Za-z0-9]+$/),
        razorpay_signature: z.string().length(64),
      })
      .parse(input);
    if (
      !validSignature(
        b.orderId + "|" + v.razorpay_payment_id,
        v.razorpay_signature,
        cfg.razorpayKeySecret,
      )
    )
      fail(400, "Payment verification failed.", "INVALID_PAYMENT_SIGNATURE");
    const payment = await gateway.payment(v.razorpay_payment_id);
    if (
      payment.order_id !== b.orderId ||
      payment.amount !== b.total * 100 ||
      payment.currency !== "INR"
    )
      fail(400, "Payment details do not match.", "PAYMENT_MISMATCH");
    if (payment.status === "captured")
      return business.paymentCaptured(payment, "verified_" + payment.id);
    return {
      status: "payment_pending",
      message:
        "Payment is awaiting capture. Your booking will update automatically.",
    };
  }
  async function checkoutTicket(token) {
    if (!/^[a-f0-9]{64}$/.test(token)) fail(404, "Payment link not found.");
    const t = await store.get(
      "checkoutTickets",
      createHash("sha256").update(token).digest("hex"),
    );
    if (!t || t.expiresAt < Date.now())
      fail(410, "Payment link expired. Open payment from your booking again.");
    return t;
  }
  app.post("/api/checkout/:token/verify", async (req, res) =>
    res.json(
      await verifyPayment(await checkoutTicket(req.params.token), req.body),
    ),
  );
  app.get(
    ["/payment-checkout/:token", "/checkout/:token"],
    async (req, res, next) => {
      // Service customization is an Expo route under /checkout/:serviceId.
      if (
        req.path.startsWith("/checkout/") &&
        !/^[a-f0-9]{64}$/.test(req.params.token)
      )
        return next();
      const ticket = await checkoutTicket(req.params.token),
        b = await store.get("bookings", ticket.bookingId);
      if (!b || b.payment !== "pending" || !b.orderId)
        fail(409, "This booking is not awaiting payment.");
      const nonce = randomBytes(18).toString("base64");
      res.set(
        "Content-Security-Policy",
        `default-src 'self'; script-src 'self' 'nonce-${nonce}' https://checkout.razorpay.com; style-src 'self' 'unsafe-inline'; frame-src https://api.razorpay.com https://checkout.razorpay.com; connect-src 'self' https://api.razorpay.com https://checkout.razorpay.com; img-src 'self' data: https://*.razorpay.com;`,
      );
      res.set("Referrer-Policy", "no-referrer");
      res.type("html").send(
        paymentPage({
          booking: b,
          config: cfg,
          token: req.params.token,
          nonce,
        }),
      );
    },
  );
  app.use("/api", auth.middleware);
  app.use(
    "/api",
    rateLimit({
      windowMs: 60000,
      limit: 180,
      keyGenerator: (req) => req.user.id,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: {
        error: "Too many requests for this account. Please wait a minute.",
        code: "RATE_LIMITED",
      },
    }),
  );
  app.use("/api", async (req, res, next) => {
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && cfg.live)
      await store.transaction(async (tx) => {
        const id = req.user.id + "_" + Math.floor(Date.now() / 60000),
          count = (await tx.get("quota", id)) || {
            id,
            count: 0,
            expiresAt: Date.now() + 120000,
          };
        if (count.count >= 30)
          fail(429, "Too many changes. Please wait a minute.", "RATE_LIMITED");
        count.count++;
        tx.put("quota", count);
      });
    next();
  });
  app.post("/api/logout", async (req, res) => {
    if (typeof req.body.deviceId === "string") {
      await store.transaction(async (tx) => {
        const device = await tx.get("devices", req.body.deviceId);
        if (device?.userId === req.user.id)
          tx.put("devices", { ...device, active: false });
      });
    }
    auth.logout(req, res);
  });
  app.get("/api/state", async (req, res) => {
    const u = req.user,
      staff = ["owner", "care"].includes(u.role),
      bFilters = staff
        ? []
        : [
            [
              u.role === "professional" ? "professionalId" : "customerId",
              "==",
              u.id,
            ],
          ];
    const [
      bookings,
      services,
      professionals,
      tickets,
      notifications,
      addresses,
      audit,
      staffUsers,
      ledger,
      payouts,
      wallet,
      company,
      promotions,
      financialJobs,
    ] = await Promise.all([
      store.list("bookings", bFilters, 200, {
        order: [
          ["createdAt", "desc"],
          ["id", "desc"],
        ],
      }),
      store.list("services", [], 100),
      store.list(
        "professionals",
        staff || u.role === "professional" ? [] : [["approved", "==", true]],
        200,
      ),
      store.list("tickets", staff ? [] : [["customerId", "==", u.id]], 100, {
        order: [
          ["createdAt", "desc"],
          ["id", "desc"],
        ],
      }),
      store.list("notifications", [["userId", "==", u.id]], 100, {
        order: [
          ["createdAt", "desc"],
          ["id", "desc"],
        ],
      }),
      store.list("addresses", [["customerId", "==", u.id]], 20),
      u.role === "owner"
        ? store.list("audit", [], 200, {
            order: [
              ["createdAt", "desc"],
              ["id", "desc"],
            ],
          })
        : [],
      u.role === "owner"
        ? store.list("users", [["role", "in", ["owner", "care"]]], 100)
        : [],
      u.role === "professional"
        ? store.list("ledger", [["professionalId", "==", u.id]], 200, {
            order: [
              ["createdAt", "desc"],
              ["id", "desc"],
            ],
          })
        : [],
      store.list(
        "payouts",
        u.role === "owner" ? [] : [["professionalId", "==", u.id]],
        100,
        {
          order: [
            ["createdAt", "desc"],
            ["id", "desc"],
          ],
        },
      ),
      u.role === "professional" ? store.get("wallets", u.id) : null,
      store.get("settings", "company"),
      store.list("promotions", [["active", "==", true]], 50),
      u.role === "owner"
        ? store.list("jobs", [["status", "==", "needs_reconciliation"]], 50)
        : [],
    ]);
    if (
      u.primaryRole === "professional" &&
      !professionals.some((p) => p.id === u.id)
    ) {
      const own = await store.get("professionals", u.id);
      if (own) professionals.push(own);
    }
    const profiles = professionals
      .filter((p) => staff || p.approved || p.id === u.id)
      .map((p) =>
        u.role === "owner" || p.id === u.id
          ? omit(p, [
              "contactId",
              "fundAccountId",
              "bankVerificationId",
              "bankUpdateLease",
            ])
          : omit(p, [
              "documents",
              "bankLast4",
              "contactId",
              "fundAccountId",
              "bankHolderName",
              "bankIfsc",
              "bankVerification",
              "bankRegisteredName",
              "bankVerificationId",
              "bankUpdateLease",
              "bankChangedAt",
              "bankEligibleAt",
              "bankVerifiedAt",
              "email",
              "phone",
              "schedule",
              "termsAccepted",
            ]),
      );
    res.set("Cache-Control", "no-store");
    res.json({
      user: omit(u, ["authTime"]),
      mode: cfg.mode,
      features: {
        payouts: cfg.paymentMode === "demo" || cfg.payoutsEnabled,
        bankVerification:
          cfg.paymentMode === "demo" ||
          (cfg.bankVerificationEnabled && cfg.paymentEnvironment === "live"),
        paymentEnvironment:
          cfg.paymentMode === "demo" ? "simulated" : cfg.paymentEnvironment,
      },
      services: services
        .filter(
          (s) =>
            u.role === "owner" ||
            (s.active && (!cfg.live || !s.sample || s.sampleReviewed)),
        )
        .sort((a, b) => (a.order || 0) - (b.order || 0)),
      professionals: profiles,
      bookings: bookings.sort((a, b) => b.createdAt - a.createdAt),
      tickets: tickets.sort((a, b) => b.createdAt - a.createdAt),
      notifications: notifications.sort((a, b) => b.createdAt - a.createdAt),
      addresses,
      audit: audit.sort((a, b) => b.createdAt - a.createdAt),
      staff: staffUsers.map((x) => omit(x, ["phone"])),
      ledger,
      payouts: payouts.map((p) => omit(p, ["fundAccountId"])),
      wallet: wallet || { available: 0, held: 0, paid: 0 },
      settings: company || (await business.settings(store)),
      promotions,
      financialJobs,
      limits: { bookings: 200, audit: 200 },
      hasMoreBookings: bookings.length === 200,
    });
  });
  app.get("/api/bookings/:id", async (req, res) =>
    res.json(await business.booking(store, req.params.id, req.user)),
  );
  app.get("/api/bookings/:id/messages", async (req, res) => {
    await business.booking(store, req.params.id, req.user);
    const records = await store.list(
      "messages",
      [["bookingId", "==", req.params.id]],
      101,
      { order: recentOrder, cursor: pageCursor(req.query.cursor) },
    );
    const page = pageResponse(records);
    page.rows = page.rows.filter((message) => message.expiresAt > Date.now());
    res.set("Cache-Control", "no-store").json(page);
  });
  app.post("/api/bookings/:id/messages", async (req, res) => {
    const input = z
      .object({
        message: z.string().trim().min(1).max(1000),
        idempotencyKey: z.string().min(8).max(100),
      })
      .parse(req.body);
    const u = req.user,
      id = createHash("sha256")
        .update(u.id + ":" + req.params.id + ":" + input.idempotencyKey)
        .digest("hex");
    const message = await store.transaction(async (tx) => {
      const b = await business.booking(tx, req.params.id, u),
        existing = await tx.get("messages", id);
      if (existing) {
        if (existing.expiresAt <= Date.now())
          fail(410, "This message has expired.");
        if (existing.message !== input.message)
          fail(409, "A retry key cannot be reused for another message.");
        return existing;
      }
      if (
        !b.professionalId ||
        !["assigned", "confirmed", "in_progress", "completed"].includes(
          b.status,
        )
      )
        fail(409, "Messaging is available after a professional is assigned.");
      if (b.completedAt && b.completedAt < Date.now() - 7 * 86400000)
        fail(409, "This conversation is closed. Contact ANVIRA support.");
      if ((b.messageCount || 0) >= 1000)
        fail(409, "This conversation has reached its limit. Contact support.");
      const record = {
        id,
        bookingId: b.id,
        senderId: u.id,
        senderName: ["owner", "care"].includes(u.role)
          ? "ANVIRA Support"
          : u.name,
        senderRole: u.role,
        message: input.message,
        createdAt: Date.now(),
        expiresAt: Date.now() + 30 * 86400000,
      };
      tx.put("messages", record);
      tx.put("bookings", { ...b, messageCount: (b.messageCount || 0) + 1 });
      for (const target of new Set([b.customerId, b.professionalId]))
        if (target !== u.id)
          business.notify(
            tx,
            target,
            "New booking message",
            "Open your booking to read the conversation.",
            b.id,
          );
      business.audit(tx, u, "booking_message_sent", b.id);
      return record;
    });
    res.json(message);
  });
  app.get("/api/reports/summary", async (req, res) => {
    assertRole(req.user, "owner", "care");
    res
      .set("Cache-Control", "no-store")
      .json(await reportSummary(store, req.user.role, reportRange(req.query)));
  });
  app.get("/api/records/:kind", async (req, res) => {
    const u = req.user,
      staff = ["owner", "care"].includes(u.role),
      kind = req.params.kind;
    let filters = [],
      idOnly = false,
      source = kind;
    if (kind === "professionals") {
      assertRole(u, "owner", "care");
      idOnly = true;
    } else if (kind === "staff") {
      assertRole(u, "owner");
      source = "users";
      filters = [["role", "in", ["owner", "care"]]];
      idOnly = true;
    } else if (kind === "tickets") {
      filters = staff ? [] : [["customerId", "==", u.id]];
      if (req.query.status !== undefined || req.query.priority !== undefined) {
        assertRole(u, "owner", "care");
        if (req.query.status !== undefined)
          filters.push([
            "status",
            "==",
            z.enum(["open", "resolved"]).parse(req.query.status),
          ]);
        if (req.query.priority !== undefined && req.query.status === undefined)
          fail(400, "Choose a request status when filtering by priority.");
        if (req.query.priority !== undefined)
          filters.push([
            "priority",
            "==",
            z.enum(["high", "normal"]).parse(req.query.priority),
          ]);
      }
    } else if (kind === "notifications") filters = [["userId", "==", u.id]];
    else if (kind === "ledger") {
      assertRole(u, "professional");
      filters = [["professionalId", "==", u.id]];
    } else if (kind === "payouts") {
      assertRole(u, "professional", "owner");
      filters = u.role === "owner" ? [] : [["professionalId", "==", u.id]];
    } else if (kind === "audit") assertRole(u, "owner");
    else fail(404, "Unknown record list.");
    const records = await store.list(source, filters, 101, {
      order: idOnly ? [["id", "desc"]] : recentOrder,
      cursor: pageCursor(req.query.cursor, idOnly),
    });
    const page = pageResponse(records, idOnly);
    page.rows = page.rows.map((r) =>
      kind === "professionals"
        ? omit(
            r,
            u.role === "owner"
              ? [
                  "contactId",
                  "fundAccountId",
                  "bankVerificationId",
                  "bankUpdateLease",
                ]
              : [
                  "documents",
                  "bankLast4",
                  "contactId",
                  "fundAccountId",
                  ...privateBankFields,
                  "phone",
                  "email",
                  "schedule",
                  "termsAccepted",
                ],
          )
        : kind === "staff"
          ? omit(r, ["phone"])
          : kind === "payouts"
            ? omit(r, ["fundAccountId"])
            : r,
    );
    res.set("Cache-Control", "no-store").json(page);
  });
  app.get("/api/bookings", async (req, res) => {
    const u = req.user,
      filters = ["owner", "care"].includes(u.role)
        ? []
        : [
            [
              u.role === "professional" ? "professionalId" : "customerId",
              "==",
              u.id,
            ],
          ];
    let cursor;
    if (req.query.cursor) {
      try {
        cursor = z
          .tuple([z.number().int(), z.string().min(1).max(100)])
          .parse(JSON.parse(z.string().max(200).parse(req.query.cursor)));
      } catch {
        fail(400, "Invalid page cursor.");
      }
    }
    const records = await store.list("bookings", filters, 101, {
      order: [
        ["createdAt", "desc"],
        ["id", "desc"],
      ],
      cursor,
    });
    const rows = records.slice(0, 100);
    res.json({
      rows,
      nextCursor:
        records.length > 100 ? [rows.at(-1).createdAt, rows.at(-1).id] : null,
    });
  });
  app.post("/api/quote", async (req, res) => {
    assertRole(req.user, "customer");
    const service = await store.get(
      "services",
      z.string().parse(req.body.serviceId),
    );
    if (
      !service?.active ||
      (cfg.live && service.sample && !service.sampleReviewed)
    )
      fail(400, "Service is unavailable.");
    const { subtotal } = serviceSelection(service, req.body);
    let discount = 0;
    if (req.body.promoCode) {
      const code = z
          .string()
          .trim()
          .max(30)
          .parse(req.body.promoCode)
          .toUpperCase(),
        promo = await store.get("promotions", code);
      if (
        !promo?.active ||
        promo.expiresAt < Date.now() ||
        promo.uses >= promo.maxUses ||
        subtotal < promo.minAmount
      )
        fail(400, "This offer is not available.", "OFFER_UNAVAILABLE");
      discount = promo.discountAmount;
    }
    if (discount >= subtotal) fail(400, "The total must be at least ₹1.");
    res.json({ subtotal, discount, total: subtotal - discount });
  });
  app.get("/api/availability", async (req, res) =>
    res.json(
      await business.availability(
        req.user,
        String(req.query.serviceId || ""),
        String(req.query.date || ""),
        req.query.bookingId ? String(req.query.bookingId) : undefined,
        req.query.pin ? String(req.query.pin) : undefined,
        req.query.selection ? parseSelection(req.query.selection) : {},
      ),
    ),
  );
  app.post("/api/bookings", async (req, res) =>
    res.status(201).json(await business.createBooking(req.user, req.body)),
  );
  app.post("/api/bookings/:id/action", async (req, res) => {
    if (req.body.action === "refund") await auth.recent(req);
    let b = await business.action(req.user, req.params.id, req.body);
    if (req.body.action === "refund" && cfg.paymentMode === "demo") {
      await jobs.financialJobs();
      b = await store.get("bookings", b.id);
    }
    res.json(b);
  });
  app.post("/api/bookings/:id/payment/order", async (req, res) => {
    assertRole(req.user, "customer");
    let b = await store.transaction(async (tx) => {
      const b = await business.booking(tx, req.params.id, req.user);
      if (
        b.payment !== "pending" ||
        b.status !== "payment_pending" ||
        b.expiresAt < Date.now()
      )
        fail(409, "This booking is not awaiting a payment.", "PAYMENT_EXPIRED");
      if (b.orderId) return b;
      if (["creating", "unknown"].includes(b.orderState))
        fail(
          409,
          "Payment order creation is pending reconciliation. Do not pay again.",
          "ORDER_RECONCILIATION_REQUIRED",
        );
      b.orderState = "creating";
      tx.put("bookings", b);
      return b;
    });
    if (!b.orderId) {
      try {
        const order = await gateway.order(b);
        if (order.amount !== b.total * 100 || order.currency !== "INR")
          fail(502, "Payment provider returned a mismatched order.");
        b = await store.transaction(async (tx) => {
          const current = await tx.get("bookings", b.id);
          current.orderId = order.id;
          current.orderState = "ready";
          tx.put("bookings", current);
          return current;
        });
      } catch (e) {
        await store.transaction(async (tx) => {
          const current = await tx.get("bookings", b.id);
          current.orderState =
            e.code === "PAYMENT_NOT_CONFIGURED" ? "unconfigured" : "unknown";
          tx.put("bookings", current);
        });
        throw e;
      }
    }
    const token = randomBytes(32).toString("hex");
    await store.transaction(async (tx) =>
      tx.put("checkoutTickets", {
        id: createHash("sha256").update(token).digest("hex"),
        customerId: req.user.id,
        bookingId: b.id,
        expiresAt: Math.min(b.expiresAt, Date.now() + 5 * 60000),
        createdAt: Date.now(),
      }),
    );
    res.json({
      mode: cfg.paymentMode,
      checkoutUrl: cfg.publicUrl + "/payment-checkout/" + token,
      bookingId: b.id,
    });
  });
  app.post("/api/bookings/:id/payment/verify", async (req, res) => {
    assertRole(req.user, "customer");
    await business.booking(store, req.params.id, req.user);
    res.json(await verifyPayment({ bookingId: req.params.id }, req.body));
  });
  app.post("/api/addresses", async (req, res) => {
    assertRole(req.user, "customer");
    const value = addressSchema.parse(req.body);
    const id = randomUUID();
    await store.transaction(async (tx) => {
      const existing = await tx.list(
        "addresses",
        [["customerId", "==", req.user.id]],
        20,
      );
      if (existing.length >= 20) fail(400, "You can save up to 20 addresses.");
      tx.put("addresses", {
        ...value,
        id,
        customerId: req.user.id,
        createdAt: Date.now(),
      });
    });
    res.status(201).json({ id, ...value });
  });
  app.patch("/api/addresses/:id", async (req, res) => {
    assertRole(req.user, "customer");
    const v = addressSchema.parse(req.body);
    await store.transaction(async (tx) => {
      const a = await tx.get("addresses", req.params.id);
      if (!a || a.customerId !== req.user.id) fail(404, "Address not found.");
      tx.put("addresses", { ...a, ...v });
    });
    res.json({ ok: true });
  });
  app.delete("/api/addresses/:id", async (req, res) => {
    assertRole(req.user, "customer");
    await store.transaction(async (tx) => {
      const a = await tx.get("addresses", req.params.id);
      if (!a || a.customerId !== req.user.id) fail(404, "Address not found.");
      tx.remove("addresses", a.id);
    });
    res.json({ ok: true });
  });
  app.patch("/api/profile", async (req, res) => {
    const v = z
      .object({
        name: z.string().trim().min(2).max(100),
        language: z.enum(["en", "te"]).default("en"),
        phone: z
          .string()
          .trim()
          .regex(/^(?:|(?:\+91)?[6-9]\d{9})$/)
          .transform((v) => (v ? "+91" + v.replace(/^\+91/, "") : ""))
          .optional(),
      })
      .parse(req.body);
    await store.transaction(async (tx) => {
      const u = await tx.get("users", req.user.id);
      tx.put("users", {
        ...u,
        ...v,
        ...(v.phone !== undefined ? { phoneVerified: false } : {}),
      });
    });
    res.json({ ok: true });
  });
  app.post("/api/tickets", async (req, res) => {
    assertRole(req.user, "customer", "professional");
    const { message, bookingId, category, idempotencyKey } = z
      .object({
        idempotencyKey: z.string().min(8).max(100).optional(),
        message: z.string().trim().min(2).max(2000),
        bookingId: z.string().min(1).max(128).optional(),
        category: z
          .enum(["general", "quality", "schedule", "payment"])
          .default("general"),
      })
      .parse(req.body);
    const t = {
      id: idempotencyKey
        ? createHash("sha256")
            .update("ticket:" + req.user.id + ":" + idempotencyKey)
            .digest("hex")
        : randomUUID(),
      customerId: req.user.id,
      customerName: req.user.name,
      ...(bookingId ? { bookingId } : {}),
      category,
      priority: category === "quality" ? "high" : "normal",
      message,
      status: "open",
      createdAt: Date.now(),
      awaitingResponse: true,
      responseDueAt: Date.now() + (category === "quality" ? 60 : 240) * 60000,
      messages: [],
    };
    await store.transaction(async (tx) => {
      if (bookingId) await business.booking(tx, bookingId, req.user);
      const previous = await tx.get("tickets", t.id);
      if (previous) {
        if (
          previous.message !== message ||
          previous.bookingId !== bookingId ||
          previous.category !== category
        )
          fail(409, "This support request changed. Send it as a new request.");
        Object.assign(t, previous);
        return;
      }
      tx.put("tickets", t);
      business.audit(tx, req.user, "support_created", t.id);
    });
    res.status(201).json(t);
  });
  app.post("/api/tickets/:id/reply", async (req, res) => {
    assertRole(req.user, "owner", "care", "customer", "professional");
    const { message, idempotencyKey } = z
      .object({
        message: z.string().trim().min(2).max(2000),
        idempotencyKey: z.string().min(8).max(100).optional(),
      })
      .parse(req.body);
    await store.transaction(async (tx) => {
      const t = await tx.get("tickets", req.params.id);
      if (!t) fail(404, "Request not found.");
      const staff = ["owner", "care"].includes(req.user.role);
      if (!staff && t.customerId !== req.user.id)
        fail(403, "You cannot access this support request.");
      const retry = t.messages?.find(
        (m) =>
          idempotencyKey &&
          m.idempotencyKey === idempotencyKey &&
          m.userId === req.user.id,
      );
      if (retry) {
        if (retry.message !== message)
          fail(409, "This reply changed. Send it as a new reply.");
        return;
      }
      if (staff && t.status === "resolved")
        fail(
          409,
          "This request is resolved. The requester can reopen it with a reply.",
        );
      if (!staff) {
        t.status = "open";
        delete t.resolvedAt;
      }
      t.updatedAt = Date.now();
      t.awaitingResponse = !staff;
      delete t.escalatedAt;
      if (staff) {
        t.firstResponseAt ||= t.updatedAt;
        delete t.responseDueAt;
      } else
        t.responseDueAt =
          t.updatedAt + (t.priority === "high" ? 60 : 240) * 60000;
      t.messages = [
        ...(t.messages || []),
        {
          message,
          ...(idempotencyKey ? { idempotencyKey, userId: req.user.id } : {}),
          at: t.updatedAt,
          sender: staff ? "ANVIRA Support" : req.user.name,
          role: req.user.role,
        },
      ].slice(-50);
      tx.put("tickets", t);
      if (staff)
        business.notify(
          tx,
          t.customerId,
          "Support replied",
          message.slice(0, 120),
          t.bookingId,
        );
      business.audit(tx, req.user, "support_reply", t.id);
    });
    res.json({ ok: true });
  });
  app.post("/api/tickets/:id/resolve", async (req, res) => {
    assertRole(req.user, "owner", "care");
    const resolution = z
      .string()
      .trim()
      .min(8)
      .max(2000)
      .optional()
      .parse(req.body.resolution);
    await store.transaction(async (tx) => {
      const t = await tx.get("tickets", req.params.id);
      if (!t) fail(404, "Request not found.");
      if (t.status === "resolved") return;
      t.status = "resolved";
      t.awaitingResponse = false;
      delete t.responseDueAt;
      t.resolvedAt = Date.now();
      t.updatedAt = t.resolvedAt;
      if (resolution)
        t.messages = [
          ...(t.messages || []),
          {
            message: resolution,
            at: t.resolvedAt,
            sender: "ANVIRA Support",
            role: req.user.role,
          },
        ].slice(-50);
      tx.put("tickets", t);
      business.audit(tx, req.user, "resolve", t.id);
      business.notify(
        tx,
        t.customerId,
        "Support request resolved",
        resolution
          ? resolution.slice(0, 120)
          : "Your request has been marked resolved.",
        t.bookingId,
      );
    });
    res.json({ status: "resolved" });
  });
  app.patch("/api/services/:id", async (req, res) => {
    assertRole(req.user, "owner");
    const update = req.body.name
      ? serviceSchema.parse(req.body)
      : z
          .object({ price: z.number().int().min(1).max(100000) })
          .parse(req.body);
    const s = await store.transaction(async (tx) => {
      const s = await tx.get("services", req.params.id);
      if (!s) fail(404, "Service not found.");
      const latest = { ...s, ...update };
      if (cfg.live && latest.sample && req.body.sampleReviewed === true) {
        latest.sample = false;
        latest.sampleReviewed = true;
        latest.reviewedBy = req.user.id;
        latest.reviewedAt = Date.now();
      }
      if (cfg.live && latest.active && latest.sample)
        fail(
          400,
          "Review and approve the sample scope and prices in service details before publishing.",
          "SAMPLE_REVIEW_REQUIRED",
        );
      tx.put("services", latest);
      business.audit(tx, req.user, "service_change", s.id);
      return latest;
    });
    res.json(s);
  });
  app.post("/api/services", async (req, res) => {
    assertRole(req.user, "owner");
    const s = {
      ...serviceSchema.parse(req.body),
      id: randomUUID(),
      sample: req.body.sample === true,
    };
    if (cfg.live && s.active && s.sample && !s.sampleReviewed)
      fail(
        400,
        "Approve sample scope and prices before publishing.",
        "SAMPLE_REVIEW_REQUIRED",
      );
    if (cfg.live && s.sampleReviewed) s.sample = false;
    await store.transaction(async (tx) => {
      tx.put("services", s);
      business.audit(tx, req.user, "service_created", s.id);
    });
    res.status(201).json(s);
  });
  app.put("/api/settings", async (req, res) => {
    assertRole(req.user, "owner");
    const value = companySchema.parse(req.body);
    await store.transaction(async (tx) => {
      tx.put("settings", {
        ...value,
        id: "company",
        timezone: "Asia/Kolkata",
        updatedAt: Date.now(),
      });
      business.audit(tx, req.user, "settings_updated", "company");
    });
    res.json({ ok: true });
  });
  app.put("/api/promotions", async (req, res) => {
    assertRole(req.user, "owner");
    const value = promotionSchema.parse(req.body);
    await store.transaction(async (tx) => {
      const old = await tx.get("promotions", value.id);
      tx.put("promotions", { ...value, uses: old?.uses || 0 });
      business.audit(tx, req.user, "promotion_saved", value.id);
    });
    res.json(value);
  });
  app.post("/api/professional/onboard", async (req, res) => {
    assertRole(req.user, "professional", "customer");
    const p = profileSchema.parse(req.body);
    await store.transaction(async (tx) => {
      const old = await tx.get("professionals", req.user.id);
      if (old?.approved)
        fail(409, "Contact support to change an approved profile.");
      const services = await tx.list("services", [], 100);
      if (p.skills.some((id) => !services.some((s) => s.id === id)))
        fail(400, "Choose valid service skills.");
      tx.put("professionals", {
        ...old,
        ...p,
        id: req.user.id,
        type: "Partner",
        approved: false,
        available: false,
        rating: 0,
        jobs: 0,
        documents: old?.documents || [],
        createdAt: old?.createdAt || Date.now(),
        status: "documents_required",
      });
      const u = await tx.get("users", req.user.id);
      tx.put("users", { ...u, name: p.name, role: "professional" });
      business.audit(tx, req.user, "onboarding_submitted", req.user.id);
    });
    if (cfg.live)
      await firebase.auth.setCustomUserClaims(req.user.id, {
        role: "professional",
      });
    res.json({ ok: true, role: "professional" });
  });
  app.post("/api/professional/photo", async (req, res) => {
    assertRole(req.user, "professional");
    const dataUri = z
      .string()
      .max(43030)
      .regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/)
      .parse(req.body.dataUri);
    const bytes = Buffer.from(dataUri.split(",")[1], "base64");
    if (!validProfilePhoto(bytes))
      fail(400, "Choose a valid compressed JPEG profile photo under 32 KB.");
    await store.transaction(async (tx) => {
      const p = await tx.get("professionals", req.user.id);
      if (!p) fail(409, "Create your professional application first.");
      const updatedAt = Date.now();
      tx.put("avatars", { id: p.id, dataUri, updatedAt });
      tx.put("professionals", { ...p, photoUpdatedAt: updatedAt });
      business.audit(tx, req.user, "profile_photo_updated", p.id);
    });
    res.json({ ok: true });
  });
  app.delete("/api/professional/photo", async (req, res) => {
    assertRole(req.user, "professional");
    await store.transaction(async (tx) => {
      const p = await tx.get("professionals", req.user.id);
      if (!p) fail(404, "Profile not found.");
      tx.remove("avatars", p.id);
      tx.put("professionals", { ...p, photoUpdatedAt: 0 });
    });
    res.json({ ok: true });
  });
  app.get("/api/professional/:id/photo", async (req, res) => {
    const p = await store.get("professionals", req.params.id);
    if (
      !p ||
      (!p.approved &&
        p.id !== req.user.id &&
        !["owner", "care"].includes(req.user.role))
    )
      fail(404, "Profile photo not found.");
    const image = await store.get("avatars", p.id);
    if (!image) fail(404, "Profile photo not found.");
    res
      .set("Cache-Control", "private, no-store")
      .json({ dataUri: image.dataUri });
  });
  app.patch("/api/professional/profile", async (req, res) => {
    assertRole(req.user, "professional");
    const value = z
      .object({
        bio: z.string().trim().max(500),
        languages: z.array(z.string().trim().min(2).max(30)).max(8),
      })
      .parse(req.body);
    await store.transaction(async (tx) => {
      const p = await tx.get("professionals", req.user.id);
      if (!p) fail(404, "Profile not found.");
      tx.put("professionals", { ...p, ...value });
      business.audit(tx, req.user, "public_profile_updated", p.id);
    });
    res.json({ ok: true });
  });
  app.patch("/api/availability", async (req, res) => {
    assertRole(req.user, "professional");
    const value = z.object({ available: z.boolean() }).parse(req.body);
    const p = await store.transaction(async (tx) => {
      const p = await tx.get("professionals", req.user.id);
      if (!p) fail(404, "Complete your professional profile.");
      if (value.available && !p.approved)
        fail(409, "Your profile must be approved before accepting work.");
      tx.put("professionals", { ...p, ...value });
      business.audit(tx, req.user, "availability", p.id);
      return { ...p, ...value };
    });
    res.json(omit(p, ["fundAccountId", "contactId"]));
  });
  app.put("/api/professional/schedule", async (req, res) => {
    assertRole(req.user, "professional");
    const schedule = scheduleSchema.parse(req.body);
    await store.transaction(async (tx) => {
      const p = await tx.get("professionals", req.user.id);
      if (!p) fail(404, "Profile not found.");
      p.schedule = schedule;
      tx.put("professionals", p);
      business.audit(tx, req.user, "schedule_updated", p.id);
    });
    res.json(schedule);
  });
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 2 },
    fileFilter: (req, file, cb) =>
      cb(
        null,
        ["application/pdf", "image/jpeg", "image/png"].includes(file.mimetype),
      ),
  }).single("file");
  app.post(
    "/api/professional/documents",
    (req, res, next) => {
      assertRole(req.user, "professional");
      if (req.rawBody) {
        import("node:stream").then(({ Readable }) => {
          const stream = Readable.from(req.rawBody);
          Object.assign(stream, { headers: req.headers });
          upload(stream, res, (error) => {
            req.file = stream.file;
            req.body = stream.body;
            next(error);
          });
        });
      } else upload(req, res, next);
    },
    async (req, res) => {
      if (!req.file) fail(400, "Choose a PDF, JPG or PNG up to 10 MB.");
      const kind = z
        .enum(["identity", "skill_certificate"])
        .parse(req.body.kind);
      const buffer = req.file.buffer,
        type = req.file.mimetype;
      if (
        (type === "application/pdf" &&
          !buffer.subarray(0, 5).equals(Buffer.from("%PDF-"))) ||
        (type === "image/png" &&
          !buffer
            .subarray(0, 8)
            .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
        (type === "image/jpeg" && !(buffer[0] === 255 && buffer[1] === 216))
      )
        fail(400, "The file type does not match its content.");
      const id = randomUUID(),
        storagePath = "professionalDocuments/" + req.user.id + "/" + id;
      const p = await store.get("professionals", req.user.id);
      if (!p || p.approved)
        fail(409, "Complete your unapproved professional profile first.");
      if (p.documents.length >= 10)
        fail(400, "You can upload up to 10 documents.");
      if (cfg.live) {
        if (!firebase.bucket)
          fail(503, "Document storage is awaiting configuration.");
        await firebase.bucket.file(storagePath).save(buffer, {
          resumable: false,
          metadata: { contentType: type, metadata: { ownerId: req.user.id } },
        });
      }
      await store.transaction(async (tx) => {
        const current = await tx.get("professionals", req.user.id);
        if (!current || current.approved || current.deletedAt)
          fail(409, "Your profile is no longer accepting documents.");
        if (current.documents.length >= 10)
          fail(400, "You can upload up to 10 documents.");
        current.documents = [
          ...current.documents,
          {
            id,
            kind,
            storagePath,
            contentType: type,
            size: buffer.length,
            uploadedAt: Date.now(),
            demo: !cfg.live,
          },
        ];
        current.status = "review_pending";
        tx.put("professionals", current);
        business.audit(tx, req.user, "document_uploaded", id);
      });
      res.status(201).json({ id, kind });
    },
  );
  app.get("/api/professionals/:id/documents/:documentId", async (req, res) => {
    if (req.user.id !== req.params.id) assertRole(req.user, "owner");
    const p = await store.get("professionals", req.params.id),
      doc = p?.documents.find((d) => d.id === req.params.documentId);
    if (!doc) fail(404, "Document not found.");
    if (!firebase.bucket)
      fail(503, "Document preview is only available with configured storage.");
    const [url] = await firebase.bucket
      .file(doc.storagePath)
      .getSignedUrl({ action: "read", expires: Date.now() + 60000 });
    res.json({ url, expiresIn: 60 });
  });
  app.patch("/api/professionals/:id/type", async (req, res) => {
    assertRole(req.user, "owner");
    const type = z.enum(["Partner", "In-house"]).parse(req.body.type);
    await store.transaction(async (tx) => {
      const p = await tx.get("professionals", req.params.id),
        wallet = await tx.get("wallets", req.params.id);
      if (!p) fail(404, "Professional not found.");
      if (wallet && (wallet.available || wallet.held))
        fail(
          409,
          "Settle the partner balance before changing employment type.",
        );
      const active = await tx.list(
        "bookings",
        [
          ["professionalId", "==", p.id],
          ["status", "in", ["assigned", "confirmed", "in_progress"]],
        ],
        1,
      );
      if (active.length)
        fail(409, "Finish active jobs before changing employment type.");
      p.type = type;
      tx.put("professionals", p);
      business.audit(tx, req.user, "professional_type_changed", p.id);
    });
    res.json({ ok: true });
  });
  app.post("/api/professionals/:id/approve", async (req, res) => {
    assertRole(req.user, "owner");
    const p = await store.transaction(async (tx) => {
      const p = await tx.get("professionals", req.params.id);
      if (!p) fail(404, "Professional not found.");
      if (
        cfg.live &&
        (req.body.verificationConfirmed !== true ||
          !p.documents?.some((d) => d.kind === "identity") ||
          !p.documents?.some((d) => d.kind === "skill_certificate"))
      )
        fail(
          400,
          "Review identity and skill documents and confirm verification before approval.",
        );
      p.approved = true;
      p.available = true;
      p.status = "approved";
      p.approvedBy = req.user.id;
      p.approvedAt = Date.now();
      tx.put("professionals", p);
      business.audit(tx, req.user, "approve", p.id);
      business.notify(
        tx,
        p.id,
        "Profile approved",
        "You can now accept ANVIRA jobs.",
      );
      return p;
    });
    res.json(omit(p, ["fundAccountId", "contactId"]));
  });
  app.post("/api/professionals/:id/reject", async (req, res) => {
    assertRole(req.user, "owner");
    const reason = z.string().trim().min(5).max(500).parse(req.body.reason);
    await store.transaction(async (tx) => {
      const p = await tx.get("professionals", req.params.id);
      if (!p) fail(404, "Professional not found.");
      p.approved = false;
      p.available = false;
      p.status = "changes_required";
      p.reviewReason = reason;
      tx.put("professionals", p);
      business.notify(tx, p.id, "Profile changes requested", reason);
      business.audit(tx, req.user, "professional_rejected", p.id);
    });
    res.json({ ok: true });
  });
  app.post("/api/professional/bank", async (req, res) => {
    assertRole(req.user, "professional");
    await auth.recent(req);
    res.json(await finance.saveBank(req.user, bankSchema.parse(req.body)));
  });
  app.post("/api/professional/bank/verify", async (req, res) => {
    assertRole(req.user, "professional");
    await auth.recent(req);
    z.literal(true).parse(req.body.consent);
    res.json(await finance.verifyBank(req.user));
  });
  app.post("/api/professional/bank/check", async (req, res) => {
    assertRole(req.user, "professional");
    res.json(await finance.checkBank(req.user));
  });
  app.post("/api/professionals/:id/bank/reconcile", async (req, res) => {
    assertRole(req.user, "owner");
    await auth.recent(req);
    const gatewayId = z
      .string()
      .regex(/^fav_[A-Za-z0-9]+$/)
      .parse(req.body.gatewayId);
    res.json(await finance.checkBank({ id: req.params.id }, gatewayId));
  });
  app.post("/api/professionals/:id/bank/approve-name", async (req, res) => {
    assertRole(req.user, "owner");
    await auth.recent(req);
    z.literal(true).parse(req.body.confirmed);
    await store.transaction(async (tx) => {
      const p = await tx.get("professionals", req.params.id),
        record =
          p?.bankVerificationId &&
          (await tx.get("bankVerifications", p.bankVerificationId));
      if (
        !p?.approved ||
        record?.status !== "needs_review" ||
        record.accountStatus !== "active" ||
        record.fundAccountId !== p.fundAccountId
      )
        fail(
          409,
          "Only a completed active account with a name mismatch can be reviewed.",
        );
      p.bankVerification = "verified";
      p.bankVerifiedAt = Date.now();
      record.status = "verified";
      record.reviewedBy = req.user.id;
      record.reviewedAt = Date.now();
      tx.put("professionals", p);
      tx.put("bankVerifications", record);
      business.audit(tx, req.user, "bank_holder_name_approved", record.id);
      business.notify(
        tx,
        p.id,
        "Bank account approved",
        "The Owner reviewed your bank holder name for payouts.",
      );
    });
    res.json({ ok: true });
  });
  app.get("/api/payout-schedule", async (req, res) => {
    assertRole(req.user, "owner");
    res.json(await finance.preview());
  });
  app.get("/api/professional/payout-schedule", async (req, res) => {
    assertRole(req.user, "professional");
    const schedule = await finance.settings();
    res.json({
      frequency: schedule.frequency,
      nextRunAt:
        schedule.frequency === "paused" ? null : payoutWindow(schedule).next,
      minimum: schedule.minimum,
      reserve: schedule.reserve,
      maximum: schedule.maximum,
      approvalRequired: schedule.approvalRequired,
    });
  });
  app.put("/api/payout-schedule", async (req, res) => {
    assertRole(req.user, "owner");
    await auth.recent(req);
    await finance.saveSchedule(payoutScheduleSchema.parse(req.body), req.user);
    res.json(await finance.preview());
  });
  app.post("/api/payout-schedule/demo-run", async (req, res) => {
    assertRole(req.user, "owner");
    if (cfg.paymentMode !== "demo")
      fail(403, "Demo payout runs are unavailable in Firebase mode.");
    const result = await finance.scheduled(Date.now(), true);
    await jobs.financialJobs();
    res.json(result);
  });
  app.post("/api/payouts", async (req, res) => {
    assertRole(req.user, "professional");
    const amount = z.number().int().min(100).max(100000).parse(req.body.amount),
      key = z.string().min(8).max(100).parse(req.body.idempotencyKey);
    const id = createHash("sha256")
      .update(req.user.id + ":" + key)
      .digest("hex")
      .slice(0, 36);
    const payout = await store.transaction(async (tx) => {
      const existing = await tx.get("payouts", id);
      if (existing) {
        if (existing.amount !== amount)
          fail(409, "Payout request has changed.");
        return existing;
      }
      const p = await tx.get("professionals", req.user.id),
        wallet = await tx.get("wallets", req.user.id);
      if (
        p?.type !== "Partner" ||
        !p.approved ||
        !p.fundAccountId ||
        p.bankUpdateLease ||
        p.bankVerification !== "verified" ||
        (p.bankEligibleAt || 0) > Date.now()
      )
        fail(
          409,
          "An approved partner and verified bank account with no cooling period are required.",
        );
      if (!wallet || wallet.available < amount)
        fail(409, "This amount exceeds your available balance.");
      wallet.available -= amount;
      wallet.held += amount;
      tx.put("wallets", wallet);
      const payout = {
        id,
        professionalId: req.user.id,
        professionalName: p.name,
        amount,
        status: "requested",
        fundAccountId: p.fundAccountId,
        bankLast4: p.bankLast4,
        source: "manual",
        createdAt: Date.now(),
      };
      tx.put("payouts", payout);
      business.audit(tx, req.user, "payout_requested", id);
      return payout;
    });
    res.status(201).json(omit(payout, ["fundAccountId"]));
  });
  app.post("/api/payouts/:id/approve", async (req, res) => {
    assertRole(req.user, "owner");
    await auth.recent(req);
    await store.transaction(async (tx) => {
      const p = await tx.get("payouts", req.params.id);
      if (!p || p.status !== "requested")
        fail(409, "No payout is awaiting approval.");
      const professional = await tx.get("professionals", p.professionalId),
        user = await tx.get("users", p.professionalId);
      if (
        !professional?.approved ||
        professional.bankVerification !== "verified" ||
        professional.bankUpdateLease ||
        professional.fundAccountId !== p.fundAccountId ||
        user?.active === false
      )
        fail(
          409,
          "Review professional approval and the verified payout account first.",
        );
      p.status = "processing";
      tx.put("payouts", p);
      queuePayout(tx, p);
      business.audit(tx, req.user, "payout_approved", p.id);
    });
    if (cfg.paymentMode === "demo") await jobs.financialJobs();
    res.json(
      omit(await store.get("payouts", req.params.id), ["fundAccountId"]),
    );
  });
  app.post("/api/payouts/:id/reject", async (req, res) => {
    assertRole(req.user, "owner");
    await store.transaction(async (tx) => {
      const p = await tx.get("payouts", req.params.id);
      if (!p || p.status !== "requested")
        fail(409, "Only pending payout requests can be rejected.");
      const wallet = await tx.get("wallets", p.professionalId);
      wallet.held -= p.amount;
      wallet.available += p.amount;
      tx.put("wallets", wallet);
      p.status = "rejected";
      tx.put("payouts", p);
      business.audit(tx, req.user, "payout_rejected", p.id);
    });
    res.json({ ok: true });
  });
  app.post("/api/devices", async (req, res) => {
    const token = z
      .string()
      .regex(/^(Expo|Exponent)PushToken\[[A-Za-z0-9_-]+\]$/)
      .parse(req.body.token);
    const id = createHash("sha256").update(token).digest("hex");
    await store.transaction(async (tx) =>
      tx.put("devices", {
        id,
        userId: req.user.id,
        token,
        active: true,
        updatedAt: Date.now(),
      }),
    );
    res.json({ id });
  });
  app.delete("/api/devices/:id", async (req, res) => {
    await store.transaction(async (tx) => {
      const d = await tx.get("devices", req.params.id);
      if (d?.userId === req.user.id) tx.put("devices", { ...d, active: false });
    });
    res.json({ ok: true });
  });
  app.post("/api/notifications/read", async (req, res) => {
    const id = z.string().min(1).max(100).parse(req.body.id);
    await store.transaction(async (tx) => {
      const n = await tx.get("notifications", id);
      if (!n || n.userId !== req.user.id) fail(404, "Notification not found.");
      n.read = true;
      tx.put("notifications", n);
    });
    res.json({ ok: true });
  });
  app.post("/api/notifications/read-many", async (req, res) => {
    const ids = z
      .array(z.string().min(1).max(100))
      .min(1)
      .max(100)
      .parse(req.body.ids);
    await store.transaction(async (tx) => {
      for (const id of new Set(ids)) {
        const n = await tx.get("notifications", id);
        if (!n || n.userId !== req.user.id)
          fail(404, "Notification not found.");
        tx.put("notifications", { ...n, read: true });
      }
    });
    res.json({ ok: true });
  });
  app.post("/api/staff", async (req, res) => {
    assertRole(req.user, "owner");
    await auth.recent(req);
    const v = z
      .object({
        email: z
          .string()
          .trim()
          .email()
          .transform((email) => email.toLowerCase()),
        name: z.string().trim().min(2).max(100),
        role: z.literal("care"),
        password: z.string().min(8).max(128),
      })
      .parse(req.body);
    let uid = randomUUID();
    if (cfg.live) {
      try {
        uid = (
          await firebase.auth.createUser({
            email: v.email,
            displayName: v.name,
            password: v.password,
            disabled: true,
          })
        ).uid;
      } catch (e) {
        if (e.code === "auth/email-already-exists")
          fail(
            409,
            "This email already has an account. Use a new staff email.",
          );
        if (
          e.code === "auth/password-does-not-meet-requirements" ||
          e.code === "auth/invalid-password"
        )
          fail(
            400,
            "Choose a stronger password that meets the Firebase password policy.",
          );
        throw e;
      }
    }
    // Passwords go only to Firebase Auth, never to business records or audit data.
    const record = {
      id: uid,
      email: v.email,
      name: v.name,
      role: v.role,
      active: !cfg.live,
      createdAt: Date.now(),
    };
    try {
      if (cfg.live)
        await firebase.auth.setCustomUserClaims(uid, { role: "care" });
      await store.transaction(async (tx) => {
        if (
          !cfg.live &&
          (await tx.list("users", [["email", "==", v.email]], 1)).length
        )
          fail(
            409,
            "This email already has an account. Use a new staff email.",
          );
        tx.put("users", record);
        if (!cfg.live) business.audit(tx, req.user, "staff_added", uid);
      });
      if (cfg.live) {
        await firebase.auth.updateUser(uid, { disabled: false });
        await store.transaction(async (tx) => {
          tx.put("users", { ...record, active: true });
          business.audit(tx, req.user, "staff_added", uid);
        });
      }
    } catch (e) {
      if (!cfg.live) throw e;
      // Compensate only the new identity; an existing account is never changed.
      await firebase.auth.updateUser(uid, { disabled: true }).catch(() => {});
      await firebase.auth.deleteUser(uid).catch(() => {});
      await store
        .transaction(async (tx) => tx.remove("users", uid))
        .catch(() => {});
      throw e;
    }
    res.status(201).json({ id: uid });
  });
  app.post("/api/staff/:id/status", async (req, res) => {
    assertRole(req.user, "owner");
    await auth.recent(req);
    const active = z.boolean().parse(req.body.active);
    await store.transaction(async (tx) => {
      const user = await tx.get("users", req.params.id);
      if (user?.role !== "care")
        fail(400, "Only Customer Care accounts can be changed here.");
      user.active = active;
      tx.put("users", user);
      business.audit(tx, req.user, "staff_status", user.id);
    });
    if (cfg.live) {
      await firebase.auth.updateUser(req.params.id, { disabled: !active });
      await firebase.auth.revokeRefreshTokens(req.params.id);
    }
    res.json({ ok: true });
  });
  app.get("/api/reports/export", async (req, res) => {
    assertRole(req.user, "owner");
    const from = z.coerce.number().int().parse(req.query.from),
      to = z.coerce.number().int().parse(req.query.to);
    if (to < from || to - from > 31 * 86400000)
      fail(400, "Choose a report range up to 31 days.");
    const bookings = await store.list(
      "bookings",
      [
        ["createdAt", ">=", from],
        ["createdAt", "<=", to],
      ],
      1000,
    );
    if (bookings.length === 1000)
      fail(413, "Report has too many rows. Choose a shorter date range.");
    const csv = (value) =>
      '"' +
      String(value ?? "")
        .replace(/^[\s\uFEFF]*[=+@-]/, "'$&")
        .replaceAll('"', '""') +
      '"';
    res
      .type("text/csv")
      .set("Content-Disposition", 'attachment; filename="anvira-bookings.csv"')
      .send(
        [
          [
            "booking_id",
            "customer",
            "service",
            "slot_utc",
            "status",
            "payment",
            "value_inr",
            "refund",
          ],
          ...bookings.map((b) => [
            b.id,
            b.customerName,
            b.serviceName,
            new Date(b.slot).toISOString(),
            b.status,
            b.payment,
            b.total,
            b.refund,
          ]),
        ]
          .map((row) => row.map(csv).join(","))
          .join("\r\n"),
      );
  });
  app.post("/api/reconcile/order", async (req, res) => {
    assertRole(req.user, "owner");
    await auth.recent(req);
    const bookingId = z.string().uuid().parse(req.body.bookingId),
      orderId = z
        .string()
        .regex(/^order_[A-Za-z0-9]+$/)
        .parse(req.body.orderId);
    const b = await store.get("bookings", bookingId);
    if (!b) fail(404, "Booking not found.");
    const order = await gateway.orderStatus(orderId);
    if (
      order.receipt !== b.id ||
      order.notes?.bookingId !== b.id ||
      order.amount !== b.total * 100 ||
      order.currency !== "INR"
    )
      fail(400, "Order does not match this booking.");
    await store.transaction(async (tx) => {
      const latest = await tx.get("bookings", b.id);
      if (latest.orderId && latest.orderId !== orderId)
        fail(409, "A different order is already linked.");
      latest.orderId = orderId;
      latest.orderState = "ready";
      tx.put("bookings", latest);
      business.audit(tx, req.user, "order_reconciled", b.id);
    });
    res.json({ ok: true });
  });
  app.post("/api/reconcile/payout", async (req, res) => {
    assertRole(req.user, "owner");
    await auth.recent(req);
    const id = z.string().min(8).max(100).parse(req.body.payoutId),
      gatewayId = z
        .string()
        .regex(/^pout_[A-Za-z0-9]+$/)
        .parse(req.body.gatewayId),
      p = await store.get("payouts", id);
    if (!p) fail(404, "Payout not found.");
    const result = await gateway.payoutStatus(gatewayId);
    if (
      result.reference_id !== p.id ||
      result.amount !== p.amount * 100 ||
      result.currency !== "INR"
    )
      fail(400, "Provider payout does not match this request.");
    await store.transaction(async (tx) => {
      const current = await tx.get("payouts", id),
        wallet = await tx.get("wallets", p.professionalId);
      if (current.gatewayId && current.gatewayId !== gatewayId)
        fail(409, "A different payout is already linked.");
      if (result.status === "processed" && current.status !== "paid") {
        if (["failed", "reversed", "rejected"].includes(current.status))
          fail(409, "This payout needs manual accounting review.");
        wallet.held -= p.amount;
        wallet.paid += p.amount;
        current.status = "paid";
      } else if (
        ["failed", "reversed"].includes(result.status) &&
        !["failed", "reversed"].includes(current.status)
      ) {
        if (current.status === "paid") wallet.paid -= p.amount;
        else wallet.held -= p.amount;
        wallet.available += p.amount;
        current.status = result.status;
      } else if (!["paid", "failed", "reversed"].includes(current.status))
        current.status = "processing";
      current.gatewayId = gatewayId;
      tx.put("wallets", wallet);
      tx.put("payouts", current);
      const j = await tx.get("jobs", "payout_" + id);
      if (j) {
        j.gatewayId = gatewayId;
        j.status = ["paid", "failed", "reversed"].includes(current.status)
          ? "done"
          : "awaiting_webhook";
        tx.put("jobs", j);
      }
      business.audit(tx, req.user, "payout_reconciled", id);
    });
    res.json({ ok: true });
  });
  app.post("/api/reconcile/refund", async (req, res) => {
    assertRole(req.user, "owner");
    await auth.recent(req);
    const bookingId = z.string().uuid().parse(req.body.bookingId),
      refundId = z
        .string()
        .regex(/^rfnd_[A-Za-z0-9]+$/)
        .parse(req.body.refundId),
      b = await store.get("bookings", bookingId);
    if (!b) fail(404, "Booking not found.");
    const r = await gateway.refundStatus(refundId);
    if (r.payment_id !== b.paymentId || r.amount !== b.total * 100)
      fail(400, "Refund does not match this booking.");
    await store.transaction(async (tx) => {
      const latest = await tx.get("bookings", b.id);
      latest.refundId = r.id;
      latest.refund =
        latest.refund === "refunded" || r.status === "processed"
          ? "refunded"
          : r.status === "failed"
            ? "failed"
            : "processing";
      if (latest.refund === "refunded") latest.payment = "refunded";
      tx.put("bookings", latest);
      const j = await tx.get("jobs", "refund_" + b.id);
      if (j) {
        j.status = r.status === "processed" ? "done" : "awaiting_webhook";
        tx.put("jobs", j);
      }
      business.audit(tx, req.user, "refund_reconciled", b.id);
    });
    res.json({ ok: true });
  });
  app.get("/api/operations/telemetry", (req, res) => {
    assertRole(req.user, "owner");
    res.json({ ...telemetry, scope: "current-api-instance" });
  });
  app.get("/api/operations/readiness", async (req, res) => {
    assertRole(req.user, "owner");
    const company = await business.settings(store);
    const [services, pros, tickets, queue, runtime] = await Promise.all([
      store.list("services", [["active", "==", true]], 100),
      store.list("professionals", [["approved", "==", true]], 200),
      store.list("tickets", [["status", "==", "open"]], 100),
      store.list(
        "jobs",
        [["status", "in", ["needs_reconciliation", "processing"]]],
        100,
      ),
      store.get("settings", "workerHeartbeat"),
    ]);
    const checks = [
      {
        name: "Published services",
        ready:
          services.length > 0 &&
          (cfg.live ? services.every((s) => !s.sample) : true),
        detail:
          services.length + " active; review scope, prices and sample flags.",
      },
      {
        name: "Approved professionals",
        ready:
          pros.length > 0 &&
          services.every((s) =>
            pros.some(
              (p) =>
                p.skills.includes(s.id) &&
                p.available !== false &&
                p.pins?.some((pin) => company.pins.includes(pin)),
            ),
          ),
        detail:
          "Each active service needs an available professional in your service area.",
      },
      {
        name: "Business policies and support",
        ready:
          !!company.policyPublished &&
          !!company.termsUrl &&
          !!company.privacyUrl &&
          !!company.supportPhone,
        detail:
          "Publish approved terms, privacy policy and a staffed support number.",
      },
      {
        name: "HTTPS hosting",
        ready: cfg.publicUrl.startsWith("https://"),
        detail: "Use your public HTTPS API and approved origins.",
      },
      {
        name: "Payment credentials",
        ready:
          cfg.paymentMode === "razorpay" &&
          !!cfg.razorpayKeyId &&
          !!cfg.razorpayKeySecret &&
          !!cfg.webhookSecret,
        detail:
          "Also verify capture, webhook and refund with your payment provider.",
      },
      {
        name: "Background jobs",
        ready:
          !!runtime &&
          runtime.at > Date.now() - 10 * 60000 &&
          runtime.ok === true,
        detail:
          "Expiry, assignment, refunds and notification jobs need a recent successful run.",
      },
      {
        name: "Private onboarding documents",
        ready: !!firebase.bucket,
        detail:
          "Use an encrypted persistent server volume, or configured Firebase Storage.",
      },
    ];
    res.json({
      mode: cfg.mode,
      checks,
      openTickets: tickets.length,
      overdueTickets: tickets.filter(
        (t) =>
          t.awaitingResponse !== false &&
          (t.responseDueAt || t.createdAt + 4 * 3600000) < Date.now(),
      ).length,
      financialExceptions: queue.length,
      checkedAt: Date.now(),
    });
  });
  app.post("/api/operations/run", async (req, res) => {
    assertRole(req.user, "owner");
    res.json(await jobs.run());
  });
  app.delete("/api/account", async (req, res) => {
    assertRole(req.user, "customer", "professional");
    await auth.recent(req);
    await store.transaction(async (tx) => {
      const own = await tx.list(
          "bookings",
          [["customerId", "==", req.user.id]],
          1000,
        ),
        assigned = await tx.list(
          "bookings",
          [["professionalId", "==", req.user.id]],
          1000,
        ),
        bookings = [
          ...new Map([...own, ...assigned].map((b) => [b.id, b])).values(),
        ];
      if (bookings.length >= 350)
        fail(409, "Contact support to close a high-volume account.");
      if (
        bookings.some(
          (b) =>
            !["completed", "cancelled", "payment_expired"].includes(b.status) ||
            ["requested", "processing"].includes(b.refund),
        )
      )
        fail(
          409,
          "Finish active bookings and refunds before deleting your account.",
        );
      const wallet = await tx.get("wallets", req.user.id);
      if (wallet && (wallet.available > 0 || wallet.held > 0))
        fail(409, "Settle your partner balance before deleting your account.");
      const addresses = await tx.list(
          "addresses",
          [["customerId", "==", req.user.id]],
          20,
        ),
        devices = await tx.list("devices", [["userId", "==", req.user.id]], 10);
      addresses.forEach((a) => tx.remove("addresses", a.id));
      devices.forEach((d) => tx.remove("devices", d.id));
      const user = await tx.get("users", req.user.id);
      tx.put("users", {
        id: user.id,
        role: user.role,
        active: false,
        name: "Deleted account",
        deletedAt: Date.now(),
      });
      const pro = await tx.get("professionals", req.user.id);
      if (pro) {
        if (pro.documents?.length)
          tx.put("cleanup", {
            id: req.user.id,
            paths: pro.documents.map((d) => d.storagePath),
            status: "pending",
            createdAt: Date.now(),
          });
        tx.put("professionals", {
          id: pro.id,
          type: pro.type,
          name: "Former professional",
          available: false,
          approved: false,
          skills: [],
          pins: [],
          documents: [],
          deletedAt: Date.now(),
        });
      }
      for (const kind of ["notifications", "outbox"]) {
        const records = await tx.list(
          kind,
          [["userId", "==", req.user.id]],
          1000,
        );
        records.forEach((x) => tx.remove(kind, x.id));
      }
      const tickets = await tx.list(
        "tickets",
        [["customerId", "==", req.user.id]],
        1000,
      );
      const sentMessages = await tx.list(
        "messages",
        [["senderId", "==", req.user.id]],
        1000,
      );
      if (sentMessages.length >= 350)
        fail(409, "Contact support to close a high-volume messaging account.");
      sentMessages.forEach((m) =>
        tx.put("messages", {
          ...m,
          senderName: "Deleted account",
          message: "Removed after account deletion",
        }),
      );
      tx.remove("avatars", req.user.id);
      tickets.forEach((t) =>
        tx.put("tickets", {
          id: t.id,
          customerId: t.customerId,
          customerName: "Former customer",
          message: "Removed after account deletion",
          messages: [],
          status: "resolved",
          createdAt: t.createdAt,
        }),
      );
      bookings.forEach((b) =>
        tx.put("bookings", {
          ...b,
          customerName:
            b.customerId === req.user.id ? "Former customer" : b.customerName,
          address:
            b.customerId === req.user.id
              ? { line: "Removed after account deletion", pin: b.address.pin }
              : b.address,
        }),
      );
      business.audit(tx, req.user, "account_deleted", req.user.id);
    });
    if (cfg.live) {
      try {
        await firebase.auth.deleteUser(req.user.id);
      } catch {
        await store.transaction(async (tx) =>
          tx.put("identityCleanup", {
            id: req.user.id,
            status: "pending",
            createdAt: Date.now(),
          }),
        );
      }
    }
    auth.logout(req, res);
  });
  app.use("/api", (req, res) =>
    res
      .status(404)
      .json({ error: "API endpoint not found.", code: "NOT_FOUND" }),
  );
  const webRoot = path.resolve(
    process.env.WEB_DIST_DIR || path.join(baseDir, "../dist"),
  );
  if (existsSync(webRoot)) {
    app.use(express.static(webRoot));
    app.get("/{*splat}", (req, res) =>
      res.sendFile(path.join(webRoot, "index.html")),
    );
  }
  app.use((error, req, res, next) => {
    const requestId = req.requestId || randomUUID();
    if (error instanceof ZodError)
      return res.status(400).json({
        error:
          (error.issues[0]?.path.join(" → ") || "Details") +
          ": " +
          (error.issues[0]?.message || "Check the entered details."),
        code: "VALIDATION_FAILED",
        requestId,
      });
    if (error.code === "LIMIT_FILE_SIZE")
      return res.status(413).json({
        error: "The file must be 10 MB or smaller.",
        code: error.code,
        requestId,
      });
    if (error.code === 8 || error.code === "RESOURCE_EXHAUSTED")
      return res.status(503).json({
        error:
          "The Firebase database quota is exhausted. Your sign-in may be valid, but the workspace cannot load until the quota resets or the project billing limit is increased.",
        code: "DATABASE_QUOTA_EXCEEDED",
        requestId,
      });
    if (!error.status)
      console.error(
        JSON.stringify({
          level: "error",
          requestId,
          code: error.code || "INTERNAL_ERROR",
          route: req.route?.path || "unmatched",
        }),
      );
    res.status(error.status || 500).json({
      error: error.status
        ? error.message
        : "Something went wrong. Please try again.",
      code: error.code || "INTERNAL_ERROR",
      requestId,
    });
  });
  return { app, store, cfg, business, gateway, jobs };
}

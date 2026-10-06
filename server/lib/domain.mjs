import { randomUUID, createHash } from "node:crypto";
import { z } from "zod";
import {
  serviceSelection,
  selectionSchema,
  serviceDetails,
  detailsSchema,
} from "./service-selection.mjs";
import { fail, assertRole } from "./errors.mjs";
export const addressSchema = z.object({
  line: z.string().trim().min(8).max(300),
  pin: z.string().regex(/^\d{6}$/),
  label: z.string().trim().max(40).default("Home"),
});
const dayKey = (n) => new Date(n + 330 * 60000).toISOString().slice(0, 10);
const hour = (n) => new Date(n + 330 * 60000).getUTCHours();
const priority = (pros) =>
  pros.sort(
    (a, b) =>
      (a.type === "In-house" ? 0 : 1) - (b.type === "In-house" ? 0 : 1) ||
      a.id.localeCompare(b.id),
  );
export const slotFor = (date, h) =>
  Date.parse(date + "T00:00:00Z") + (h * 60 - 330) * 60000;
export const segmentKeys = (b) =>
  Array.from(
    { length: Math.ceil((b.duration + 30) / 30) },
    (_, i) => Math.floor(b.slot / 1800000) + i,
  );
export function validateSlot(slot, now = Date.now()) {
  if (
    !Number.isInteger(slot) ||
    slot < now + 3600000 ||
    slot > now + 30 * 86400000 ||
    (slot + 330 * 60000) % 3600000 !== 0 ||
    ![9, 12, 15, 18].includes(hour(slot))
  )
    fail(
      400,
      "Choose an available service time within the next 30 days.",
      "INVALID_SLOT",
    );
}
export function domain(store, cfg) {
  const roles = assertRole;
  const settings = async (tx) =>
    (await tx.get("settings", "company")) || {
      id: "company",
      pins: ["509216"],
      commissionBps: 2000,
      cancelCutoffHours: 2,
      assignmentDeadlineMinutes: 30,
      policyPublished: false,
      termsVersion: "draft",
      termsUrl: "",
      privacyUrl: "",
    };
  function audit(tx, u, action, target, detail = {}) {
    tx.put("audit", {
      id: randomUUID(),
      at: new Date().toISOString(),
      createdAt: Date.now(),
      actor: u.id,
      role: u.role,
      action,
      target,
      detail,
    });
  }
  function notify(tx, userId, title, body, bookingId) {
    const id = randomUUID();
    tx.put("notifications", {
      id,
      userId,
      title,
      body,
      bookingId,
      createdAt: Date.now(),
      read: false,
    });
    tx.put("outbox", {
      id,
      userId,
      title,
      body,
      bookingId,
      status: "pending",
      attempts: 0,
      dueAt: Date.now(),
      createdAt: Date.now(),
    });
  }
  async function booking(tx, id, u) {
    const b = await tx.get("bookings", id);
    if (!b) fail(404, "Booking not found.", "BOOKING_NOT_FOUND");
    if (
      (u.role === "customer" && b.customerId !== u.id) ||
      (u.role === "professional" && b.professionalId !== u.id)
    )
      fail(403, "You cannot access this booking.", "BOOKING_FORBIDDEN");
    return b;
  }
  async function release(tx, b) {
    if (!b.reservedProfessionalId && !b.professionalId) return;
    for (const pid of new Set(
      [b.professionalId, b.reservedProfessionalId].filter(Boolean),
    ))
      for (const segment of segmentKeys(b)) {
        const id = pid + "_" + segment;
        const lock = await tx.get("locks", id);
        if (lock?.bookingId === b.id) tx.remove("locks", id);
      }
  }
  async function releasePromo(tx, b) {
    if (b.promoCode && b.payment === "pending" && !b.promoReleased) {
      const promo = await tx.get("promotions", b.promoCode);
      if (promo) {
        promo.uses = Math.max(0, (promo.uses || 0) - 1);
        tx.put("promotions", promo);
      }
      b.promoReleased = true;
    }
  }
  async function eligible(tx, p, b) {
    if (
      !p.approved ||
      p.available === false ||
      !p.skills.includes(b.serviceId) ||
      !p.pins?.includes(b.address.pin) ||
      b.declinedProfessionalIds?.includes(p.id)
    )
      return false;
    const d = new Date(b.slot + 330 * 60000);
    if (
      p.schedule &&
      (!p.schedule.days.includes(d.getUTCDay()) ||
        !p.schedule.hours.includes(d.getUTCHours()) ||
        p.schedule.blockedDates.includes(dayKey(b.slot)))
    )
      return false;
    const locks = await Promise.all(
      segmentKeys(b).map((segment) => tx.get("locks", p.id + "_" + segment)),
    );
    return !locks.some(
      (x) => x && x.bookingId !== b.id && x.expiresAt > Date.now(),
    );
  }
  function reserve(tx, p, b, expiresAt) {
    for (const segment of segmentKeys(b))
      tx.put("locks", {
        id: p.id + "_" + segment,
        professionalId: p.id,
        bookingId: b.id,
        segment,
        expiresAt,
      });
  }
  async function assign(tx, b, pid) {
    const pros = pid
      ? [await tx.get("professionals", pid)]
      : await tx.list("professionals", [["approved", "==", true]], 200);
    for (const p of priority(pros.filter(Boolean))) {
      if (p && (await eligible(tx, p, b))) {
        reserve(tx, p, b, b.slot + (b.duration + 30) * 60000);
        b.professionalId = p.id;
        delete b.reservedProfessionalId;
        b.professionalName = p.name;
        b.professionalType = p.type;
        b.commissionBps = (await settings(tx)).commissionBps;
        b.status = "assigned";
        b.assignedAt = Date.now();
        delete b.acceptedAt;
        b.assignmentDueAt =
          Date.now() + (await settings(tx)).assignmentDeadlineMinutes * 60000;
        notify(tx, p.id, "New job request", b.serviceName, b.id);
        return true;
      }
    }
    b.status = "awaiting_assignment";
    b.assignmentDueAt =
      Date.now() + (await settings(tx)).assignmentDeadlineMinutes * 60000;
    delete b.professionalId;
    delete b.reservedProfessionalId;
    return false;
  }
  async function createBooking(u, input) {
    roles(u, "customer");
    const schema = z.object({
      serviceId: z.string().min(1).max(100),
      ...selectionSchema.shape,
      details: detailsSchema,
      instructions: z.string().trim().max(1000).default(""),
      slot: z.number().int(),
      address: addressSchema,
      idempotencyKey: z.string().min(8).max(100),
      promoCode: z.string().trim().max(30).optional(),
    });
    const v = schema.parse(input);
    validateSlot(v.slot);
    const requestHash = createHash("sha256")
      .update(JSON.stringify(v))
      .digest("hex");
    const requestId = createHash("sha256")
      .update(u.id + ":" + v.idempotencyKey)
      .digest("hex");
    return store.transaction(async (tx) => {
      const retry = await tx.get("requests", requestId);
      if (retry) {
        if (retry.hash !== requestHash)
          fail(
            409,
            "This checkout has changed. Start a new booking request.",
            "IDEMPOTENCY_CONFLICT",
          );
        return tx.get("bookings", retry.bookingId);
      }
      const company = await settings(tx);
      if (cfg.live && !company.policyPublished)
        fail(
          503,
          "Bookings will open when ANVIRA publishes its policies.",
          "POLICY_NOT_PUBLISHED",
        );
      const s = await tx.get("services", v.serviceId);
      if (!s?.active || (cfg.live && s.sample && !s.sampleReviewed))
        fail(400, "Service is unavailable.", "SERVICE_UNAVAILABLE");
      if (!company.pins.includes(v.address.pin))
        fail(
          400,
          "This address is outside our current service area.",
          "OUTSIDE_COVERAGE",
        );
      const selection = serviceSelection(s, v);
      const details = serviceDetails(s, v.details);
      const { subtotal, addons: chosen } = selection;
      let discount = 0,
        promo;
      if (v.promoCode) {
        promo = await tx.get("promotions", v.promoCode.toUpperCase());
        if (
          !promo?.active ||
          promo.expiresAt < Date.now() ||
          promo.uses >= promo.maxUses ||
          subtotal < promo.minAmount
        )
          fail(400, "This offer is not available.", "OFFER_UNAVAILABLE");
        discount = Math.min(subtotal, promo.discountAmount);
      }
      const b = {
        id: randomUUID(),
        customerId: u.id,
        customerName: u.name,
        serviceId: s.id,
        serviceName: s.name,
        duration: selection.duration,
        price: selection.price,
        packageId: selection.packageId,
        packageName: selection.packageName,
        options: selection.options,
        choices: selection.choices,
        scope: selection.scope,
        serviceChecklist: s.checklist || [],
        instructions: v.instructions,
        details,
        warranty: s.warranty || "",
        subtotal,
        discount,
        total: subtotal - discount,
        addons: chosen,
        address: v.address,
        slot: v.slot,
        status: "payment_pending",
        payment: "pending",
        createdAt: Date.now(),
        expiresAt: Date.now() + 15 * 60000,
        idempotencyKey: v.idempotencyKey,
        checklist: [],
        termsVersion: company.termsVersion,
      };
      if (b.total < 1) fail(400, "The total must be at least ₹1.");
      const pros = await tx.list(
        "professionals",
        [["approved", "==", true]],
        200,
      );
      let p;
      for (const candidate of priority(pros))
        if (await eligible(tx, candidate, b)) {
          p = candidate;
          break;
        }
      if (!p)
        fail(
          409,
          "This slot is full. Please choose another time.",
          "SLOT_FULL",
        );
      reserve(tx, p, b, b.expiresAt);
      b.reservedProfessionalId = p.id;
      if (promo) {
        promo.uses++;
        tx.put("promotions", promo);
        b.promoCode = promo.id;
      }
      tx.put("bookings", b);
      tx.put("requests", {
        id: requestId,
        bookingId: b.id,
        hash: requestHash,
        createdAt: Date.now(),
      });
      audit(tx, u, "booking_created", b.id);
      return b;
    });
  }
  async function action(u, id, input) {
    return store.transaction(async (tx) => {
      const b = await booking(tx, id, u),
        company = await settings(tx),
        { action } = input;
      switch (action) {
        case "pay":
          roles(u, "customer");
          if (cfg.paymentMode !== "demo")
            fail(
              403,
              "Live payments must be verified by the payment provider.",
              "SIMULATION_FORBIDDEN",
            );
          if (b.payment === "paid") return b;
          if (b.status !== "payment_pending" || b.expiresAt < Date.now())
            fail(
              409,
              "Payment reservation expired. Create a new booking.",
              "PAYMENT_EXPIRED",
            );
          b.payment = "paid";
          b.paymentId = "demo_payment_" + b.id;
          b.paidAt = Date.now();
          await assign(tx, b);
          notify(
            tx,
            b.customerId,
            "Payment received",
            "Your booking is being arranged.",
            b.id,
          );
          break;
        case "accept":
          roles(u, "professional");
          if (b.status !== "assigned")
            fail(
              409,
              "Job is no longer awaiting acceptance.",
              "INVALID_JOB_STATE",
            );
          b.status = "confirmed";
          b.acceptedAt = Date.now();
          break;
        case "decline":
          roles(u, "professional");
          if (b.status !== "assigned")
            fail(
              409,
              "Only an unaccepted job can be declined.",
              "INVALID_JOB_STATE",
            );
          await release(tx, b);
          b.declinedProfessionalIds = [
            ...(b.declinedProfessionalIds || []),
            u.id,
          ];
          delete b.professionalId;
          await assign(tx, b);
          break;
        case "arrive":
          roles(u, "professional");
          if (b.status !== "confirmed")
            fail(
              409,
              "Accept the job before recording arrival.",
              "INVALID_JOB_STATE",
            );
          if (cfg.live && Date.now() < b.slot - 30 * 60000)
            fail(
              409,
              "Record arrival within 30 minutes of the service slot.",
              "TOO_EARLY",
            );
          if (!b.arrivedAt) {
            b.arrivedAt = Date.now();
            notify(
              tx,
              b.customerId,
              "Your professional has arrived",
              "Please meet your professional at the service address.",
              b.id,
            );
          }
          break;
        case "start":
          roles(u, "professional");
          if (b.status !== "confirmed")
            fail(409, "Accept the job before starting.", "INVALID_JOB_STATE");
          if (cfg.live && Date.now() < b.slot - 30 * 60000)
            fail(
              409,
              "You can start within 30 minutes of the service slot.",
              "TOO_EARLY",
            );
          b.status = "in_progress";
          b.startedAt = Date.now();
          break;
        case "complete":
          roles(u, "professional");
          if (b.status !== "in_progress")
            fail(409, "Start the job before completing.", "INVALID_JOB_STATE");
          if (
            !Array.isArray(input.checklist) ||
            input.checklist.length !== 3 + (b.serviceChecklist?.length || 0) ||
            !input.checklist.every((x) => x === true)
          )
            fail(
              400,
              "Complete all service checklist items.",
              "INCOMPLETE_CHECKLIST",
            );
          b.completionNotes = z
            .string()
            .trim()
            .max(1000)
            .parse(input.completionNotes || "");
          b.checklist = input.checklist;
          b.status = "completed";
          b.completedAt = Date.now();
          await release(tx, b);
          const completedPro = await tx.get("professionals", b.professionalId);
          if (completedPro) {
            completedPro.jobs = (completedPro.jobs || 0) + 1;
            tx.put("professionals", completedPro);
          }
          if (b.professionalType === "Partner") {
            const ledgerId = "job_" + b.id;
            if (!(await tx.get("ledger", ledgerId))) {
              const commission = Math.round(
                (b.total * (b.commissionBps || 0)) / 10000,
              );
              const wallet = (await tx.get("wallets", b.professionalId)) || {
                id: b.professionalId,
                available: 0,
                held: 0,
                paid: 0,
              };
              wallet.available += b.total - commission;
              tx.put("wallets", wallet);
              tx.put("ledger", {
                id: ledgerId,
                professionalId: b.professionalId,
                bookingId: b.id,
                gross: b.total,
                commission,
                amount: b.total - commission,
                type: "credit",
                createdAt: Date.now(),
              });
            }
          }
          break;
        case "cancel":
          roles(u, "customer", "care", "owner");
          if (
            ![
              "payment_pending",
              "assigned",
              "confirmed",
              "awaiting_assignment",
              "payment_expired",
            ].includes(b.status)
          )
            fail(409, "This booking cannot be cancelled.", "CANNOT_CANCEL");
          if (
            u.role === "customer" &&
            b.slot - Date.now() < company.cancelCutoffHours * 3600000 &&
            b.payment === "paid"
          )
            fail(
              409,
              "Contact Customer Care for cancellation inside the policy cutoff.",
              "CARE_REQUIRED",
            );
          await release(tx, b);
          await releasePromo(tx, b);
          b.status = "cancelled";
          b.cancelledAt = Date.now();
          if (b.payment === "paid") b.refund = "requested";
          break;
        case "reschedule":
          roles(u, "customer", "care", "owner");
          if (
            !["assigned", "confirmed", "awaiting_assignment"].includes(b.status)
          )
            fail(
              409,
              "This booking cannot be rescheduled.",
              "CANNOT_RESCHEDULE",
            );
          if (
            u.role === "customer" &&
            b.slot - Date.now() < company.cancelCutoffHours * 3600000
          )
            fail(
              409,
              "Contact Customer Care for rescheduling inside the policy cutoff.",
              "CARE_REQUIRED",
            );
          validateSlot(input.slot);
          await release(tx, b);
          b.slot = input.slot;
          b.declinedProfessionalIds = [];
          delete b.professionalId;
          if (!(await assign(tx, b)))
            fail(
              409,
              "No professional is available for this slot.",
              "SLOT_FULL",
            );
          break;
        case "assign":
          roles(u, "care", "owner");
          if (
            !["assigned", "confirmed", "awaiting_assignment"].includes(b.status)
          )
            fail(409, "Booking is not assignable.", "CANNOT_ASSIGN");
          await release(tx, b);
          if (
            !(await assign(
              tx,
              b,
              z.string().min(1).max(100).parse(input.professionalId),
            ))
          )
            fail(
              409,
              "Professional is unavailable or not approved.",
              "PROFESSIONAL_UNAVAILABLE",
            );
          break;
        case "refund":
          roles(u, "owner");
          if (b.refund !== "requested")
            fail(409, "No refund is awaiting approval.", "NO_REFUND_REQUEST");
          b.refund = "processing";
          tx.put("jobs", {
            id: "refund_" + b.id,
            type: "refund",
            bookingId: b.id,
            status: "pending",
            attempts: 0,
            dueAt: Date.now(),
            createdAt: Date.now(),
          });
          break;
        case "review":
          roles(u, "customer");
          if (b.status !== "completed" || b.review)
            fail(
              409,
              "Only completed, unreviewed bookings can be reviewed.",
              "CANNOT_REVIEW",
            );
          b.review = z
            .object({
              rating: z.number().int().min(1).max(5),
              text: z.string().max(1000).default(""),
            })
            .parse(input);
          if (b.review.rating <= 3) {
            const ticketId = "quality_" + b.id;
            tx.put("tickets", {
              id: ticketId,
              customerId: b.customerId,
              customerName: b.customerName,
              bookingId: b.id,
              category: "quality",
              priority: "high",
              awaitingResponse: true,
              responseDueAt: Date.now() + 3600000,
              status: "open",
              message: `Service review: ${b.review.rating}/5. ${b.review.text || "Please follow up about the service experience."}`,
              createdAt: Date.now(),
              messages: [],
            });
            audit(tx, u, "quality_followup_created", ticketId);
            notify(
              tx,
              b.customerId,
              "We are listening",
              "Your service feedback has opened a support request. You can follow up in Support.",
              b.id,
            );
          }
          const pro = await tx.get("professionals", b.professionalId);
          if (pro) {
            pro.reviewTotal = (pro.reviewTotal || 0) + b.review.rating;
            pro.reviewCount = (pro.reviewCount || 0) + 1;
            pro.rating =
              Math.round((pro.reviewTotal / pro.reviewCount) * 10) / 10;
            tx.put("professionals", pro);
          }
          break;
        default:
          fail(400, "Unknown action.", "UNKNOWN_ACTION");
      }
      b.updatedAt = Date.now();
      tx.put("bookings", b);
      audit(tx, u, action, b.id);
      if (action !== "review")
        notify(
          tx,
          b.customerId,
          "Booking updated",
          b.status.replaceAll("_", " "),
          b.id,
        );
      return b;
    });
  }
  async function paymentCaptured(payment, eventId) {
    return store.transaction(async (tx) => {
      if (await tx.get("events", eventId)) return { duplicate: true };
      const candidates = await tx.list(
        "bookings",
        [["orderId", "==", payment.order_id]],
        1,
      );
      const b = candidates[0];
      if (!b)
        fail(409, "Payment order is not linked to a booking.", "UNKNOWN_ORDER");
      if (
        payment.currency !== "INR" ||
        payment.amount !== b.total * 100 ||
        payment.status !== "captured"
      )
        fail(
          400,
          "Payment details do not match the booking.",
          "PAYMENT_MISMATCH",
        );
      if (b.paymentId && b.paymentId !== payment.id)
        fail(
          409,
          "A different payment is already recorded.",
          "DUPLICATE_PAYMENT",
        );
      if (b.payment === "paid" || b.payment === "refunded") {
        tx.put("events", { id: eventId, createdAt: Date.now() });
        return b;
      }
      b.payment = "paid";
      b.paymentId = payment.id;
      b.paidAt = Date.now();
      if (["cancelled", "payment_expired"].includes(b.status)) {
        b.refund = "processing";
        b.status = "cancelled";
        tx.put("jobs", {
          id: "refund_" + b.id,
          type: "refund",
          bookingId: b.id,
          status: "pending",
          attempts: 0,
          dueAt: Date.now(),
          createdAt: Date.now(),
        });
      } else if (!(await assign(tx, b))) {
        b.status = "awaiting_assignment";
        b.assignmentDueAt =
          Date.now() + (await settings(tx)).assignmentDeadlineMinutes * 60000;
      }
      tx.put("bookings", b);
      tx.put("events", { id: eventId, createdAt: Date.now() });
      notify(
        tx,
        b.customerId,
        "Payment received",
        "Your booking is being arranged.",
        b.id,
      );
      return b;
    });
  }
  async function availability(
    u,
    serviceId,
    date,
    excludeId,
    pin,
    selection = {},
  ) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) fail(400, "Choose a valid date.");
    const existing = excludeId
      ? await store.transaction((tx) => booking(tx, excludeId, u))
      : null;
    if (existing && existing.serviceId !== serviceId)
      fail(400, "Choose the booked service when rescheduling.");
    const service = await store.get("services", serviceId);
    if (
      (!service?.active ||
        (cfg.live && service.sample && !service.sampleReviewed)) &&
      !existing
    )
      fail(400, "Service is unavailable.");
    const duration =
      existing?.duration ?? serviceSelection(service, selection).duration;
    return store.transaction(async (tx) => {
      if (excludeId) await booking(tx, excludeId, u);
      const company = await settings(tx);
      const coveragePin = pin || company.pins[0];
      if (!company.pins.includes(coveragePin))
        fail(
          400,
          "This address is outside our current service area.",
          "OUTSIDE_COVERAGE",
        );
      const pros = await tx.list(
          "professionals",
          [["approved", "==", true]],
          200,
        ),
        times = [];
      for (const h of [9, 12, 15, 18]) {
        const slot = slotFor(date, h);
        let available =
          slot > Date.now() + 3600000 && slot < Date.now() + 30 * 86400000;
        if (available) {
          available = false;
          for (const p of pros)
            if (
              await eligible(tx, p, {
                id: excludeId || "availability",
                slot,
                duration,
                serviceId,
                address: { pin: coveragePin },
              })
            ) {
              available = true;
              break;
            }
        }
        times.push({ slot, available });
      }
      return times;
    });
  }
  return {
    settings,
    audit,
    notify,
    booking,
    release,
    releasePromo,
    eligible,
    assign,
    createBooking,
    action,
    paymentCaptured,
    availability,
  };
}

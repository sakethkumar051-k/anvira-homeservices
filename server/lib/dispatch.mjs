import { approvedRoster } from "./roster.mjs";
import { randomUUID, createHash } from "node:crypto";
import { bookingCommissionBps } from "./commission.mjs";
import { assertBookingEnvironment } from "./payment-environment.mjs";
import { assertRole, fail } from "./errors.mjs";

export const officeBooking = (b) => b.dispatch?.version === 1;
export const partnersAllowed = (company, service) =>
  company.dispatchMode === "office_first" &&
  company.externalPartnersEnabled === true &&
  !!service &&
  service.partnerFulfillmentAllowed !== false;
const payable = (b) => b.payment === "paid" && !b.refund;
const openStatus = (b) =>
  ["assigned", "confirmed", "awaiting_assignment"].includes(b.status);

// Booking state is authoritative: closing a round invalidates every losing offer
// without needing an unbounded fan-out transaction.
export function dispatchOperations(store, cfg, business) {
  const { settings, eligible, reserve, release, notify, notifyStaff, audit } =
    business;
  const automatic = (company) => company.internalAssignmentMode === "automatic";
  const internalPaused = (company, b) =>
    (company.internalCoveragePauses || []).some(
      (pause) => pause.serviceId === b.serviceId && pause.pin === b.address.pin,
    );
  function progress(b, state, at = Date.now()) {
    if (!b.dispatchProgress) return;
    b.dispatchProgress.history = [
      ...(b.dispatchProgress.history || []),
      { stage: state, at },
    ].slice(-30);
  }
  function startAutomatic(b, now = Date.now()) {
    b.dispatchProgress = {
      mode: "automatic",
      startedAt: now,
      deadlineAt: now + 180000,
      round: 0,
      reason: "CHECKING_CAPACITY",
      history: [],
    };
  }
  function transition(b, state, extra = {}, at = Date.now()) {
    progress(b, state, at);
    if (state !== "offering") delete b.dispatchDueAt;
    b.dispatch = {
      version: 1,
      state,
      revision: (b.dispatch?.revision || 0) + 1,
      ...extra,
    };
  }
  function assertPaid(b) {
    assertBookingEnvironment(b, cfg);
    if (!payable(b))
      fail(
        409,
        "Only a paid booking without a refund can be dispatched.",
        "DISPATCH_UNAVAILABLE",
      );
  }
  async function candidates(tx, b, type) {
    if (type === "In-house" && internalPaused(await settings(tx), b)) return [];
    const profiles = await approvedRoster(tx, type);
    const found = [];
    for (const p of profiles
      .filter((p) => p.type === type)
      .sort((a, b) => a.id.localeCompare(b.id))) {
      if (!(await eligible(tx, p, b))) continue;
      if (type === "Partner") {
        const user = await tx.get("users", p.id);
        if (
          !user ||
          user.active === false ||
          user.role !== "professional" ||
          p.accountless
        )
          continue;
      }
      found.push(p);
    }
    return found;
  }
  async function checkoutEligible(tx, p, b, company, service) {
    if (p.type === "In-house")
      return !internalPaused(company, b) && eligible(tx, p, b);
    if (p.type !== "Partner" || !partnersAllowed(company, service))
      return false;
    const user = await tx.get("users", p.id);
    return (
      user?.role === "professional" &&
      user.active !== false &&
      !p.accountless &&
      eligible(tx, p, b)
    );
  }
  function clearAssignment(b) {
    delete b.professionalId;
    delete b.professionalName;
    delete b.professionalType;
    delete b.acceptedAt;
    delete b.assignedAt;
    delete b.arrivedAt;
    delete b.startedAt;
  }
  function holdUntil(b) {
    return b.slot + (b.duration + 30) * 60000;
  }
  async function moveHold(tx, b, p) {
    await release(tx, b);
    reserve(tx, p, b, holdUntil(b));
    b.reservedProfessionalId = p.id;
  }
  async function queuePaid(tx, b, { requireCapacity = false } = {}) {
    assertPaid(b);
    const company = await settings(tx),
      service = await tx.get("services", b.serviceId);
    const internal = await candidates(tx, b, "In-house");
    if (automatic(company)) {
      clearAssignment(b);
      b.status = "awaiting_assignment";
      startAutomatic(b);
      tx.put("dispatchRouting", { id: b.id, invitedIds: [] });
      if (internal.length) {
        const chosen =
          internal.find((p) => p.id === b.reservedProfessionalId) ||
          internal[0];
        await assignInternal(tx, b, chosen, {
          id: "dispatch-automation",
          role: "system",
        });
        b.dispatchProgress.reason = "INTERNAL_ASSIGNED";
        audit(
          tx,
          { id: "dispatch-automation", role: "system" },
          "automatic_internal_assignment",
          b.id,
        );
        notify(
          tx,
          b.customerId,
          "ANVIRA team assigned",
          "Your service team has been assigned for the selected time.",
          b.id,
        );
        return;
      }
    }
    let hold =
      internal.find((p) => p.id === b.reservedProfessionalId) || internal[0];
    if (!hold && partnersAllowed(company, service)) {
      const partners = await candidates(tx, b, "Partner");
      hold =
        partners.find((p) => p.id === b.reservedProfessionalId) || partners[0];
    }
    if (!hold && requireCapacity)
      fail(409, "No worker is available for this slot.", "SLOT_FULL");
    if (hold) await moveHold(tx, b, hold);
    else if (b.reservedProfessionalId) {
      // A payment can arrive after availability changes. Retain its real hold
      // while staff resolve it rather than freeing capacity behind a paid order.
      const ownedLocks = await tx.list("locks", [["bookingId", "==", b.id]]);
      for (const lock of ownedLocks)
        tx.put("locks", { ...lock, expiresAt: holdUntil(b) });
    }
    clearAssignment(b);
    b.status = "awaiting_assignment";
    b.assignmentDueAt = Date.now() + company.assignmentDeadlineMinutes * 60000;
    if (internal.length) transition(b, "awaiting_staff");
    else if (partnersAllowed(company, service))
      progress(b, "checking_partners");
    else transition(b, "attention");
    if (b.dispatchProgress)
      b.dispatchProgress.reason = partnersAllowed(company, service)
        ? "CHECKING_PARTNERS"
        : "PARTNER_FALLBACK_DISABLED";
    if (!internal.length && partnersAllowed(company, service))
      await openOffers(tx, b, false);
    else if (!internal.length && b.dispatchProgress) delete b.assignmentDueAt;
  }
  async function openOffers(tx, b, strict = true, now = Date.now()) {
    assertPaid(b);
    if (!officeBooking(b) || !openStatus(b) || b.professionalId)
      fail(
        409,
        "This booking cannot receive partner offers.",
        "DISPATCH_UNAVAILABLE",
      );
    const company = await settings(tx),
      service = await tx.get("services", b.serviceId);
    if (
      automatic(company) &&
      strict &&
      (!b.dispatchProgress ||
        b.dispatchProgress.deadlineAt <= now ||
        b.dispatchProgress.round >= 2)
    ) {
      startAutomatic(b, now);
      tx.put("dispatchRouting", { id: b.id, invitedIds: [] });
    }
    const auto = automatic(company) && b.dispatchProgress?.mode === "automatic";
    const stop = (reason) => {
      transition(b, "attention", {}, now);
      if (b.dispatchProgress) b.dispatchProgress.reason = reason;
      delete b.assignmentDueAt;
    };
    if (
      auto &&
      (now >= b.dispatchProgress.deadlineAt || b.dispatchProgress.round >= 2)
    ) {
      stop("NO_PARTNER_ACCEPTED");
      await notifyStaff(tx, b, "Dispatch needs office attention");
      return false;
    }
    if (!partnersAllowed(company, service)) {
      if (strict)
        fail(
          409,
          "External partner fulfilment is disabled.",
          "PARTNER_DISPATCH_DISABLED",
        );
      if (auto) stop("PARTNER_FALLBACK_DISABLED");
      return false;
    }
    if ((await candidates(tx, b, "In-house")).length) {
      if (strict)
        fail(
          409,
          "An internal worker is available. Assign the office team.",
          "INTERNAL_CAPACITY_AVAILABLE",
        );
      return false;
    }
    const routing = auto ? await tx.get("dispatchRouting", b.id) : null;
    const invitedIds = routing?.invitedIds || [];
    const partners = (await candidates(tx, b, "Partner")).filter(
      (p) => !auto || !invitedIds.includes(p.id),
    );
    if (!partners.length) {
      stop(
        auto && invitedIds.length
          ? "NO_PARTNER_ACCEPTED"
          : "NO_ELIGIBLE_PARTNERS",
      );
      await notifyStaff(tx, b, "Dispatch needs office attention");
      return false;
    }
    const roundId = randomUUID(),
      expiresAt = auto
        ? Math.min(
            now + Math.min(company.partnerOfferSeconds || 90, 90) * 1000,
            b.dispatchProgress.deadlineAt,
          )
        : now + (company.partnerOfferSeconds || 120) * 1000;
    transition(b, "offering", { roundId, expiresAt }, now);
    if (auto) {
      b.dispatchProgress.round++;
      b.dispatchProgress.reason = "WAITING_FOR_PARTNER";
    }
    b.assignmentDueAt = expiresAt;
    if (auto) b.dispatchDueAt = expiresAt;
    // Each round has at most 150 offer/notification/outbox writes, leaving room
    // for staff/payment records. A fresh round seed avoids always inviting the
    // first roster IDs when more than 50 partners qualify.
    const recipients = partners
      .map((p) => ({
        p,
        rank: createHash("sha256")
          .update(roundId + ":" + p.id)
          .digest("hex"),
      }))
      .sort((a, b) => a.rank.localeCompare(b.rank))
      .slice(0, auto ? 5 : 50);
    if (auto)
      tx.put("dispatchRouting", {
        id: b.id,
        invitedIds: [...invitedIds, ...recipients.map(({ p }) => p.id)],
      });
    for (const { p } of recipients) {
      const id = `${b.id}_${roundId}_${p.id}`;
      tx.put("dispatchOffers", {
        id,
        bookingId: b.id,
        professionalId: p.id,
        roundId,
        status: "pending",
        expiresAt,
        createdAt: now,
        companyRevision: company.partnerDispatchRevision || 0,
        serviceRevision: service.partnerFulfillmentRevision || 0,
      });
      notify(
        tx,
        p.id,
        "New partner job offer",
        "Open ANVIRA to review the service and earnings.",
        b.id,
        { kind: "partner_offer", offerId: id, roundId, expiresAt },
      );
    }
    return true;
  }
  async function assignInternal(tx, b, p, u) {
    assertPaid(b);
    if (!openStatus(b) || b.arrivedAt || b.startedAt)
      fail(
        409,
        "Booking is not assignable after team arrival or service start.",
        "CANNOT_ASSIGN",
      );
    if (internalPaused(await settings(tx), b))
      fail(
        409,
        "ANVIRA handling is paused for this service and area. Resume it in dispatch settings before assigning.",
        "INTERNAL_CAPACITY_PAUSED",
      );
    if (!p || p.type !== "In-house" || !(await eligible(tx, p, b)))
      fail(409, "Internal worker is unavailable.", "PROFESSIONAL_UNAVAILABLE");
    await moveHold(tx, b, p);
    clearAssignment(b);
    delete b.reservedProfessionalId;
    b.professionalId = p.id;
    b.professionalName = p.name;
    b.professionalType = "In-house";
    b.commissionBps = 0;
    b.status = "confirmed";
    b.assignedAt = Date.now();
    transition(b, "assigned", { assignedBy: u.id });
    delete b.assignmentDueAt;
    if (b.dispatchProgress) b.dispatchProgress.reason = "INTERNAL_ASSIGNED";
  }
  async function dispatchInternal(tx, b, u) {
    assertPaid(b);
    if (
      !officeBooking(b) ||
      b.professionalType !== "In-house" ||
      b.status !== "confirmed" ||
      !["assigned", "dispatched"].includes(b.dispatch.state)
    )
      fail(
        409,
        "Assign an internal worker before dispatch.",
        "INVALID_JOB_STATE",
      );
    if (b.dispatch.state !== "dispatched")
      transition(b, "dispatched", {
        assignedBy: b.dispatch.assignedBy,
        dispatchedBy: u.id,
        dispatchedAt: Date.now(),
      });
  }
  async function currentOffer(tx, offer, now = Date.now()) {
    if (!offer || offer.status !== "pending" || offer.expiresAt <= now)
      return null;
    const b = await tx.get("bookings", offer.bookingId);
    if (
      !b ||
      !officeBooking(b) ||
      b.dispatch.state !== "offering" ||
      b.dispatch.roundId !== offer.roundId ||
      b.dispatch.expiresAt !== offer.expiresAt ||
      b.dispatch.expiresAt <= now ||
      !payable(b) ||
      b.status !== "awaiting_assignment" ||
      b.professionalId
    )
      return null;
    try {
      assertBookingEnvironment(b, cfg);
    } catch {
      return null;
    }
    const company = await settings(tx),
      service = await tx.get("services", b.serviceId);
    if (!partnersAllowed(company, service)) return null;
    if (
      offer.companyRevision !== (company.partnerDispatchRevision || 0) ||
      offer.serviceRevision !== (service.partnerFulfillmentRevision || 0)
    )
      return null;
    if ((await candidates(tx, b, "In-house")).length) return null;
    const p = await tx.get("professionals", offer.professionalId),
      user = await tx.get("users", offer.professionalId);
    if (
      !p ||
      p.type !== "Partner" ||
      p.accountless ||
      user?.role !== "professional" ||
      user.active === false ||
      !(await eligible(tx, p, b))
    )
      return null;
    return { b, p, company };
  }
  async function isPartnerOfferCurrent(tx, item, now = Date.now()) {
    const offer = await tx.get("dispatchOffers", item.offerId);
    if (
      !offer ||
      offer.professionalId !== item.userId ||
      offer.roundId !== item.roundId ||
      offer.bookingId !== item.bookingId ||
      item.expiresAt !== offer.expiresAt ||
      item.expiresAt <= now
    )
      return false;
    return !!(await currentOffer(tx, offer, now));
  }
  function offerDTO(offer, b, company) {
    const rate = bookingCommissionBps(b, "Partner", company.commissionBps),
      commission = Math.round((b.total * rate) / 10000);
    return {
      id: offer.id,
      bookingId: b.id,
      roundId: offer.roundId,
      serviceName: b.serviceName,
      scope: b.scope || [],
      slot: b.slot,
      duration: b.duration,
      pin: b.address.pin,
      expiresAt: offer.expiresAt,
      gross: b.total,
      commission,
      net: b.total - commission,
    };
  }
  async function partnerOffers(u) {
    assertRole(u, "professional");
    return store.transaction(async (tx) => {
      const offers = await tx.list(
        "dispatchOffers",
        [
          ["professionalId", "==", u.id],
          ["status", "==", "pending"],
          ["expiresAt", ">", Date.now()],
        ],
        100,
        {
          order: [
            ["expiresAt", "asc"],
            ["id", "asc"],
          ],
        },
      );
      const visible = [];
      for (const offer of offers) {
        const current = await currentOffer(tx, offer);
        if (current) visible.push(offerDTO(offer, current.b, current.company));
      }
      return { offers: visible };
    });
  }
  async function ownedOffer(tx, u, id) {
    const offer = await tx.get("dispatchOffers", id);
    if (!offer || offer.professionalId !== u.id)
      fail(409, "This offer is no longer available.", "OFFER_UNAVAILABLE");
    return offer;
  }
  async function acceptPartnerOffer(u, id) {
    assertRole(u, "professional");
    return store.transaction(async (tx) => {
      const offer = await ownedOffer(tx, u, id);
      const existing = await tx.get("bookings", offer.bookingId);
      if (
        offer.status === "accepted" &&
        existing?.professionalId === u.id &&
        existing.dispatch?.state === "claimed" &&
        existing.dispatch.roundId === offer.roundId &&
        payable(existing) &&
        ["confirmed", "in_progress", "completed"].includes(existing.status)
      )
        return existing;
      const current = await currentOffer(tx, offer);
      if (!current)
        fail(
          409,
          "This offer has expired or is no longer available. Refresh your offers.",
          "OFFER_UNAVAILABLE",
        );
      const { b, p, company } = current;
      await moveHold(tx, b, p);
      delete b.reservedProfessionalId;
      b.professionalId = p.id;
      b.professionalName = p.name;
      b.professionalType = "Partner";
      b.commissionBps = bookingCommissionBps(
        b,
        "Partner",
        company.commissionBps,
      );
      b.status = "confirmed";
      b.assignedAt = b.acceptedAt = b.updatedAt = Date.now();
      transition(b, "claimed", { roundId: offer.roundId });
      if (b.dispatchProgress) b.dispatchProgress.reason = "PARTNER_ACCEPTED";
      delete b.assignmentDueAt;
      tx.put("bookings", b);
      tx.put("dispatchOffers", {
        ...offer,
        status: "accepted",
        acceptedAt: Date.now(),
      });
      audit(tx, u, "partner_offer_accepted", b.id, {
        offerId: offer.id,
        roundId: offer.roundId,
      });
      notify(
        tx,
        b.customerId,
        "Professional assigned",
        "Your booking has been confirmed.",
        b.id,
      );
      await notifyStaff(tx, b, "Partner accepted booking");
      return b;
    });
  }
  async function declinePartnerOffer(u, id) {
    assertRole(u, "professional");
    return store.transaction(async (tx) => {
      const offer = await ownedOffer(tx, u, id);
      if (offer.status === "declined") return { ok: true };
      if (!(await currentOffer(tx, offer)))
        fail(409, "This offer is no longer available.", "OFFER_UNAVAILABLE");
      tx.put("dispatchOffers", {
        ...offer,
        status: "declined",
        declinedAt: Date.now(),
      });
      audit(tx, u, "partner_offer_declined", offer.bookingId, {
        offerId: offer.id,
      });
      return { ok: true };
    });
  }
  async function attention(tx, b, now) {
    if (
      !officeBooking(b) ||
      !["awaiting_staff", "offering"].includes(b.dispatch.state)
    )
      return false;
    const due =
      b.dispatch.state === "offering"
        ? b.dispatch.expiresAt
        : b.assignmentDueAt;
    if (!due || due > now) return false;
    const company = await settings(tx);
    if (automatic(company) && b.dispatchProgress?.mode === "automatic") {
      const internal = await candidates(tx, b, "In-house");
      if (internal.length && now < b.dispatchProgress.deadlineAt) {
        await assignInternal(tx, b, internal[0], {
          id: "dispatch-automation",
          role: "system",
        });
        audit(
          tx,
          { id: "dispatch-automation", role: "system" },
          "automatic_internal_assignment",
          b.id,
        );
        notify(
          tx,
          b.customerId,
          "ANVIRA team assigned",
          "Your service team has been assigned for the selected time.",
          b.id,
        );
      } else await openOffers(tx, b, false, now);
      b.updatedAt = now;
      tx.put("bookings", b);
      return true;
    }
    transition(b, "attention");
    delete b.assignmentDueAt;
    b.updatedAt = now;
    tx.put("bookings", b);
    await notifyStaff(tx, b, "Dispatch needs office attention");
    return true;
  }
  return {
    checkoutEligible,
    queuePaid,
    openOffers,
    assignInternal,
    dispatchInternal,
    transition,
    assertPaid,
    attention,
    partnerOffers,
    acceptPartnerOffer,
    declinePartnerOffer,
    isPartnerOfferCurrent,
  };
}

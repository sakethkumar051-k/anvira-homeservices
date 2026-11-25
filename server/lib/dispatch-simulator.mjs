import { randomUUID } from "node:crypto";
import { createSQLiteStore } from "./store.mjs";
import { seedDemo, demoUsers } from "./seed.mjs";
import { domain, slotFor } from "./domain.mjs";
import { config } from "./config.mjs";
import { workers } from "./workers.mjs";

// Deliberately accepts no store, gateway or transport from the caller.
// Every scenario gets its own memory database and demo-only domain instance.
export async function simulateDispatch({ scenario, service } = {}) {
  const store = await createSQLiteStore(":memory:");
  try {
    await seedDemo(store);
    const serviceId = "sim-service";
    await store.transaction(async (tx) => {
      const base = await tx.get("services", "cleaning");
      tx.put("services", {
        ...base,
        id: serviceId,
        name: service?.name || "SAMPLE electrical service",
        bookingMode: "instant",
        billingPeriod: "one_time",
        packages: [],
        packageRequired: false,
        addons: [],
        optionGroups: [],
        bookingFields: [],
        coveragePins: ["509216"],
        price: 850,
        duration: 60,
        partnerFulfillmentAllowed: true,
        active: true,
      });
      const company = await tx.get("settings", "company");
      tx.put("settings", {
        ...company,
        dispatchMode: "office_first",
        internalAssignmentMode: "automatic",
        internalCoveragePauses: [],
        externalPartnersEnabled: true,
        partnerOfferSeconds: 90,
      });
      for (const p of await tx.list("professionals"))
        tx.put("professionals", { ...p, available: false });
      const internal = await tx.get("professionals", "pro-1"),
        partner = await tx.get("professionals", "pro-2");
      tx.put("professionals", {
        ...internal,
        id: "sim-internal",
        name: "SAMPLE ANVIRA electrician",
        skills: [serviceId],
        pins: ["509216"],
        schedule: undefined,
        available: scenario === "internal",
        accountless: true,
      });
      for (let i = 1; i <= 12; i++) {
        const id = "sim-partner-" + String(i).padStart(2, "0");
        tx.put("professionals", {
          ...partner,
          id,
          name: "SAMPLE outside electrician " + i,
          skills: [serviceId],
          pins: ["509216"],
          schedule: undefined,
          active: true,
          available: true,
          accountless: false,
        });
        tx.put("users", {
          id,
          name: "SAMPLE outside electrician " + i,
          role: "professional",
          active: true,
        });
      }
    });
    const cfg = config({ APP_MODE: "demo", PAYMENT_MODE: "demo" }),
      business = domain(store, cfg),
      jobs = workers(store, business, {}, cfg);
    const slot = slotFor(
      new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10),
      12,
    );
    const booking = await business.createBooking(demoUsers.customer, {
      serviceId,
      slot,
      address: { line: "SAMPLE simulation address", pin: "509216" },
      idempotencyKey: randomUUID(),
    });
    if (scenario === "busy")
      await store.transaction(async (tx) => {
        for (const p of await tx.list("professionals"))
          tx.put("professionals", { ...p, available: false });
      });
    let b = await business.action(demoUsers.customer, booking.id, {
      action: "pay",
    });
    let acceptedCount = 0;
    if (scenario === "external" || scenario === "race") {
      const offers = await store.list("dispatchOffers");
      const selected =
        scenario === "race" ? offers.slice(0, 2) : offers.slice(0, 1);
      const outcomes = await Promise.allSettled(
        selected.map((o) =>
          business.acceptPartnerOffer(
            { id: o.professionalId, role: "professional" },
            o.id,
          ),
        ),
      );
      acceptedCount = outcomes.filter((o) => o.status === "fulfilled").length;
    }
    if (scenario === "timeout") {
      await jobs.maintenance(b.dispatch.expiresAt + 1);
      b = await store.get("bookings", b.id);
      await jobs.maintenance(b.dispatchProgress.deadlineAt + 1);
    }
    let pushAttempts = 0,
      retryQueued = false;
    if (scenario === "notification_failure") {
      const offers = await store.list("dispatchOffers");
      await store.transaction(async (tx) => {
        for (const offer of offers)
          tx.put("devices", {
            id: "sim-device-" + offer.professionalId,
            userId: offer.professionalId,
            active: true,
            token: "ExpoPushToken[simulation]",
          });
      });
      const isolatedTransport = async () => {
        pushAttempts++;
        throw new Error("SIMULATED_PUSH_FAILURE");
      };
      const pushWorker = workers(
        store,
        business,
        {},
        { ...cfg, live: true },
        {},
        undefined,
        isolatedTransport,
      );
      await pushWorker.push();
      retryQueued = (await store.list("outbox")).some(
        (item) =>
          item.kind === "partner_offer" &&
          item.status === "pending" &&
          item.attempts > 0,
      );
    }
    b = await store.get("bookings", b.id);
    const offers = await store.list("dispatchOffers");
    return {
      pushAttempts,
      retryQueued,
      simulation: true,
      realNotificationsSent: 0,
      scenario,
      state: b.dispatch.state,
      reason: b.dispatchProgress?.reason,
      round: b.dispatchProgress?.round || 0,
      acceptedCount,
      delivery:
        scenario === "notification_failure"
          ? "failed_simulated"
          : "in_app_simulated",
      history: b.dispatchProgress?.history || [],
      offers: offers.map((o) => ({
        professional: o.professionalId.replace(
          "sim-partner-",
          "SAMPLE outside professional ",
        ),
        status:
          o.status === "accepted"
            ? "accepted"
            : b.dispatch.state === "claimed"
              ? "closed"
              : o.expiresAt <= b.dispatchProgress?.deadlineAt &&
                  b.dispatch.state === "attention"
                ? "expired"
                : o.roundId !== b.dispatch.roundId
                  ? "expired"
                  : o.status,
        round: o.roundId === b.dispatch.roundId ? b.dispatchProgress?.round : 1,
      })),
      notificationPreview: {
        title: "New partner job offer",
        body: "Open ANVIRA to review the service and earnings.",
      },
    };
  } finally {
    await store.close();
  }
}

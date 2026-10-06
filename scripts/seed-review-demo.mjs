import path from "node:path";
import { fileURLToPath } from "node:url";
import { createSQLiteStore } from "../server/lib/store.mjs";
import { sampleServices } from "../server/lib/sample-catalog.mjs";
import { seedDemo, demoUsers } from "../server/lib/seed.mjs";
import { domain, slotFor } from "../server/lib/domain.mjs";
import { config } from "../server/lib/config.mjs";

// Always target the local review database. No environment credentials are read.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const store = await createSQLiteStore(
  path.join(root, "server/review-demo.sqlite"),
);
try {
  await seedDemo(store);
  if (!(await store.get("settings", "reviewSeed"))) {
    const business = domain(
      store,
      config({ APP_MODE: "demo", PAYMENT_MODE: "demo" }),
    );
    const day = new Date(Date.now() + 86400000 + 330 * 60000)
      .toISOString()
      .slice(0, 10);
    const booking = await business.createBooking(demoUsers.customer, {
      serviceId: "cleaning",
      addons: [],
      slot: slotFor(day, 12),
      address: { line: "12 Garden Street, Shadnagar", pin: "509216" },
      idempotencyKey: "review-first-booking-" + day,
    });
    await business.action(demoUsers.customer, booking.id, { action: "pay" });
    const assigned = await store.get("bookings", booking.id);
    const professional = await store.get("users", assigned.professionalId);
    if (professional)
      await business.action(professional, booking.id, { action: "accept" });
    await store.transaction(async (tx) => {
      tx.put("addresses", {
        id: "review-home",
        customerId: "customer-1",
        label: "Home",
        line: "12 Garden Street, Shadnagar",
        pin: "509216",
      });
      tx.put("settings", {
        id: "reviewSeed",
        createdAt: Date.now(),
        bookingId: booking.id,
      });
    });
    console.log(
      "Local review prepared with a sample upcoming cleaning booking.",
    );
  }
  if (!(await store.get("settings", "reviewFeaturesV2"))) {
    await store.transaction(async (tx) => {
      const cleaning = await tx.get("services", "cleaning");
      tx.put("services", {
        ...cleaning,
        packages: [
          {
            id: "kitchen-care",
            name: "Kitchen focus",
            description: "Sample package for a kitchen that needs extra care.",
            price: 1299,
            duration: 120,
            includes: [
              "Kitchen surface cleaning",
              "Cabinet exterior cleaning",
              "Post-service cleanup",
            ],
          },
          {
            id: "premium-home",
            name: "Premium home care",
            description:
              "Sample extended home service with a detailed walkthrough.",
            price: 2499,
            duration: 210,
            includes: [
              "Whole-home surface cleaning",
              "Kitchen and bathroom detail",
              "Customer walkthrough",
            ],
          },
        ],
        optionGroups: [
          {
            id: "focus",
            name: "Extra focus area",
            required: false,
            options: [
              { id: "balcony", name: "Balcony care", price: 299, duration: 30 },
              {
                id: "windows",
                name: "Window surfaces",
                price: 399,
                duration: 30,
              },
            ],
          },
        ],
        preparation: [
          "Keep valuables safely stored before the professional arrives.",
          "Please provide access to water and electricity.",
        ],
        warranty:
          "Sample terms only: contact ANVIRA support to discuss any concern after the service. Live terms must be approved by the business.",
        checklist: ["Nearby furniture protected", "Cleaned surfaces inspected"],
        faqs: [
          {
            question: "What should I prepare?",
            answer:
              "Keep access clear and store valuables safely. Water and electricity are needed for this sample service.",
          },
          {
            question: "Are materials included?",
            answer:
              "Standard supplies are included. Major repairs and specialist materials are outside this sample scope.",
          },
        ],
      });
      const p = await tx.get("professionals", "pro-1");
      if (p)
        tx.put("professionals", {
          ...p,
          bio: "Sample professional profile: home cleaning with careful preparation and clear communication.",
          languages: ["Telugu", "English"],
        });
      const marker = await tx.get("settings", "reviewSeed");
      const b = marker ? await tx.get("bookings", marker.bookingId) : null;
      if (b && b.status === "confirmed")
        tx.put("bookings", {
          ...b,
          instructions:
            "Sample customer instruction: ring the side gate and protect the furniture.",
          scope: cleaning.includes,
          serviceChecklist: [
            "Nearby furniture protected",
            "Cleaned surfaces inspected",
          ],
          checklist: [],
        });
      tx.put("settings", { id: "reviewFeaturesV2", createdAt: Date.now() });
    });
    console.log(
      "Local sample service packages and professional profile prepared.",
    );
  }
  if (!(await store.get("settings", "reviewCatalogV3"))) {
    await store.transaction(async (tx) => {
      for (const service of sampleServices) tx.put("services", service);
      const pro = await tx.get("professionals", "pro-1");
      tx.put("professionals", {
        ...pro,
        skills: sampleServices.map((s) => s.id),
        experienceYears: 6,
        languages: ["Telugu", "English"],
        bio: "Fictional demo professional: cleaning, car care and household maintenance.",
      });
      tx.put("addresses", {
        id: "review-office",
        customerId: "customer-1",
        label: "Office",
        line: "Demo office, 24 Market Road, Shadnagar",
        pin: "509216",
      });
      tx.put("promotions", {
        id: "DEMO100",
        discountAmount: 100,
        minAmount: 499,
        maxUses: 100,
        uses: 0,
        active: true,
        expiresAt: Date.now() + 30 * 86400000,
      });
      tx.put("settings", { id: "reviewCatalogV3", createdAt: Date.now() });
    });
    console.log(
      "Ten detailed sample services, customer questions and a demo offer prepared.",
    );
  }
  if (!(await store.get("settings", "reviewJourneyV3"))) {
    const business = domain(
      store,
      config({ APP_MODE: "demo", PAYMENT_MODE: "demo" }),
    );
    const create = async (serviceId, offset, extras = {}) => {
      const day = new Date(Date.now() + offset * 86400000 + 330 * 60000)
        .toISOString()
        .slice(0, 10);
      return business.createBooking(demoUsers.customer, {
        serviceId,
        addons: [],
        slot: slotFor(day, 9),
        address: { line: "12 Garden Street, Shadnagar", pin: "509216" },
        idempotencyKey: "journey-v3-" + serviceId,
        ...extras,
      });
    };
    const car = await create("car-cleaning", 2, {
      packageId: "inside-out",
      options: { "vehicle-size": "hatchback", water: "tap" },
      details: {
        vehicle: "Maruti Swift (sample)",
        parking: "Garden Street, shaded driveway",
      },
      instructions: "Sample instruction: please ring the gate bell.",
    });
    await business.action(demoUsers.customer, car.id, { action: "pay" });
    await business.action(demoUsers.professional, car.id, { action: "accept" });
    const sofa = await create("sofa", 3, {
      options: { seats: "three" },
      details: { fabric: "Polyester fabric (sample)" },
    });
    await business.action(demoUsers.customer, sofa.id, { action: "pay" });
    await business.action(demoUsers.professional, sofa.id, {
      action: "accept",
    });
    await business.action(demoUsers.professional, sofa.id, { action: "start" });
    await business.action(demoUsers.professional, sofa.id, {
      action: "complete",
      checklist: Array(5).fill(true),
      completionNotes:
        "Demo handover: fabric cleaned. Allow 4–8 hours to dry with ventilation.",
    });
    await business.action(demoUsers.customer, sofa.id, {
      action: "review",
      rating: 5,
      text: "Sample review: clear instructions and a careful clean.",
    });
    const cancelled = await create("ac", 4);
    await business.action(demoUsers.customer, cancelled.id, { action: "pay" });
    await business.action(demoUsers.customer, cancelled.id, {
      action: "cancel",
    });
    await store.transaction(async (tx) => {
      // Move completed demonstration timestamps into the past for meaningful reports.
      const b = await tx.get("bookings", sofa.id),
        past = Date.now() - 86400000;
      tx.put("bookings", {
        ...b,
        slot: past - 2 * 3600000,
        createdAt: past - 86400000,
        paidAt: past - 86400000,
        startedAt: past - 3600000,
        completedAt: past,
      });
      tx.put("messages", {
        id: "demo-car-message",
        bookingId: car.id,
        customerId: "customer-1",
        professionalId: "pro-1",
        senderId: "pro-1",
        senderName: "Ravi Kumar",
        message:
          "Demo message: I will bring the cleaning supplies. Please keep the parking space accessible.",
        createdAt: Date.now(),
        expiresAt: Date.now() + 30 * 86400000,
      });
      tx.put("tickets", {
        id: "demo-support-quality",
        customerId: "customer-1",
        customerName: "Ananya",
        bookingId: sofa.id,
        category: "quality",
        priority: "high",
        message: "Demo request: please explain the sofa drying instructions.",
        status: "open",
        createdAt: Date.now() - 2 * 3600000,
        responseDueAt: Date.now() - 3600000,
        messages: [
          {
            message:
              "Sample support reply: keep the room ventilated and allow the fabric to dry fully. We can review any remaining concern.",
            sender: "ANVIRA Support",
            role: "care",
            at: Date.now() - 3600000,
          },
        ],
      });
      tx.put("settings", {
        id: "reviewJourneyV3",
        createdAt: Date.now(),
        carBookingId: car.id,
        completedBookingId: sofa.id,
        refundBookingId: cancelled.id,
      });
    });
    console.log(
      "Demo customer journey prepared: confirmed car clean, completed sofa service, support and refund request.",
    );
  }
  if (!(await store.get("settings", "reviewPartnerV4"))) {
    const business = domain(
      store,
      config({ APP_MODE: "demo", PAYMENT_MODE: "demo" }),
    );
    const partner = { id: "pro-2", name: "Suresh Reddy", role: "professional" };
    await store.transaction(async (tx) =>
      tx.put("users", { ...partner, active: true }),
    );
    const day = new Date(Date.now() + 5 * 86400000 + 330 * 60000)
      .toISOString()
      .slice(0, 10);
    const b = await business.createBooking(demoUsers.customer, {
      serviceId: "cleaning",
      packageId: "kitchen-care",
      addons: [],
      slot: slotFor(day, 9),
      address: { line: "24 Market Road, Shadnagar", pin: "509216" },
      idempotencyKey: "review-partner-v4-kitchen",
    });
    await business.action(demoUsers.customer, b.id, { action: "pay" });
    await business.action(demoUsers.owner, b.id, {
      action: "assign",
      professionalId: partner.id,
    });
    await business.action(partner, b.id, { action: "accept" });
    await business.action(partner, b.id, { action: "start" });
    await business.action(partner, b.id, {
      action: "complete",
      checklist: Array(5).fill(true),
      completionNotes:
        "Sample handover: kitchen surfaces cleaned and inspected with the customer.",
    });
    await store.transaction(async (tx) => {
      const booking = await tx.get("bookings", b.id),
        ledger = await tx.get("ledger", "job_" + b.id),
        past = Date.now() - 2 * 86400000;
      tx.put("bookings", {
        ...booking,
        slot: past - 3600000,
        createdAt: past - 86400000,
        paidAt: past - 86400000,
        completedAt: past,
      });
      tx.put("ledger", { ...ledger, createdAt: past });
      tx.put("settings", {
        id: "reviewPartnerV4",
        bookingId: b.id,
        createdAt: Date.now(),
      });
    });
    console.log(
      "Sample partner earnings, commission and completed kitchen job prepared.",
    );
  }
  if (!(await store.get("settings", "reviewTimelinesV5"))) {
    await store.transaction(async (tx) => {
      const journey = await tx.get("settings", "reviewJourneyV3"),
        partner = await tx.get("settings", "reviewPartnerV4");
      for (const id of [journey?.completedBookingId, partner?.bookingId].filter(
        Boolean,
      )) {
        const b = await tx.get("bookings", id);
        if (b?.status === "completed" && b.startedAt > b.completedAt)
          tx.put("bookings", {
            ...b,
            paidAt: b.createdAt + 60000,
            assignedAt: b.createdAt + 120000,
            acceptedAt: b.createdAt + 180000,
            arrivedAt: b.slot - 5 * 60000,
            startedAt: b.slot,
          });
      }
      tx.put("settings", { id: "reviewTimelinesV5", createdAt: Date.now() });
    });
  }
  const professionalReview = await store.get("settings", "professionalReview");
  const previous = professionalReview
    ? await store.get("bookings", professionalReview.bookingId)
    : null;
  if (
    !previous ||
    ["cancelled", "completed", "payment_expired"].includes(previous.status)
  ) {
    const business = domain(
      store,
      config({ APP_MODE: "demo", PAYMENT_MODE: "demo" }),
    );
    const day = new Date(Date.now() + 86400000 + 330 * 60000)
      .toISOString()
      .slice(0, 10);
    const b = await business.createBooking(demoUsers.customer, {
      serviceId: "cleaning",
      addons: [],
      slot: slotFor(day, 12),
      address: { line: "12 Garden Street, Shadnagar", pin: "509216" },
      instructions:
        "Sample customer instruction: ring the side gate and protect the furniture.",
      idempotencyKey:
        "professional-review-" +
        day +
        "-" +
        (professionalReview?.bookingId || "first"),
    });
    await business.action(demoUsers.customer, b.id, { action: "pay" });
    const paid = await store.get("bookings", b.id);
    const assigned = await store.get("users", paid.professionalId);
    if (assigned) await business.action(assigned, b.id, { action: "accept" });
    await store.transaction(async (tx) =>
      tx.put("settings", {
        id: "professionalReview",
        bookingId: b.id,
        createdAt: Date.now(),
      }),
    );
    console.log("A sample professional job is ready for review.");
  }
} finally {
  store.close();
}

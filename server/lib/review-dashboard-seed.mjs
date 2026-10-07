import { domain, slotFor } from "./domain.mjs";
import { config } from "./config.mjs";
import { demoUsers } from "./seed.mjs";
import { createGateway } from "./gateway.mjs";
import { payoutOperations } from "./payouts.mjs";

// Called only by the local SQLite review seed, never by the deployed API.
export async function seedReviewDashboard(store) {
  const markerId = "reviewDashboardV6";
  if ((await store.get("settings", markerId))?.complete) return;
  const cfg = config({ APP_MODE: "demo", PAYMENT_MODE: "demo" });
  const business = domain(store, cfg);
  const services = await store.list("services");
  const existing = await store.get("settings", markerId);
  const startedAt = existing?.startedAt || Date.now();
  const customers = [
    "Meera Rao",
    "Arjun Sharma",
    "Priya Reddy",
    "Vikram Rao",
    "Lakshmi Devi",
    "Rahul Kumar",
  ].map((name, i) => ({
    id: `review-customer-${i + 1}`,
    name: `${name} (sample)`,
    role: "customer",
    active: true,
  }));
  const pros = [
    "Naveen Kumar",
    "Sai Teja",
    "Anjali Reddy",
    "Mahesh Rao",
    "Deepak Kumar",
  ].map((name, i) => ({
    id: `review-pro-${i + 1}`,
    name: `${name} (sample)`,
    role: "professional",
    active: true,
  }));
  await store.transaction(async (tx) => {
    tx.put("settings", { id: markerId, startedAt, complete: false });
    for (const customer of customers) {
      if (!(await tx.get("users", customer.id))) tx.put("users", customer);
      tx.put("addresses", {
        id: customer.id + "-home",
        customerId: customer.id,
        label: "Home",
        line: "Fictional demo home, Garden Street, Shadnagar",
        pin: "509216",
      });
    }
    for (const [i, user] of pros.entries()) {
      if (!(await tx.get("users", user.id))) tx.put("users", user);
      if (!(await tx.get("professionals", user.id)))
        tx.put("professionals", {
          id: user.id,
          name: user.name,
          type: i === 1 ? "In-house" : "Partner",
          approved: i !== 3,
          available: i !== 4,
          skills: services.map((s) => s.id),
          pins: ["509216"],
          documents: [],
          rating: 0,
          jobs: 0,
          experienceYears: 3 + i,
          languages: ["Telugu", "English"],
          bio: "Fictional professional for the local ANVIRA product demonstration.",
        });
    }
  });
  const statuses = [
    ...Array(14).fill("completed"),
    "cancelled",
    "cancelled",
    "cancelled",
    "confirmed",
    "confirmed",
    "confirmed",
    "confirmed",
    "assigned",
    "assigned",
    "in_progress",
    "in_progress",
    "payment_pending",
  ];
  for (const [i, target] of statuses.entries()) {
    const itemId = `${markerId}-${i}`;
    if (await store.get("settings", itemId)) continue;
    const service = services[i % services.length];
    const customer = customers[i % customers.length];
    const professional = pros[i % 3];
    const day = new Date(startedAt + ((i % 20) + 7) * 86400000 + 330 * 60000)
      .toISOString()
      .slice(0, 10);
    const b = await business.createBooking(customer, {
      serviceId: service.id,
      addons: [],
      options: Object.fromEntries(
        (service.optionGroups || [])
          .filter((g) => g.required)
          .map((g) => [g.id, g.options[0].id]),
      ),
      details: Object.fromEntries(
        (service.bookingFields || []).map((f) => [
          f.id,
          "Sample: " + (f.placeholder || f.label),
        ]),
      ),
      slot: slotFor(day, 9),
      address: {
        line: "Fictional demo home, Garden Street, Shadnagar",
        pin: "509216",
      },
      instructions:
        "Sample booking: call at the gate and explain the service scope before starting.",
      idempotencyKey: itemId,
    });
    if (target !== "payment_pending") {
      await business.action(customer, b.id, { action: "pay" });
      let current = await store.get("bookings", b.id);
      if (
        current.status === "assigned" &&
        current.professionalId !== professional.id
      )
        await business.action(demoUsers.owner, b.id, {
          action: "assign",
          professionalId: professional.id,
        });
      current = await store.get("bookings", b.id);
      if (
        ["completed", "confirmed", "in_progress"].includes(target) &&
        current.status === "assigned"
      )
        await business.action(professional, b.id, { action: "accept" });
      current = await store.get("bookings", b.id);
      if (
        ["completed", "in_progress"].includes(target) &&
        current.status === "confirmed"
      )
        await business.action(professional, b.id, { action: "start" });
      current = await store.get("bookings", b.id);
      if (target === "completed" && current.status === "in_progress") {
        await business.action(professional, b.id, {
          action: "complete",
          checklist: Array(3 + current.serviceChecklist.length).fill(true),
          completionNotes:
            "Sample handover: completed the checklist and explained aftercare to the customer.",
        });
        await business.action(customer, b.id, {
          action: "review",
          rating: i === 4 ? 3 : i % 4 === 0 ? 4 : 5,
          text:
            i === 4
              ? "Sample concern: please follow up about one missed area."
              : "Sample review: arrived on time, explained the work and cleaned up.",
        });
      }
      if (target === "cancelled" && current.status !== "cancelled")
        await business.action(customer, b.id, { action: "cancel" });
    }
    await store.transaction(async (tx) => {
      const current = await tx.get("bookings", b.id);
      if (target === "completed") {
        const completedAt = startedAt - (i + 1) * 86400000;
        const slot = completedAt - current.duration * 60000;
        tx.put("bookings", {
          ...current,
          slot,
          createdAt: slot - 86400000,
          paidAt: slot - 86340000,
          assignedAt: slot - 86280000,
          acceptedAt: slot - 86220000,
          arrivedAt: slot - 300000,
          startedAt: slot,
          completedAt,
          updatedAt: completedAt,
        });
        const ledger = await tx.get("ledger", "job_" + b.id);
        if (ledger) tx.put("ledger", { ...ledger, createdAt: completedAt });
      }
      if (target === "cancelled" && i === 16)
        tx.put("bookings", {
          ...current,
          refund: "refunded",
          refundId: "demo_refund_" + current.id,
          refundedAt: startedAt,
          updatedAt: startedAt,
        });
      tx.put("messages", {
        id: itemId + "-message",
        bookingId: b.id,
        customerId: customer.id,
        professionalId: current.professionalId || professional.id,
        senderId: customer.id,
        senderName: customer.name,
        message:
          "Sample conversation: the gate will be open. Please let me know before arrival.",
        createdAt: startedAt,
        expiresAt: startedAt + 30 * 86400000,
      });
      tx.put("settings", { id: itemId, bookingId: b.id, createdAt: startedAt });
    });
  }
  const finance = payoutOperations(store, business, createGateway(cfg), cfg);
  await finance.saveBank(pros[0], {
    holderName: pros[0].name,
    accountNumber: "123456789012",
    ifsc: "SBIN0001234",
  });
  await finance.verifyBank(pros[0]);
  await store.transaction(async (tx) => {
    for (const [i, category] of [
      "booking",
      "payment",
      "quality",
      "professional",
      "other",
    ].entries()) {
      const customer = customers[i];
      tx.put("tickets", {
        id: `${markerId}-ticket-${i}`,
        customerId: customer.id,
        customerName: customer.name,
        category,
        priority: i === 2 ? "high" : "normal",
        status: i === 4 ? "resolved" : "open",
        message: [
          "Sample request: help me choose another booking time.",
          "Sample request: explain the cancellation refund timeline.",
          "Sample request: arrange a follow-up for a missed area.",
          "Sample request: confirm the assigned professional's arrival.",
          "Sample request: explain the service coverage.",
        ][i],
        createdAt: startedAt - (i + 1) * 3600000,
        responseDueAt: startedAt + 3600000,
        awaitingResponse: i !== 4,
        messages:
          i === 4
            ? [
                {
                  message:
                    "Sample reply: Shadnagar PIN 509216 is covered in this demo.",
                  sender: "Customer Care",
                  role: "care",
                  at: startedAt,
                },
              ]
            : [],
      });
    }
    // Illustrate a requested and settled payout without any bank/provider call.
    const wallet = await tx.get("wallets", pros[0].id);
    const bank = await tx.get("professionals", pros[0].id);
    if (wallet?.available >= 800) {
      tx.put("wallets", {
        ...wallet,
        available: wallet.available - 800,
        held: wallet.held + 300,
        paid: wallet.paid + 500,
      });
      for (const [status, amount] of [
        ["requested", 300],
        ["paid", 500],
      ])
        tx.put("payouts", {
          id: `${markerId}-payout-${status}`,
          professionalId: pros[0].id,
          fundAccountId: bank.fundAccountId,
          bankLast4: bank.bankLast4,
          amount,
          status,
          createdAt: startedAt - 3600000,
          ...(status === "paid" ? { paidAt: startedAt - 1800000 } : {}),
          source: "manual",
          simulated: true,
        });
    }
    tx.put("settings", { id: markerId, startedAt, complete: true });
  });
  console.log(
    "Owner demo expanded: 26 bookings, 6 customers, 5 additional professionals, partner earnings, payouts, reviews, conversations and support tickets.",
  );
}

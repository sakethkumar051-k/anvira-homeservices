import { randomUUID } from "node:crypto";
import { reviewCatalog } from "../../scripts/prepare-client-review.mjs";
import { serviceSelection, serviceDetails } from "./service-selection.mjs";
import { commissionPolicy, bookingCommissionBps } from "./commission.mjs";

const stable = (v) => JSON.stringify(v, (_, value) => value && typeof value === "object" && !Array.isArray(value)
  ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))) : value);
export function matchesSeedArchive(path, current, archived) {
  if (!archived) return false;
  // This operational clock is preserved, not cleared or overwritten by reset.
  if (path === "settings/workerHeartbeat")
    return stable({ ...current, at: 0 }) === stable({ ...archived, at: 0 });
  return stable(current) === stable(archived);
}

export function buildClientTestSeed({ accounts, company, now = Date.now(), batch }) {
  if (accounts.length !== 20 || new Set(accounts.map((a) => a.id)).size !== 20)
    throw Error("Exactly 20 distinct test identities are required.");
  const customers = accounts.filter((a) => a.role === "customer");
  const partners = accounts.filter((a) => a.role === "professional");
  if (customers.length !== 10 || partners.length !== 10)
    throw Error("Use ten customers and ten partners; staff identities are forbidden.");
  const records = [];
  const put = (kind, record) => records.push({ kind, value: {
    ...record, sample: true, reviewOnly: true, seedBatch: batch,
    createdAt: record.createdAt ?? now,
  } });
  const { services } = reviewCatalog();
  services.forEach((s) => put("services", s));
  const skills = services.map((s) => s.id);
  for (const a of accounts) {
    const { id, name, email, role } = a;
    put("users", { id, name, email, role, active: true, phone: "", phoneVerified: false });
  }
  for (const [i, a] of partners.entries()) put("professionals", {
    id: a.id, name: a.name, email: a.email, type: "Partner",
    approved: i !== 8, available: i !== 9, skills, pins: ["509216"],
    documents: [], rating: 0, jobs: 0, languages: ["English", "Telugu"],
    bio: "SAMPLE fictional professional for client testing. Not a verified real worker.",
  });
  for (let i = 0; i < 5; i++) put("professionals", {
    id: `review-inhouse-${i + 1}`, name: `SAMPLE Internal Worker ${i + 1}`,
    type: "In-house", accountless: true, approved: true, available: i < 3,
    skills, pins: ["509216"], documents: [], rating: 0, jobs: 0,
    languages: ["English", "Telugu"],
  });
  for (const [i, customer] of customers.entries()) {
    const addressId = customer.id + "-home";
    put("addresses", { id: addressId, customerId: customer.id, label: "SAMPLE Home",
      line: `SAMPLE only, House ${i + 1}, Fictional Garden Street, Shadnagar`, pin: "509216" });
    for (const service of services.slice(i % 5, i % 5 + 2)) put("homeCareFavorites", {
      id: `${customer.id}-${service.id}`, customerId: customer.id, serviceId: service.id,
    });
    put("homeCareAssets", { id: customer.id + "-asset", customerId: customer.id,
      addressId, label: "SAMPLE Living room AC", category: "Air conditioner", model: "Fictional test model" });
    put("homeCareReminders", { id: customer.id + "-reminder", customerId: customer.id,
      serviceId: services[i % services.length].id, addressId, intervalDays: 30,
      dueAt: now + (i + 2) * 86400000, status: i % 3 ? "active" : "paused" });
    const service = services[i % services.length];
    const details = Object.fromEntries((service.bookingFields || []).map((f) => [f.id, "SAMPLE requirement for " + f.label]));
    put("serviceQuotes", { id: randomUUID(), customerId: customer.id, customerName: customer.name,
      serviceId: service.id, serviceName: service.name, description: "SAMPLE tailored requirement for client testing; please propose a fictional test price.",
      address: { line: `SAMPLE Home ${i + 1}, Fictional Garden Street`, pin: "509216" },
      details, serviceDetails: serviceDetails(service, details), status: "requested", revision: 0,
    });
    put("tickets", { id: `${customer.id}-ticket`, customerId: customer.id, customerName: customer.name,
      category: i % 2 ? "booking" : "quality", priority: i === 0 ? "high" : "normal",
      status: i < 7 ? "open" : "resolved", message: "SAMPLE support request: help me select the correct service scope.",
      awaitingResponse: i < 7, responseDueAt: now + 86400000, messages: [] });
    put("notifications", { id: `${customer.id}-welcome`, userId: customer.id, read: false,
      title: "SAMPLE client test account ready", message: "All seeded history is fictional. Use Razorpay Test Mode for new bookings." });
  }
  const wallets = new Map(partners.map((p) => [p.id, { id: p.id, available: 0, held: 0, paid: 0 }]));
  for (let i = 0; i < 40; i++) {
    const customer = customers[i % 10], partner = partners[i % 8], service = services[i % services.length];
    const selection = serviceSelection(service, {
      addons: [], packageId: service.packages?.[0]?.id,
      options: Object.fromEntries((service.optionGroups || []).filter((g) => g.required).map((g) => [g.id, g.options[0].id])),
    });
    const details = Object.fromEntries((service.bookingFields || []).map((f) => [f.id, "SAMPLE " + f.label]));
    const status = i < 28 ? "completed" : i < 36 ? "cancelled" : "payment_expired";
    const completedAt = now - (1 + i % 14) * 86400000;
    const b = {
      id: randomUUID(), customerId: customer.id, customerName: customer.name,
      professionalId: partner.id, professionalName: partner.name, professionalType: "Partner",
      serviceId: service.id, serviceName: service.name, fulfillmentType: service.fulfillmentType || "visit",
      ...selection, details: serviceDetails(service, details), exclusions: selection.exclusions,
      total: selection.subtotal, discount: 0, status, payment: status === "payment_expired" ? "pending" : "paid",
      paymentEnvironment: "test", seededHistory: true,
      instructions: "SAMPLE history only: no Razorpay payment was collected for this seeded order.",
      completionNotes: "SAMPLE historical service, not a real delivered job.",
      address: { line: "SAMPLE fictional home, Garden Street, Shadnagar", pin: "509216" },
      slot: completedAt - selection.duration * 60000, createdAt: completedAt - 86400000,
      paidAt: completedAt - 3600000, assignedAt: completedAt - 3500000,
      ...(status === "completed" ? { startedAt: completedAt - selection.duration * 60000, completedAt,
        checklist: Array(3 + (service.checklist?.length || 0)).fill(true),
        review: { rating: 3 + i % 3, text: "SAMPLE review for a fictional test service." } } : {}),
      ...(status === "cancelled" ? { cancelledAt: completedAt, refund: "refunded", refundedAt: completedAt } : {}),
      serviceChecklist: service.checklist || [], commissionPolicy: commissionPolicy(company),
      idempotencyKey: `${batch}-history-${i}`,
    };
    b.commissionBps = bookingCommissionBps(b, "Partner", company.commissionBps);
    put("bookings", b);
    if (status === "completed") {
      const commission = Math.round(b.total * b.commissionBps / 10000);
      const net = b.total - commission;
      wallets.get(partner.id).available += net;
      put("reviewLedger", { id: "job_" + b.id, professionalId: partner.id, bookingId: b.id,
        gross: b.total, commission, net, amount: net, type: "credit", paymentEnvironment: "test", createdAt: completedAt });
    }
    put("messages", { id: "seed-message-" + b.id, bookingId: b.id, customerId: customer.id,
      professionalId: partner.id, senderId: customer.id, senderName: customer.name,
      message: "SAMPLE conversation for the fictional service history.", expiresAt: now + 30 * 86400000 });
  }
  for (const wallet of wallets.values()) put("reviewWallets", wallet);
  for (const record of records.filter((r) => r.kind === "professionals" && r.value.type === "Partner")) {
    const jobs = records.filter((r) => r.kind === "bookings" && r.value.status === "completed" && r.value.professionalId === record.value.id);
    record.value.jobs = jobs.length;
    record.value.rating = jobs.length ? Math.round(jobs.reduce((sum, r) => sum + r.value.review.rating, 0) / jobs.length * 10) / 10 : 0;
  }
  put("promotions", { id: "SAMPLE100", discountAmount: 100, minAmount: 499, maxUses: 100,
    uses: 0, active: true, expiresAt: now + 30 * 86400000 });
  if (records.length > 400) throw Error("Seed exceeds safe atomic write budget.");
  return { records, services: services.length, customers: 10, partners: 10, internalWorkers: 5, historicalBookings: 40 };
}

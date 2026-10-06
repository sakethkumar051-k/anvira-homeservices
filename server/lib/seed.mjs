import { sampleServices } from "./sample-catalog.mjs";
export const demoUsers = {
  customer: { id: "customer-1", name: "Ananya", role: "customer" },
  professional: { id: "pro-1", name: "Ravi Kumar", role: "professional" },
  owner: { id: "owner-1", name: "ANVIRA Owner", role: "owner" },
  care: { id: "care-1", name: "Customer Care", role: "care" },
};
export const catalog = sampleServices.map((s) => [
  s.id,
  s.name,
  s.category,
  s.icon,
  s.price,
  s.duration,
  s.headline,
]);
export async function seedDemo(store) {
  await store.transaction(async (tx) => {
    if (!(await tx.list("services")).length)
      sampleServices.forEach((service) => tx.put("services", service));
    if (!(await tx.list("professionals")).length) {
      tx.put("professionals", {
        id: "pro-1",
        name: "Ravi Kumar",
        rating: 4.9,
        jobs: 248,
        type: "In-house",
        approved: true,
        available: true,
        skills: sampleServices.map((s) => s.id),
        pins: ["509216"],
        documents: [],
      });
      tx.put("professionals", {
        id: "pro-2",
        name: "Suresh Reddy",
        rating: 4.8,
        jobs: 172,
        type: "Partner",
        approved: true,
        available: true,
        skills: ["cleaning", "ac"],
        pins: ["509216"],
        documents: [],
      });
      tx.put("professionals", {
        id: "pro-3",
        name: "Kiran",
        rating: 0,
        jobs: 0,
        type: "Partner",
        approved: false,
        available: true,
        skills: ["plumbing"],
        pins: ["509216"],
        documents: [],
      });
    }
    for (const p of await tx.list("professionals"))
      if (!p.pins || !p.documents)
        tx.put("professionals", {
          ...p,
          pins: p.pins || ["509216"],
          documents: p.documents || [],
        });
    for (const user of Object.values(demoUsers))
      if (!(await tx.get("users", user.id)))
        tx.put("users", { ...user, active: true });
    if (!(await tx.get("settings", "company")))
      tx.put("settings", {
        id: "company",
        name: "ANVIRA",
        pins: ["509216"],
        commissionBps: 2000,
        cancelCutoffHours: 2,
        assignmentDeadlineMinutes: 30,
        termsVersion: "sample-v1",
        policyPublished: true,
        termsUrl: "",
        privacyUrl: "",
        supportPhone: "",
        timezone: "Asia/Kolkata",
      });
  });
}

import { staffNavigation } from "./office-ui.ts";
export function staffNavigationGroups(role: string, platform: string) {
  const items = [...staffNavigation(role, platform)];
  if (role === "owner" && platform === "web")
    items.push(["automations", "Automations", "refresh"]);
  return [
    {
      label: "Daily operations",
      keys: ["home", "bookings", "quotes", "support"],
    },
    { label: "Team & services", keys: ["workers", "vendors", "services"] },
    { label: "Finance", keys: ["refunds", "payouts", "reports"] },
    { label: "Growth", keys: ["growth", "offers", "banners"] },
    { label: "Business settings", keys: ["automations", "settings"] },
  ]
    .map((group) => ({
      label: group.label,
      items: group.keys.flatMap((key) =>
        items.filter((item) => item[0] === key),
      ),
    }))
    .filter((group) => group.items.length);
}
export function orderNextAction(b: {
  status: string;
  payment: string;
  refund?: string;
  arrivedAt?: number;
  professionalType?: string;
  dispatch?: { state?: string; version?: number };
}) {
  if (b.refund === "refunded") return "View refund receipt";
  if (b.refund && !["none", "rejected"].includes(b.refund))
    return "Review refund";
  if (b.status === "cancelled") return "View cancellation";
  if (b.status === "completed") return "View completed visit";
  if (b.status === "payment_expired") return "View expired reservation";
  if (b.payment !== "paid") return "Await payment";
  if (b.status === "awaiting_assignment") {
    if (b.dispatch?.state === "offering") return "Track outside offers";
    if (b.dispatch?.state === "attention") return "Review dispatch exception";
    return "Assign a worker";
  }
  if (b.status === "in_progress") return "Track visit progress";
  if (b.status === "confirmed") {
    if (b.professionalType === "In-house" && b.dispatch?.version === 1) {
      if (b.arrivedAt) return "Start internal service";
      if (b.dispatch.state === "dispatched") return "Record team arrival";
      return "Review & dispatch";
    }
    return b.arrivedAt ? "Track visit progress" : "Track professional arrival";
  }
  return "Review assignment";
}
export const adminPageGuidance: Record<string, string> = {
  home: "Your daily priorities, bookings and business activity in one place.",
  bookings: "Find an order, review its next step and coordinate the visit.",
  quotes: "Review customer requirements and prepare a clear price proposal.",
  workers: "Manage your internal team, service coverage and working hours.",
  vendors:
    "Review professional applications and keep the partner roster current.",
  services:
    "Manage what customers can book, what is included and what they pay.",
  refunds: "Review payment issues and refund requests before taking action.",
  support:
    "Prioritise customer questions and follow each conversation through.",
  reports: "Understand booking performance, revenue and staff activity.",
  payouts: "Review balances, approvals and payment reconciliation.",
  banners: "Schedule and manage the promotions customers see.",
  offers: "Create clear offers and manage their eligibility and validity.",
  growth:
    "Bring in new customers and win back past ones with ready-made posters, links and messages.",
  settings: "Business configuration, launch checks and staff access.",
  automations: "Monitor background work and find issues that need a person.",
};

export function bannerScheduleStatus(
  b: { active: boolean; startsOn: string; endsOn: string },
  serviceAvailable: boolean,
  today: string,
) {
  if (!b.active) return "Disabled";
  if (!serviceAvailable) return "Service unavailable";
  if (b.startsOn && b.startsOn > today) return "Scheduled";
  if (b.endsOn && b.endsOn < today) return "Ended";
  return "Showing now";
}
